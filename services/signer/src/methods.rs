//! JSON-RPC methods. Names, parameter order and result shapes are a subset of Zallet's wallet RPC
//! and Zebra's node RPC, so a Zallet client can talk to this signer without changes.

use std::{collections::BTreeMap, convert::Infallible, num::NonZeroU32, sync::Arc};

use base64::{Engine as _, engine::general_purpose::STANDARD as B64};
use pczt::{
    Pczt,
    roles::{prover::Prover, signer::Signer, verifier::Verifier},
};
use rand::{rand_core::UnwrapErr, rngs::SysRng};
use secrecy::ExposeSecret;
use serde_json::{Value, json};
use tracing::info;
use zcash_client_backend::{
    data_api::{
        WalletRead,
        wallet::{
            ConfirmationsPolicy, create_pczt_from_proposal,
            extract_and_store_transaction_from_pczt,
            input_selection::{GreedyInputSelector, SpendPolicy},
            propose_transfer,
        },
    },
    fees::{DustOutputPolicy, SplitPolicy, StandardFeeRule, standard::MultiOutputChangeStrategy},
    proto::service::{
        self, BlockId, ChainSpec, Empty, GetMempoolTxRequest, RawTransaction, TxFilter,
    },
    wallet::OvkPolicy,
};
use zcash_client_sqlite::AccountUuid;
use zcash_keys::keys::UnifiedSpendingKey;
use zcash_primitives::transaction::Transaction;
use zcash_proofs::prover::LocalTxProver;
use zcash_protocol::{
    ShieldedPool,
    consensus::{BlockHeight, BranchId, NetworkConstants, Parameters},
    memo::MemoBytes,
    value::Zatoshis,
};
use zip32::fingerprint::SeedFingerprint;
use zip321::{Payment, TransactionRequest};

use crate::{inspect, policy, state::AppState, wallet};

pub const METHODS: &[&str] = &[
    "rpc.discover",
    "getwalletstatus",
    "getwalletinfo",
    "z_listaccounts",
    "z_getaddressforaccount",
    "z_getbalanceforaccount",
    "pczt_create",
    "pczt_inspect",
    "pczt_prove",
    "pczt_sign",
    "pczt_extract",
    "z_viewtransaction",
    "z_listtransactions",
    "getinfo",
    "getblockchaininfo",
    "sendrawtransaction",
    "getrawtransaction",
    "getrawmempool",
];

#[derive(Debug)]
pub struct RpcError {
    pub code: i32,
    pub message: String,
}

impl RpcError {
    pub fn new(code: i32, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
    fn params(message: impl Into<String>) -> Self {
        Self::new(-32602, message)
    }
    fn policy(e: policy::PolicyError) -> Self {
        Self::new(-8, e.to_string())
    }
    fn not_found() -> Self {
        Self::new(-5, "No such mempool or blockchain transaction")
    }
}

impl From<anyhow::Error> for RpcError {
    fn from(e: anyhow::Error) -> Self {
        Self::new(-1, format!("{e:#}"))
    }
}

impl From<tonic::Status> for RpcError {
    fn from(s: tonic::Status) -> Self {
        Self::new(-1, format!("lightwalletd: {}", s.message()))
    }
}

type RpcResult = Result<Value, RpcError>;

fn param(params: &[Value], i: usize) -> Option<&Value> {
    params.get(i).filter(|v| !v.is_null())
}

fn str_param<'a>(params: &'a [Value], i: usize, name: &str) -> Result<&'a str, RpcError> {
    param(params, i)
        .and_then(Value::as_str)
        .ok_or_else(|| RpcError::params(format!("{name} must be a string")))
}

fn display_hash(bytes: &[u8]) -> String {
    let mut b = bytes.to_vec();
    b.reverse();
    hex::encode(b)
}

fn parse_txid(s: &str) -> Result<zcash_protocol::TxId, RpcError> {
    let mut bytes: [u8; 32] = hex::decode(s)
        .ok()
        .and_then(|b| b.try_into().ok())
        .ok_or_else(|| RpcError::params("txid must be 64 hex characters"))?;
    bytes.reverse();
    Ok(zcash_protocol::TxId::from_bytes(bytes))
}

