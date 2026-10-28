use std::{collections::HashSet, sync::Arc};

use sha2::{Digest, Sha256};
use tokio::sync::{Mutex, RwLock};

use crate::{
    config::{Config, DataDir},
    lwd,
    sync::SyncStatus,
};

pub struct AppState {
    pub config: Config,
    pub data: DataDir,
    pub sync: Arc<RwLock<SyncStatus>>,
    /// SHA-256 digests of PCZTs this process built under FullPrivacy, followed through prove and
    /// sign. Inspection reports a policy only for these; anything else is "created elsewhere".
    full_privacy: Mutex<HashSet<[u8; 32]>>,
    /// Serialises wallet writes made on behalf of RPC callers (proposal and extraction).
    pub write_lock: Mutex<()>,
    client: Mutex<Option<lwd::Client>>,
    pub server_label: RwLock<Option<String>>,
}

pub fn digest(bytes: &[u8]) -> [u8; 32] {
    Sha256::digest(bytes).into()
}

impl AppState {
    pub fn new(config: Config, data: DataDir) -> Self {
        Self {
            config,
            data,
            sync: Arc::new(RwLock::new(SyncStatus::default())),
            full_privacy: Mutex::new(HashSet::new()),
            write_lock: Mutex::new(()),
            client: Mutex::new(None),
            server_label: RwLock::new(None),
        }
    }

    pub async fn remember_full_privacy(&self, pczt: &[u8]) {
        self.full_privacy.lock().await.insert(digest(pczt));
    }

    pub async fn is_full_privacy(&self, pczt: &[u8]) -> bool {
        self.full_privacy.lock().await.contains(&digest(pczt))
    }

    /// A shared lightwalletd client for RPC handlers. tonic channels multiplex, so cloning is cheap.
    pub async fn client(&self) -> anyhow::Result<lwd::Client> {
        let mut guard = self.client.lock().await;
        if let Some(c) = guard.as_ref() {
            return Ok(c.clone());
        }
        let c = lwd::connect(&self.config).await?;
        *guard = Some(c.clone());
        Ok(c)
    }

    pub async fn drop_client(&self) {
        *self.client.lock().await = None;
    }
}
