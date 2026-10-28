//! lightwalletd connections, directly over TLS or through a SOCKS5 proxy such as Tor.
//!
//! The SOCKS connector follows zcash-devtool's `socks.rs` (MIT OR Apache-2.0).

use std::{
    future::Future,
    net::SocketAddr,
    pin::Pin,
    task::{Context, Poll},
    time::Duration,
};

use anyhow::{Context as _, anyhow};
use hyper_util::rt::TokioIo;
use tokio_socks::tcp::Socks5Stream;
use tonic::transport::{Channel, ClientTlsConfig, Endpoint, Uri};
use tower::Service;
use zcash_client_backend::proto::service::compact_tx_streamer_client::CompactTxStreamerClient;

use crate::config::Config;

pub type Client = CompactTxStreamerClient<Channel>;

#[derive(Clone)]
struct SocksConnector {
    proxy: SocketAddr,
}

impl Service<Uri> for SocksConnector {
    type Response = TokioIo<tokio::net::TcpStream>;
    type Error = Box<dyn std::error::Error + Send + Sync>;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, _cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, uri: Uri) -> Self::Future {
        let proxy = self.proxy;
        Box::pin(async move {
            let host = uri.host().ok_or("missing host")?.to_owned();
            let target = format!("{host}:{}", uri.port_u16().unwrap_or(443));
            // The proxy resolves the name, so DNS never leaves Tor.
            let stream = tokio::time::timeout(
                Duration::from_secs(30),
                Socks5Stream::connect(proxy, target.as_str()),
            )
            .await
            .map_err(|_| "SOCKS connection timed out")??;
            Ok(TokioIo::new(stream.into_inner()))
        })
    }
}

fn is_local(host: &str) -> bool {
    matches!(host, "localhost" | "127.0.0.1" | "::1")
}

pub async fn connect(config: &Config) -> anyhow::Result<Client> {
    let (host, port) = config
        .lightwalletd
        .rsplit_once(':')
        .ok_or_else(|| anyhow!("lightwalletd must be host:port"))?;
    let port: u16 = port.parse().context("invalid lightwalletd port")?;
    let tls = !is_local(host) && !host.ends_with(".onion");
    let uri: Uri = format!("{}://{host}:{port}", if tls { "https" } else { "http" }).parse()?;

    let mut endpoint = Endpoint::from(uri.clone())
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(120));
    if tls {
        endpoint = endpoint.tls_config(
            ClientTlsConfig::new()
                .domain_name(host.to_owned())
                .assume_http2(true)
                .with_webpki_roots(),
        )?;
    }
    let channel = match config.socks5 {
        Some(proxy) => {
            endpoint
                .connect_with_connector(SocksConnector { proxy })
                .await?
        }
        None => endpoint.connect().await?,
    };
    Ok(CompactTxStreamerClient::with_origin(channel, uri))
}