fn decode_pczt(s: &str) -> Result<(Vec<u8>, Pczt), RpcError> {
    let bytes = B64
        .decode(s)
        .map_err(|_| RpcError::params("pczt must be base64"))?;
    let pczt = Pczt::parse(&bytes).map_err(|e| RpcError::params(format!("invalid PCZT: {e:?}")))?;
    Ok((bytes, pczt))
}

fn encode_pczt(pczt: Pczt) -> Result<(Vec<u8>, String), RpcError> {
    let bytes = pczt
        .serialize()
        .map_err(|e| RpcError::new(-1, format!("cannot serialize PCZT: {e:?}")))?;
    let text = B64.encode(&bytes);
    Ok((bytes, text))
}

async fn blocking<T: Send + 'static>(
    f: impl FnOnce() -> Result<T, RpcError> + Send + 'static,
) -> Result<T, RpcError> {
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| RpcError::new(-1, format!("worker failed: {e}")))?
}

fn open(state: &AppState) -> Result<wallet::Db, RpcError> {
    Ok(wallet::open(
        &state.data.wallet_db(),
        state.config.network.params(),
    )?)
}

fn require_account(db: &wallet::Db, requested: &str) -> Result<AccountUuid, RpcError> {
    let payer = wallet::payer(db)?;
    let requested =
        uuid::Uuid::parse_str(requested).map_err(|_| RpcError::params("account must be a UUID"))?;
    if payer.expose_uuid() != requested {
        return Err(RpcError::new(-8, "Unknown account"));
    }
    Ok(payer)
}

fn confirmations(minconf: u64) -> ConfirmationsPolicy {
    let n =
        NonZeroU32::new(u32::try_from(minconf).unwrap_or(u32::MAX).max(1)).expect("at least one");
    ConfirmationsPolicy::new_symmetrical(n, false)
}

pub async fn dispatch(state: Arc<AppState>, method: &str, params: Vec<Value>) -> RpcResult {
    match method {
        "rpc.discover" => Ok(
            json!({ "methods": METHODS.iter().map(|m| json!({ "name": m })).collect::<Vec<_>>() }),
        ),
        "getwalletstatus" => wallet_status(&state).await,
        "getwalletinfo" => Ok(json!({})),
        "z_listaccounts" => list_accounts(state).await,
        "z_getaddressforaccount" => address_for_account(state, params).await,
        "z_getbalanceforaccount" => balance_for_account(state, params).await,
        "pczt_create" => pczt_create(state, params).await,
        "pczt_inspect" => pczt_inspect(&state, params).await,
        "pczt_prove" => pczt_prove(state, params).await,
        "pczt_sign" => pczt_sign(state, params).await,
        "pczt_extract" => pczt_extract(state, params).await,
        "z_viewtransaction" => view_transaction(state, params).await,
        "z_listtransactions" => list_transactions(state, params).await,
        "getinfo" => get_info(&state).await,
        "getblockchaininfo" => blockchain_info(&state).await,
        "sendrawtransaction" => send_raw_transaction(&state, params).await,
        "getrawtransaction" => get_raw_transaction(&state, params).await,
        "getrawmempool" => raw_mempool(&state).await,
        _ => Err(RpcError::new(-32601, "Method not found")),
    }
}

async fn chain_tip(state: &AppState) -> Result<(u64, String), RpcError> {
    let mut client = state.client().await?;
    match client.get_latest_block(ChainSpec::default()).await {
        Ok(r) => {
            let b = r.into_inner();
            Ok((b.height, display_hash(&b.hash)))
        }
        Err(e) => {
            state.drop_client().await;
            Err(e.into())
        }
    }
}

