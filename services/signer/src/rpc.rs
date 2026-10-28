//! JSON-RPC 2.0 over HTTP with cookie (HTTP Basic) authentication, as Zallet and Zebra serve it.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::post,
};
use base64::{Engine as _, engine::general_purpose::STANDARD as B64};
use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use serde_json::{Value, json};
use subtle::ConstantTimeEq;
use tracing::debug;

use crate::{methods, state::AppState};

/// PCZTs for a handful of payees stay well under this.
const MAX_BODY_BYTES: usize = 8 * 1024 * 1024;

#[derive(Clone)]
struct Server {
    state: Arc<AppState>,
    expected_auth: Arc<SecretString>,
}

#[derive(Deserialize)]
struct Request {
    #[serde(default)]
    id: Value,
    method: String,
    #[serde(default)]
    params: Value,
}

pub fn router(state: Arc<AppState>, cookie: &SecretString) -> Router {
    let expected = format!(
        "Basic {}",
        B64.encode(format!("__cookie__:{}", cookie.expose_secret()))
    );
    Router::new()
        .route("/", post(handle))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .with_state(Server {
            state,
            expected_auth: Arc::new(SecretString::new(expected)),
        })
}

fn authorized(headers: &HeaderMap, expected: &SecretString) -> bool {
    let given = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let expected = expected.expose_secret().as_bytes();
    given.len() == expected.len() && bool::from(given.as_bytes().ct_eq(expected))
}

async fn handle(
    State(server): State<Server>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Response {
    if !authorized(&headers, &server.expected_auth) {
        return (
            StatusCode::UNAUTHORIZED,
            [(header::WWW_AUTHENTICATE, "Basic realm=\"setrya-signer\"")],
        )
            .into_response();
    }
    let request: Request = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(_) => {
            return Json(json!({ "jsonrpc": "2.0", "id": null, "error": { "code": -32700, "message": "Parse error" } })).into_response();
        }
    };
    let params = match request.params {
        Value::Array(a) => a,
        Value::Null => vec![],
        _ => {
            return Json(json!({ "jsonrpc": "2.0", "id": request.id, "error": { "code": -32602, "message": "params must be an array" } }))
                .into_response();
        }
    };
    debug!(method = %request.method, "rpc");
    let body = match methods::dispatch(server.state, &request.method, params).await {
        Ok(result) => json!({ "jsonrpc": "2.0", "id": request.id, "result": result }),
        Err(e) => {
            json!({ "jsonrpc": "2.0", "id": request.id, "error": { "code": e.code, "message": e.message } })
        }
    };
    Json(body).into_response()
}
