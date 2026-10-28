//! Wallet database access. Every caller opens its own connection; SQLite in WAL mode with a
//! busy timeout lets the sync loop write while RPC handlers read.

use std::{path::Path, time::Duration};

use anyhow::anyhow;
use rand::{rand_core::UnwrapErr, rngs::SysRng};
use zcash_client_backend::data_api::{Account as _, WalletRead};
use zcash_client_sqlite::{AccountUuid, WalletDb, util::SystemClock};
use zcash_keys::keys::UnifiedAddressRequest;
use zcash_protocol::consensus::Network;

pub type Db = WalletDb<rusqlite::Connection, Network, SystemClock, UnwrapErr<SysRng>>;

pub const ACCOUNT_NAME: &str = "payer";

pub fn open(path: &Path, params: Network) -> anyhow::Result<Db> {
    let conn = rusqlite::Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.busy_timeout(Duration::from_secs(30))?;
    rusqlite::vtab::array::load_module(&conn)?;
    Ok(WalletDb::from_connection(
        conn,
        params,
        SystemClock,
        UnwrapErr(SysRng),
    ))
}

/// The single spending account this signer manages.
pub fn payer(db: &Db) -> anyhow::Result<AccountUuid> {
    let ids = db.get_account_ids()?;
    match ids.as_slice() {
        [id] => Ok(*id),
        [] => Err(anyhow!("the wallet has no account; run `init`")),
        _ => Err(anyhow!(
            "the wallet has more than one account; this signer expects exactly one"
        )),
    }
}

pub fn account_name(db: &Db, id: AccountUuid) -> anyhow::Result<Option<String>> {
    Ok(db
        .get_account(id)?
        .and_then(|a| a.name().map(str::to_owned)))
}

/// The Orchard-only receiving address. Reuses the last one generated so repeated calls do not mint
/// a new diversified address each time; funds sent to it land in the Ironwood pool.
pub fn orchard_address(db: &mut Db, id: AccountUuid) -> anyhow::Result<String> {
    use zcash_client_backend::data_api::WalletWrite;
    let params = *db.params();
    if let Some(ua) = db.get_last_generated_address_matching(id, UnifiedAddressRequest::ORCHARD)? {
        return Ok(ua.encode(&params));
    }
    let (ua, _) = db
        .get_next_available_address(id, UnifiedAddressRequest::ORCHARD)?
        .ok_or_else(|| anyhow!("the account cannot derive an Orchard address"))?;
    Ok(ua.encode(&params))
}

/// A Sapling-only receiving address, for funders whose wallets cannot create Orchard or Ironwood
/// outputs (some faucets). Sapling funds cannot pay under FullPrivacy until they are moved into
/// Ironwood, which reveals the amount crossing pools.
pub fn sapling_address(db: &mut Db, id: AccountUuid) -> anyhow::Result<String> {
    use zcash_client_backend::data_api::WalletWrite;
    use zcash_keys::{
        encoding::encode_payment_address,
        keys::ReceiverRequirement::{Omit, Require},
    };
    use zcash_protocol::consensus::Parameters;
    let params = *db.params();
    let request = UnifiedAddressRequest::unsafe_custom(Omit, Require, Omit);
    let ua = match db.get_last_generated_address_matching(id, request)? {
        Some(ua) => ua,
        None => {
            db.get_next_available_address(id, request)?
                .ok_or_else(|| anyhow!("the account cannot derive a Sapling address"))?
                .0
        }
    };
    let sapling = ua
        .sapling()
        .ok_or_else(|| anyhow!("derived address has no Sapling receiver"))?;
    Ok(encode_payment_address(
        zcash_address::constants::hrp_sapling_payment_address(params.network_type()),
        sapling,
    ))
}

/// A transparent P2PKH receiving address, for funders that can only pay transparent addresses.
/// Everything about a transparent payment is public, and it must be shielded into Ironwood before it can pay.
pub fn transparent_address(db: &mut Db, id: AccountUuid) -> anyhow::Result<String> {
    use zcash_client_backend::data_api::WalletWrite;
    use zcash_keys::{
        encoding::AddressCodec,
        keys::ReceiverRequirement::{Omit, Require},
    };
    let params = *db.params();
    let request = UnifiedAddressRequest::unsafe_custom(Require, Omit, Require);
    let ua = match db.get_last_generated_address_matching(id, request)? {
        Some(ua) => ua,
        None => {
            db.get_next_available_address(id, request)?
                .ok_or_else(|| anyhow!("the account cannot derive a transparent address"))?
                .0
        }
    };
    let taddr = ua
        .transparent()
        .ok_or_else(|| anyhow!("derived address has no transparent receiver"))?;
    Ok(taddr.encode(&params))
}