async fn wallet_status(state: &Arc<AppState>) -> RpcResult {
    let (tip, tip_hash) = chain_tip(state).await?;
    let st = state.clone();
    let (scanned, fully, progress) = blocking(move || {
        let db = open(&st)?;
        let scanned = db.block_max_scanned().map_err(anyhow::Error::from)?;
        let fully = db.block_fully_scanned().map_err(anyhow::Error::from)?;
        let progress = db
            .get_wallet_summary(ConfirmationsPolicy::default())
            .map_err(anyhow::Error::from)?
            .map(|s| {
                let p = s.progress().scan();
                (*p.numerator(), *p.denominator())
            });
        Ok((
            scanned.map(|m| (u32::from(m.block_height()), m.block_hash().to_string())),
            fully.map(|m| u32::from(m.block_height())),
            progress,
        ))
    })
    .await?;
    let sync = state.sync.read().await.clone();
    let fully_height = u64::from(fully.unwrap_or(0));
    let caught_up = fully_height + 1 >= tip && sync.last_success.is_some();
    // The wallet reports 0/0 when nothing is left to scan; present that as complete.
    let (numerator, denominator) = match progress {
        Some((_, 0)) | None if caught_up => (1, 1),
        Some(p) => p,
        None => (0, 1),
    };
    let mut out = json!({
        "node_tip": { "blockhash": tip_hash, "height": tip },
        "fully_synced_height": fully,
        "sync_work_remaining": {
            "unscanned_blocks": tip.saturating_sub(fully_height),
            "progress": { "numerator": numerator, "denominator": denominator },
        },
        "locked": !caught_up,
    });
    if let Some((height, hash)) = scanned {
        out["wallet_tip"] = json!({ "blockhash": hash, "height": height });
    }
    if let Some(e) = sync.last_error {
        out["sync_error"] = json!(e);
    }
    Ok(out)
}

async fn list_accounts(state: Arc<AppState>) -> RpcResult {
    blocking(move || {
        let mut db = open(&state)?;
        let id = wallet::payer(&db)?;
        let name = wallet::account_name(&db, id)?;
        let ua = wallet::orchard_address(&mut db, id)?;
        Ok(json!([{ "account_uuid": id.expose_uuid().to_string(), "name": name, "addresses": [{ "ua": ua }] }]))
    })
    .await
}

async fn address_for_account(state: Arc<AppState>, params: Vec<Value>) -> RpcResult {
    let account = str_param(&params, 0, "account")?.to_owned();
    if let Some(receivers) = param(&params, 1) {
        let only_orchard = receivers
            .as_array()
            .is_some_and(|r| r.len() == 1 && r[0] == "orchard");
        if !only_orchard {
            return Err(RpcError::new(
                -8,
                "Only [\"orchard\"] receiver sets are supported",
            ));
        }
    }
    blocking(move || {
        let mut db = open(&state)?;
        let id = require_account(&db, &account)?;
        let address = wallet::orchard_address(&mut db, id)?;
        Ok(json!({
            "account_uuid": id.expose_uuid().to_string(),
            "diversifier_index": 0,
            "receiver_types": ["orchard"],
            "address": address,
        }))
    })
    .await
}

async fn balance_for_account(state: Arc<AppState>, params: Vec<Value>) -> RpcResult {
    let account = str_param(&params, 0, "account")?.to_owned();
    let minconf = param(&params, 1).and_then(Value::as_u64).unwrap_or(1);
    blocking(move || {
        let db = open(&state)?;
        let id = require_account(&db, &account)?;
        let summary = db
            .get_wallet_summary(confirmations(minconf))
            .map_err(anyhow::Error::from)?
            .ok_or_else(|| {
                RpcError::new(-1, "The wallet has not synced enough to report a balance")
            })?;
        let zero = zcash_client_backend::data_api::AccountBalance::ZERO;
        let b = summary.account_balances().get(&id).unwrap_or(&zero);
        Ok(json!({
            "pools": {
                "transparent": { "valueZat": b.unshielded_balance().spendable_value().into_u64() },
                "sapling": { "valueZat": b.sapling_balance().spendable_value().into_u64() },
                "orchard": { "valueZat": b.orchard_balance().spendable_value().into_u64() },
                "ironwood": { "valueZat": b.ironwood_balance().spendable_value().into_u64() },
            },
            "total_zat": b.total().into_u64(),
            "minimum_confirmations": minconf.max(1),
        }))
    })
    .await
}

