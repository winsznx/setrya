//! Background chain sync against lightwalletd using `zcash_client_backend::sync::run`.
//!
//! `run` also refreshes UTXOs for the account's transparent addresses (the `pczt` feature forces
//! transparent support on). Those addresses are never handed out, so the server learns only that
//! this client asked about addresses with no history.

use std::{
    sync::{Arc, Mutex, PoisonError},
    time::Duration,
};

use async_trait::async_trait;
use tokio::sync::RwLock;
use tracing::{info, warn};
use zcash_client_backend::{
    data_api::{
        chain::{BlockCache, BlockSource, error::Error as ChainError},
        scanning::ScanRange,
    },
    proto::compact_formats::CompactBlock,
};
use zcash_protocol::consensus::BlockHeight;

use crate::{config::Config, lwd, state::AppState, wallet};

const BATCH_SIZE: u32 = 1000;
const INTERVAL: Duration = Duration::from_secs(20);

#[derive(Debug)]
pub struct CacheError(String);

impl std::fmt::Display for CacheError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for CacheError {}

/// Holds one batch of compact blocks between download and scan. Nothing is persisted.
#[derive(Default)]
pub struct MemBlockCache {
    blocks: Mutex<Vec<CompactBlock>>,
}

impl MemBlockCache {
    fn lock(&self) -> std::sync::MutexGuard<'_, Vec<CompactBlock>> {
        self.blocks.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

fn height(block: &CompactBlock) -> BlockHeight {
    BlockHeight::from_u32(u32::try_from(block.height).unwrap_or(u32::MAX))
}

impl BlockSource for MemBlockCache {
    type Error = CacheError;

    fn with_blocks<F, WalletErrT>(
        &self,
        from_height: Option<BlockHeight>,
        limit: Option<usize>,
        mut with_block: F,
    ) -> Result<(), ChainError<WalletErrT, Self::Error>>
    where
        F: FnMut(CompactBlock) -> Result<(), ChainError<WalletErrT, Self::Error>>,
    {
        let mut blocks: Vec<CompactBlock> = self
            .lock()
            .iter()
            .filter(|b| from_height.is_none_or(|h| height(b) >= h))
            .cloned()
            .collect();
        blocks.sort_by_key(|b| b.height);
        for block in blocks.into_iter().take(limit.unwrap_or(usize::MAX)) {
            with_block(block)?;
        }
        Ok(())
    }
}

#[async_trait]
impl BlockCache for MemBlockCache {
    fn get_tip_height(
        &self,
        range: Option<&ScanRange>,
    ) -> Result<Option<BlockHeight>, Self::Error> {
        Ok(self
            .lock()
            .iter()
            .map(height)
            .filter(|h| range.is_none_or(|r| r.block_range().contains(h)))
            .max())
    }

    async fn read(&self, range: &ScanRange) -> Result<Vec<CompactBlock>, Self::Error> {
        let mut blocks: Vec<CompactBlock> = self
            .lock()
            .iter()
            .filter(|b| range.block_range().contains(&height(b)))
            .cloned()
            .collect();
        blocks.sort_by_key(|b| b.height);
        Ok(blocks)
    }

    async fn insert(&self, mut compact_blocks: Vec<CompactBlock>) -> Result<(), Self::Error> {
        self.lock().append(&mut compact_blocks);
        Ok(())
    }

    async fn delete(&self, range: ScanRange) -> Result<(), Self::Error> {
        self.lock()
            .retain(|b| !range.block_range().contains(&height(b)));
        Ok(())
    }
}

#[derive(Clone, Debug, Default)]
pub struct SyncStatus {
    pub last_success: Option<std::time::SystemTime>,
    pub last_error: Option<String>,
    pub running: bool,
}

async fn sync_once(
    config: &Config,
    state: &AppState,
    client: &mut lwd::Client,
) -> anyhow::Result<()> {
    let params = config.network.params();
    let mut db = wallet::open(&state.data.wallet_db(), params)?;
    let cache = MemBlockCache::default();
    zcash_client_backend::sync::run(client, &params, &cache, &mut db, BATCH_SIZE)
        .await
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    Ok(())
}

pub async fn run_forever(state: Arc<AppState>, status: Arc<RwLock<SyncStatus>>) {
    let mut client: Option<lwd::Client> = None;
    loop {
        status.write().await.running = true;
        if client.is_none() {
            match lwd::connect(&state.config).await {
                Ok(c) => client = Some(c),
                Err(e) => warn!("lightwalletd connection failed: {e:#}"),
            }
        }
        if let Some(c) = client.as_mut() {
            let result = sync_once(&state.config, &state, c).await;
            let mut s = status.write().await;
            match result {
                Ok(()) => {
                    s.last_success = Some(std::time::SystemTime::now());
                    s.last_error = None;
                    info!("wallet synced");
                }
                Err(e) => {
                    warn!("sync failed: {e:#}");
                    s.last_error = Some(format!("{e:#}"));
                    client = None;
                }
            }
        } else {
            status.write().await.last_error = Some("lightwalletd is not reachable".into());
        }
        status.write().await.running = false;
        tokio::time::sleep(INTERVAL).await;
    }
}