async fn pczt_create(state: Arc<AppState>, params: Vec<Value>) -> RpcResult {
    let account = str_param(&params, 0, "from")?.to_owned();
    let amounts = param(&params, 1)
        .and_then(Value::as_array)
        .filter(|a| !a.is_empty())
        .ok_or_else(|| RpcError::params("amounts must be a non-empty array"))?
        .clone();
    let minconf = param(&params, 2).and_then(Value::as_u64).unwrap_or(1);
    policy::require_full_privacy(param(&params, 3).and_then(Value::as_str))
        .map_err(RpcError::policy)?;
    policy::require_fund_source(param(&params, 4).and_then(Value::as_str))
        .map_err(RpcError::policy)?;

    let network_type = state.config.network.params().network_type();
    let mut payments = Vec::with_capacity(amounts.len());
    for (i, entry) in amounts.iter().enumerate() {
        let address = entry
            .get("address")
            .and_then(Value::as_str)
            .ok_or_else(|| RpcError::params(format!("amounts[{i}].address is required")))?;
        let recipient = policy::check_recipient(address, network_type).map_err(RpcError::policy)?;
        let zat = policy::parse_zec_amount(entry.get("amount").unwrap_or(&Value::Null))
            .map_err(RpcError::policy)?;
        let memo = match entry.get("memo").and_then(Value::as_str) {
            Some(h) => {
                let bytes = hex::decode(h)
                    .map_err(|_| RpcError::params(format!("amounts[{i}].memo must be hex")))?;
                Some(
                    MemoBytes::from_bytes(&bytes)
                        .map_err(|_| RpcError::params(format!("amounts[{i}].memo is too long")))?,
                )
            }
            None => None,
        };
        let amount =
            Zatoshis::from_u64(zat).map_err(|_| RpcError::params("amount out of range"))?;
        payments.push(
            Payment::new(recipient, Some(amount), memo, None, None, vec![])
                .map_err(|e| RpcError::params(format!("amounts[{i}]: {e:?}")))?,
        );
    }
    let request =
        TransactionRequest::new(payments).map_err(|e| RpcError::params(format!("{e:?}")))?;

    let st = state.clone();
    let bytes = blocking(move || {
        let mut db = open(&st)?;
        let id = require_account(&db, &account)?;
        let params = *db.params();
        let change = MultiOutputChangeStrategy::new(
            StandardFeeRule::Zip317,
            None,
            ShieldedPool::Orchard,
            DustOutputPolicy::default(),
            SplitPolicy::single_output(),
        );
        let proposal =
            propose_transfer::<_, _, _, _, zcash_client_sqlite::wallet::commitment_tree::Error>(
                &mut db,
                &params,
                id,
                &GreedyInputSelector::new(),
                &change,
                request,
                confirmations(minconf),
                // Ironwood notes only: no legacy Orchard (crossing reveals the amount), no Sapling, and no
                // transparent inputs.
                &SpendPolicy::shielded_pools([ShieldedPool::Ironwood]),
                None,
                None,
            )
            .map_err(|e| {
                let text = format!("{e}");
                if text.to_lowercase().contains("insufficient") {
                    RpcError::new(-6, format!("Insufficient funds: {text}"))
                } else {
                    RpcError::new(-4, text)
                }
            })?;
        let pczt = create_pczt_from_proposal::<
            _,
            _,
            zcash_client_backend::data_api::wallet::input_selection::GreedyInputSelectorError,
            _,
            zcash_primitives::transaction::fees::zip317::FeeError,
            _,
        >(
            &mut db,
            &params,
            &zcash_client_sqlite::util::SystemClock,
            &mut UnwrapErr(SysRng),
            id,
            OvkPolicy::Sender,
            &proposal,
            None,
            zcash_primitives::transaction::builder::BundlePadding::DEFAULT,
        )
        .map_err(|e| RpcError::new(-4, format!("{e}")))?;
        let (bytes, _) = encode_pczt(pczt)?;
        Ok(bytes)
    })
    .await?;
    let (_, check) = decode_pczt(&B64.encode(&bytes))?;
    let inspection = inspect::inspect(&check, None, true);
    if check.has_data_in_pool(zcash_protocol::PoolType::TRANSPARENT)
        || check.has_data_in_pool(zcash_protocol::PoolType::SAPLING)
        || inspection["orchard"]["outputs"]
            .as_array()
            .is_some_and(|o| !o.is_empty())
    {
        return Err(RpcError::new(
            -8,
            "The wallet built a transaction that is not confined to the Ironwood pool",
        ));
    }
    state.remember_full_privacy(&bytes).await;
    info!(outputs = amounts.len(), "pczt created");
    Ok(json!({ "pczt": B64.encode(&bytes), "privacy_policy": policy::FULL_PRIVACY }))
}

async fn pczt_inspect(state: &AppState, params: Vec<Value>) -> RpcResult {
    let (bytes, pczt) = decode_pczt(str_param(&params, 0, "pczt")?)?;
    let ours = state.is_full_privacy(&bytes).await;
    let policy = ours.then_some(policy::FULL_PRIVACY);
    Ok(inspect::inspect(&pczt, policy, ours))
}

async fn pczt_prove(state: Arc<AppState>, params: Vec<Value>) -> RpcResult {
    let (bytes, pczt) = decode_pczt(str_param(&params, 0, "pczt")?)?;
    if !pczt.sapling().spends().is_empty() {
        return Err(RpcError::new(
            -8,
            "Sapling spends are outside this signer's FullPrivacy policy",
        ));
    }
    let ours = state.is_full_privacy(&bytes).await;
    let (proved, flags) = blocking(move || {
        let raw_branch_id = *pczt.global().consensus_branch_id();
        let mut prover = Prover::new(pczt);
        let needs_orchard = prover.requires_orchard_proof();
        let needs_ironwood = prover.requires_ironwood_proof();
        if needs_orchard || needs_ironwood {
            let branch_id = BranchId::try_from(raw_branch_id)
                .map_err(|_| RpcError::new(-8, "PCZT has an unknown consensus branch"))?;
            // Orchard and Ironwood share one circuit per branch, so one key serves both bundles.
            let version =
                zcash_primitives::transaction::components::orchard::bundle_version_for_branch(
                    branch_id,
                    orchard::ValuePool::Orchard,
                )
                .ok_or_else(|| {
                    RpcError::new(-8, "PCZT branch does not support Orchard-family proofs")
                })?
                .circuit_version();
            let pk = orchard::circuit::ProvingKey::build(version);
            if needs_orchard {
                prover = prover
                    .create_orchard_proof(UnwrapErr(SysRng), &pk)
                    .map_err(|e| RpcError::new(-1, format!("Orchard proof failed: {e:?}")))?;
            }
            if needs_ironwood {
                prover = prover
                    .create_ironwood_proof(UnwrapErr(SysRng), &pk)
                    .map_err(|e| RpcError::new(-1, format!("Ironwood proof failed: {e:?}")))?;
            }
        }
        let sapling_needed = prover.requires_sapling_proofs();
        let local = LocalTxProver::bundled();
        let pczt = prover
            .create_sapling_proofs(UnwrapErr(SysRng), &local, &local)
            .map_err(|e| RpcError::new(-1, format!("Sapling proof failed: {e:?}")))?
            .finish();
        Ok((pczt, (sapling_needed, needs_orchard, needs_ironwood)))
    })
    .await?;
    let (out_bytes, text) = encode_pczt(proved)?;
    if ours {
        state.remember_full_privacy(&out_bytes).await;
    }
    Ok(
        json!({ "pczt": text, "sapling_proven": flags.0, "orchard_proven": flags.1, "ironwood_proven": flags.2 }),
    )
}

enum SpendRef {
    Orchard(usize),
    Ironwood(usize),
}

async fn pczt_sign(state: Arc<AppState>, params: Vec<Value>) -> RpcResult {
    let (bytes, pczt) = decode_pczt(str_param(&params, 0, "pczt")?)?;
    policy::require_full_privacy(param(&params, 1).and_then(Value::as_str))
        .map_err(RpcError::policy)?;
    if !state.is_full_privacy(&bytes).await {
        return Err(RpcError::new(
            -8,
            "Refusing to sign a PCZT this signer did not build under FullPrivacy",
        ));
    }
    if !pczt.transparent().inputs().is_empty() || !pczt.sapling().spends().is_empty() {
        return Err(RpcError::new(
            -8,
            "Only Ironwood spends can be signed under this signer's policy",
        ));
    }
    let st = state.clone();
    let (signed, counts, unsigned) = blocking(move || {
        let params = st.config.network.params();
        let seed = st.data.seed()?;
        let seed_fp = SeedFingerprint::from_seed(seed.expose_secret())
            .ok_or_else(|| RpcError::new(-1, "invalid seed"))?;
        let coin_type = zip32::ChildIndex::hardened(params.network_type().coin_type());
        let mut keys = BTreeMap::<zip32::AccountId, Vec<SpendRef>>::new();
        let pczt = Verifier::new(pczt)
            .with_orchard::<Infallible, _>(|bundle| {
                for (i, action) in bundle.actions().iter().enumerate() {
                    if let Some(account) = action
                        .spend()
                        .zip32_derivation()
                        .as_ref()
                        .and_then(|d| d.extract_account_index(&seed_fp, coin_type))
                    {
                        keys.entry(account).or_default().push(SpendRef::Orchard(i));
                    }
                }
                Ok(())
            })
            .map_err(|e| RpcError::new(-8, format!("invalid PCZT: {e:?}")))?
            .with_ironwood::<Infallible, _>(|bundle| {
                for (i, action) in bundle.actions().iter().enumerate() {
                    if let Some(account) = action
                        .spend()
                        .zip32_derivation()
                        .as_ref()
                        .and_then(|d| d.extract_account_index(&seed_fp, coin_type))
                    {
                        keys.entry(account).or_default().push(SpendRef::Ironwood(i));
                    }
                }
                Ok(())
            })
            .map_err(|e| RpcError::new(-8, format!("invalid PCZT: {e:?}")))?
            .finish();

        let mut signer = Signer::new(pczt)
            .map_err(|e| RpcError::new(-1, format!("cannot start signer: {e:?}")))?;
        let (mut orchard_signed, mut ironwood_signed) = (0usize, 0usize);
        for (account, spends) in keys {
            let usk = UnifiedSpendingKey::from_seed(&params, seed.expose_secret(), account)
                .map_err(|e| RpcError::new(-1, format!("key derivation failed: {e:?}")))?;
            let ask = orchard::keys::SpendAuthorizingKey::from(usk.orchard());
            for spend in spends {
                match spend {
                    SpendRef::Orchard(i) => {
                        signer
                            .sign_orchard(UnwrapErr(SysRng), i, &ask)
                            .map_err(|e| RpcError::new(-1, format!("Orchard spend {i}: {e:?}")))?;
                        orchard_signed += 1;
                    }
                    SpendRef::Ironwood(i) => {
                        signer
                            .sign_ironwood(UnwrapErr(SysRng), i, &ask)
                            .map_err(|e| RpcError::new(-1, format!("Ironwood spend {i}: {e:?}")))?;
                        ironwood_signed += 1;
                    }
                }
            }
        }
        let pczt = signer.finish();
        let unsigned = |bundle: &pczt::orchard::Bundle| -> Vec<usize> {
            bundle
                .actions()
                .iter()
                .enumerate()
                .filter(|(_, a)| a.spend().spend_auth_sig().is_none())
                .map(|(i, _)| i)
                .collect()
        };
        let lists = (unsigned(pczt.orchard()), unsigned(pczt.ironwood()));
        Ok((pczt, (orchard_signed, ironwood_signed), lists))
    })
    .await?;
    let (out_bytes, text) = encode_pczt(signed)?;
    state.remember_full_privacy(&out_bytes).await;
    Ok(json!({
        "pczt": text,
        "transparent_signed": 0,
        "sapling_signed": 0,
        "orchard_signed": counts.0,
        "ironwood_signed": counts.1,
        "unsigned_transparent": [],
        "unsigned_sapling": [],
        "unsigned_orchard": unsigned.0,
        "unsigned_ironwood": unsigned.1,
    }))
}

async fn pczt_extract(state: Arc<AppState>, params: Vec<Value>) -> RpcResult {
    let (bytes, pczt) = decode_pczt(str_param(&params, 0, "pczt")?)?;
    if !state.is_full_privacy(&bytes).await {
        return Err(RpcError::new(
            -8,
            "Refusing to extract a PCZT this signer did not build under FullPrivacy",
        ));
    }
    let _guard = state.write_lock.lock().await;
    let st = state.clone();
    blocking(move || {
        let mut db = open(&st)?;
        let prover = LocalTxProver::bundled();
        let (spend_vk, output_vk) = prover.verifying_keys();
        let txid = extract_and_store_transaction_from_pczt::<_, ()>(
            &mut db,
            &zcash_client_sqlite::util::SystemClock,
            &mut UnwrapErr(SysRng),
            pczt,
            Some((&spend_vk, &output_vk)),
            None,
        )
        .map_err(|e| RpcError::new(-1, format!("extraction failed: {e:?}")))?;
        let tx = db
            .get_transaction(txid)
            .map_err(anyhow::Error::from)?
            .ok_or_else(|| RpcError::new(-1, "extracted transaction was not stored"))?;
        let mut raw = vec![];
        tx.write(&mut raw)
            .map_err(|e| RpcError::new(-1, format!("cannot serialize transaction: {e}")))?;
        Ok(json!({ "hex": hex::encode(raw), "txid": txid.to_string(), "stored": true }))
    })
    .await
}

async fn view_transaction(state: Arc<AppState>, params: Vec<Value>) -> RpcResult {
    let txid = parse_txid(str_param(&params, 0, "txid")?)?;
    let tip = chain_tip(&state).await.ok().map(|(h, _)| h);
    blocking(move || {
        let db = open(&state)?;
        let height = db.get_tx_height(txid).map_err(anyhow::Error::from)?;
        let known = height.is_some()
            || db
                .get_transaction(txid)
                .map_err(anyhow::Error::from)?
                .is_some();
        if !known {
            return Err(RpcError::new(-5, "Invalid or non-wallet transaction id"));
        }
        let confirmations = match (height, tip) {
            (Some(h), Some(t)) => t.saturating_sub(u64::from(u32::from(h))) + 1,
            _ => 0,
        };
        Ok(json!({
            "txid": txid.to_string(),
            "status": if height.is_some() { "mined" } else { "waiting" },
            "confirmations": confirmations,
            "outputs": [],
        }))
    })
    .await
}

async fn list_transactions(state: Arc<AppState>, params: Vec<Value>) -> RpcResult {
    let account = str_param(&params, 0, "account")?.to_owned();
    let limit = param(&params, 4)
        .and_then(Value::as_u64)
        .unwrap_or(50)
        .min(500);
    let tip = chain_tip(&state).await.ok().map(|(h, _)| h);
    blocking(move || {
        let db = open(&state)?;
        let id = require_account(&db, &account)?;
        drop(db);
        let conn = rusqlite::Connection::open_with_flags(state.data.wallet_db(), rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|e| RpcError::new(-1, format!("{e}")))?;
        let mut stmt = conn
            .prepare(
                "SELECT txid, mined_height, account_balance_delta, fee_paid, block_time, expired_unmined
                 FROM v_transactions WHERE account_uuid = ?1
                 ORDER BY mined_height IS NOT NULL, mined_height DESC LIMIT ?2",
            )
            .map_err(|e| RpcError::new(-1, format!("{e}")))?;
        let rows = stmt
            .query_map(rusqlite::params![id.expose_uuid().as_bytes().to_vec(), limit as i64], |row| {
                let txid: Vec<u8> = row.get(0)?;
                let height: Option<u32> = row.get(1)?;
                let delta: i64 = row.get(2)?;
                let fee: Option<i64> = row.get(3)?;
                let block_time: Option<i64> = row.get(4)?;
                let expired: bool = row.get::<_, Option<bool>>(5)?.unwrap_or(false);
                Ok((txid, height, delta, fee, block_time, expired))
            })
            .map_err(|e| RpcError::new(-1, format!("{e}")))?;
        let mut out = vec![];
        for row in rows {
            let (txid, height, delta, fee, block_time, expired) = row.map_err(|e| RpcError::new(-1, format!("{e}")))?;
            let confirmations = match (height, tip) {
                (Some(h), Some(t)) => t.saturating_sub(u64::from(h)) + 1,
                _ => 0,
            };
            let status = if height.is_some() { "mined" } else if expired { "expired" } else { "waiting" };
            out.push(json!({
                "txid": display_hash(&txid),
                "status": status,
                "mined_height": height,
                "confirmations": confirmations,
                "account_balance_delta": delta,
                "fee_zat": fee,
                "block_time": block_time,
            }));
        }
        Ok(Value::Array(out))
    })
    .await
}

async fn lightd_info(state: &AppState) -> Result<service::LightdInfo, RpcError> {
    let mut client = state.client().await?;
    match client.get_lightd_info(Empty {}).await {
        Ok(r) => Ok(r.into_inner()),
        Err(e) => {
            state.drop_client().await;
            Err(e.into())
        }
    }
}

async fn blockchain_info(state: &AppState) -> RpcResult {
    let info = lightd_info(state).await?;
    let expected = state.config.network.chain();
    if info.chain_name != expected {
        return Err(RpcError::new(
            -1,
            format!(
                "lightwalletd serves {:?}, but the signer is configured for {expected:?}",
                info.chain_name
            ),
        ));
    }
    let (_, hash) = chain_tip(state).await?;
    let estimated = if info.estimated_height > 0 {
        info.estimated_height
    } else {
        info.block_height
    };
    Ok(
        json!({ "chain": expected, "blocks": info.block_height, "estimatedheight": estimated, "bestblockhash": hash }),
    )
}

async fn get_info(state: &AppState) -> RpcResult {
    let label = match lightd_info(state).await {
        Ok(info) => {
            let backend = if info.zcashd_subversion.is_empty() {
                info.zcashd_build.clone()
            } else {
                info.zcashd_subversion.clone()
            };
            format!("{} {} {}", info.vendor, info.version, backend)
                .trim()
                .to_owned()
        }
        Err(e) => return Err(e),
    };
    *state.server_label.write().await = Some(label.clone());
    let version = env!("CARGO_PKG_VERSION");
    Ok(json!({
        "build": format!("setrya-signer {version} via lightwalletd {} ({label})", state.config.lightwalletd),
        "subversion": format!("/setrya-signer:{version}/"),
        "testnet": state.config.network.chain() == "test",
    }))
}

async fn send_raw_transaction(state: &AppState, params: Vec<Value>) -> RpcResult {
    let raw = hex::decode(str_param(&params, 0, "hexstring")?)
        .map_err(|_| RpcError::params("hexstring must be hex"))?;
    let (tip, _) = chain_tip(state).await?;
    let network = state.config.network.params();
    let branch = BranchId::for_height(
        &network,
        BlockHeight::from_u32(u32::try_from(tip + 1).unwrap_or(u32::MAX)),
    );
    let tx = Transaction::read(&raw[..], branch)
        .map_err(|e| RpcError::new(-22, format!("TX decode failed: {e}")))?;
    let txid = tx.txid().to_string();
    let mut client = state.client().await?;
    let response = client
        .send_transaction(RawTransaction {
            data: raw,
            height: 0,
        })
        .await
        .map_err(RpcError::from)?
        .into_inner();
    if response.error_code != 0 {
        return Err(RpcError::new(-26, response.error_message));
    }
    info!("transaction submitted");
    Ok(json!(txid))
}

async fn get_raw_transaction(state: &AppState, params: Vec<Value>) -> RpcResult {
    let txid = parse_txid(str_param(&params, 0, "txid")?)?;
    let mut client = state.client().await?;
    let filter = TxFilter {
        block: None,
        index: 0,
        hash: txid.as_ref().to_vec(),
    };
    let raw = match client.get_transaction(filter).await {
        Ok(r) => r.into_inner(),
        Err(s)
            if s.code() == tonic::Code::NotFound
                || s.message().to_lowercase().contains("no such")
                || s.message().to_lowercase().contains("not found") =>
        {
            return Err(RpcError::not_found());
        }
        Err(s) => return Err(s.into()),
    };
    let mut out = json!({ "txid": txid.to_string(), "hex": hex::encode(&raw.data) });
    // lightwalletd reports 0 for mempool transactions and u64::MAX for ones off the main chain.
    if raw.height == u64::MAX {
        return Err(RpcError::not_found());
    }
    if raw.height > 0 {
        let (tip, _) = chain_tip(state).await?;
        let block = client
            .get_block(BlockId {
                height: raw.height,
                hash: vec![],
            })
            .await
            .map_err(RpcError::from)?
            .into_inner();
        out["height"] = json!(raw.height);
        out["confirmations"] = json!(tip.saturating_sub(raw.height) + 1);
        out["blockhash"] = json!(display_hash(&block.hash));
    }
    Ok(out)
}

async fn raw_mempool(state: &AppState) -> RpcResult {
    let mut client = state.client().await?;
    let mut stream = client
        .get_mempool_tx(GetMempoolTxRequest {
            exclude_txid_suffixes: vec![],
            ..Default::default()
        })
        .await
        .map_err(RpcError::from)?
        .into_inner();
    let mut txids = vec![];
    while let Some(tx) = stream.message().await.map_err(RpcError::from)? {
        txids.push(display_hash(&tx.txid));
    }
    Ok(json!(txids))
}
