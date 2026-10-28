//! setrya-signer: a light-client Zcash wallet that builds, inspects, proves, signs and broadcasts
//! fully shielded (Ironwood-only) PCZTs, served over a Zallet-compatible JSON-RPC subset.

mod config;
mod inspect;
mod lwd;
mod methods;
mod policy;
mod rpc;
mod state;
mod sync;
mod wallet;

use std::{io::IsTerminal, net::SocketAddr, path::PathBuf, sync::Arc};

use anyhow::{Context, anyhow, bail};
use bip0039::{Count, English, Mnemonic};
use clap::{Parser, Subcommand};
use rand::{
    rand_core::{Rng as _, UnwrapErr},
    rngs::SysRng,
};
use secrecy::{ExposeSecret, SecretString, SecretVec};
use tracing::info;
use zcash_client_backend::{
    data_api::{AccountBirthday, WalletWrite, wallet::ConfirmationsPolicy},
    proto::service::{BlockId, ChainSpec},
};
use zcash_client_sqlite::wallet::init::init_wallet_db;
use zcash_protocol::consensus::{NetworkUpgrade, Parameters};
use zeroize::Zeroize;

use crate::config::{Config, DataDir, NetworkName};

#[derive(Parser)]
#[command(name = "setrya-signer", version, about)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Clone, Copy, clap::ValueEnum)]
enum Receiver {
    Orchard,
    Sapling,
    Transparent,
}

#[derive(Subcommand)]
enum Command {
    /// Create a wallet: one "payer" account, its seed encrypted at rest.
    Init {
        #[arg(long)]
        network: NetworkName,
        #[arg(long)]
        data_dir: PathBuf,
        /// Wallet birthday height (default: chain tip minus 100).
        #[arg(long)]
        birthday: Option<u32>,
        /// lightwalletd server as host:port (default: zec.rocks for the network).
        #[arg(long)]
        lightwalletd: Option<String>,
        /// Route lightwalletd traffic through this SOCKS5 proxy, e.g. Tor at 127.0.0.1:9050.
        #[arg(long)]
        socks5: Option<SocketAddr>,
    },
    /// Sync continuously and serve JSON-RPC.
    Serve {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long, default_value = "127.0.0.1:28232")]
        listen: SocketAddr,
        /// Permit a private-network listen address, such as a container network.
        #[arg(long)]
        allow_private_bind: bool,
        /// Where to write the RPC cookie (default: DATA_DIR/.cookie).
        #[arg(long)]
        cookie_file: Option<PathBuf>,
        /// Write the cookie as 0640 so a client sharing the signer's group can read it.
        #[arg(long)]
        cookie_group_readable: bool,
    },
    /// Print a receiving address: Orchard-only by default (funds land in Ironwood). Sapling and
    /// transparent are for funders that cannot create Orchard or Ironwood outputs.
    Address {
        #[arg(long)]
        data_dir: PathBuf,
        #[arg(long, value_enum, default_value_t = Receiver::Orchard)]
        receiver: Receiver,
    },
    /// Print spendable balances in zatoshis.
    Balance {
        #[arg(long)]
        data_dir: PathBuf,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    rustls::crypto::ring::default_provider()
        .install_default()
        .map_err(|_| anyhow!("a TLS crypto provider was already installed"))?;
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,zcash_client_backend=warn".into()),
        )
        .with_writer(std::io::stderr)
        .init();

    match Cli::parse().command {
        Command::Init {
            network,
            data_dir,
            birthday,
            lightwalletd,
            socks5,
        } => {
            init(
                network,
                DataDir::new(data_dir),
                birthday,
                lightwalletd,
                socks5,
            )
            .await
        }
        Command::Serve {
            data_dir,
            listen,
            allow_private_bind,
            cookie_file,
            cookie_group_readable,
        } => {
            let data = DataDir::new(data_dir);
            let cookie_path = cookie_file.unwrap_or_else(|| data.cookie());
            serve(
                data,
                listen,
                allow_private_bind,
                cookie_path,
                cookie_group_readable,
            )
            .await
        }
        Command::Address { data_dir, receiver } => {
            let data = DataDir::new(data_dir);
            let config = data.read_config()?;
            let mut db = wallet::open(&data.wallet_db(), config.network.params())?;
            let id = wallet::payer(&db)?;
            let address = match receiver {
                Receiver::Orchard => wallet::orchard_address(&mut db, id)?,
                Receiver::Sapling => wallet::sapling_address(&mut db, id)?,
                Receiver::Transparent => wallet::transparent_address(&mut db, id)?,
            };
            println!("{address}");
            Ok(())
        }
        Command::Balance { data_dir } => {
            use zcash_client_backend::data_api::WalletRead;
            let data = DataDir::new(data_dir);
            let config = data.read_config()?;
            let db = wallet::open(&data.wallet_db(), config.network.params())?;
            let id = wallet::payer(&db)?;
            let summary = db
                .get_wallet_summary(ConfirmationsPolicy::default())?
                .ok_or_else(|| anyhow!("the wallet has not synced yet"))?;
            let b = summary
                .account_balances()
                .get(&id)
                .ok_or_else(|| anyhow!("no balance for the payer account"))?;
            println!(
                "{}",
                serde_json::json!({
                    "chain_tip_height": u32::from(summary.chain_tip_height()),
                    "ironwood_spendable": b.ironwood_balance().spendable_value().into_u64(),
                    "orchard_spendable": b.orchard_balance().spendable_value().into_u64(),
                    "sapling_spendable": b.sapling_balance().spendable_value().into_u64(),
                    "transparent_spendable": b.unshielded_balance().spendable_value().into_u64(),
                    "total": b.total().into_u64(),
                })
            );
            Ok(())
        }
    }
}

fn read_or_generate_mnemonic() -> anyhow::Result<(Mnemonic<English>, bool)> {
    if std::io::stdin().is_terminal() {
        return Ok((Mnemonic::generate(Count::Words24), false));
    }
    let mut line = String::new();
    std::io::stdin().read_line(&mut line)?;
    let phrase = SecretString::new(line.trim().to_owned());
    line.zeroize();
    if phrase.expose_secret().is_empty() {
        return Ok((Mnemonic::generate(Count::Words24), false));
    }
    Ok((
        <Mnemonic<English>>::from_phrase(phrase.expose_secret())?,
        true,
    ))
}

async fn init(
    network: NetworkName,
    data: DataDir,
    birthday: Option<u32>,
    lightwalletd: Option<String>,
    socks5: Option<SocketAddr>,
) -> anyhow::Result<()> {
    if data.exists() {
        bail!("{} already contains a signer wallet", data.root().display());
    }
    let params = network.params();
    let mut config = Config {
        network,
        lightwalletd: lightwalletd.unwrap_or_else(|| network.default_server().to_owned()),
        socks5,
        birthday: 0,
    };
    let mut client = lwd::connect(&config)
        .await
        .context("cannot reach lightwalletd")?;
    let tip = u32::try_from(
        client
            .get_latest_block(ChainSpec::default())
            .await?
            .into_inner()
            .height,
    )?;
    let (mnemonic, restored) = read_or_generate_mnemonic()?;

    let sapling = u32::from(
        params
            .activation_height(NetworkUpgrade::Sapling)
            .ok_or_else(|| anyhow!("no Sapling activation"))?,
    );
    let height = birthday.unwrap_or(tip.saturating_sub(100)).max(sapling + 1);
    // The birthday is the chain state as of the block before it. Fetching it tells the server the
    // birthday height, which is unavoidable for a light client.
    let tree = client
        .get_tree_state(BlockId {
            height: u64::from(height - 1),
            hash: vec![],
        })
        .await?
        .into_inner();
    let recover_until = restored.then(|| tip.into());
    let birthday = AccountBirthday::from_treestate(tree, recover_until)
        .map_err(|_| anyhow!("lightwalletd returned an invalid tree state"))?;
    config.birthday = height;

    data.store_mnemonic(&mnemonic)?;
    data.write_config(&config)?;

    let seed = {
        let mut raw = mnemonic.to_seed("");
        let secret = SecretVec::new(raw.to_vec());
        raw.zeroize();
        secret
    };
    let mut db = wallet::open(&data.wallet_db(), params)?;
    init_wallet_db(&mut db, None).map_err(|e| anyhow!("wallet database init failed: {e:?}"))?;
    let (id, _) = db.create_account(wallet::ACCOUNT_NAME, &seed, &birthday, None)?;
    let address = wallet::orchard_address(&mut db, id)?;

    eprintln!();
    eprintln!("================================================================================");
    eprintln!(" WALLET RECOVERY PHRASE. Write it down offline now. It is shown only this once.");
    eprintln!(" Anyone with these words can spend this wallet's funds.");
    eprintln!("================================================================================");
    if !restored {
        eprintln!("{}", mnemonic.phrase());
    } else {
        eprintln!("(restored from the phrase you supplied)");
    }
    eprintln!("================================================================================");
    eprintln!("network:        {}", network.chain());
    eprintln!("birthday:       {height}");
    eprintln!("account uuid:   {}", id.expose_uuid());
    eprintln!("orchard address (receives into Ironwood):");
    eprintln!("{address}");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let term = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut s) => {
                s.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let term = std::future::pending::<()>();
    tokio::select! { _ = ctrl_c => {}, _ = term => {} }
}

async fn serve(
    data: DataDir,
    listen: SocketAddr,
    allow_private_bind: bool,
    cookie_path: PathBuf,
    cookie_group_readable: bool,
) -> anyhow::Result<()> {
    policy::check_listen(listen, allow_private_bind)?;
    let config = data.read_config()?;
    {
        let db = wallet::open(&data.wallet_db(), config.network.params())?;
        wallet::payer(&db)?;
    }

    let mut secret = [0u8; 32];
    UnwrapErr(SysRng).fill_bytes(&mut secret);
    let cookie = SecretString::new(hex::encode(secret));
    secret.zeroize();
    data.write_cookie(&cookie_path, &cookie, cookie_group_readable)?;

    let state = Arc::new(state::AppState::new(config, data));
    tokio::spawn(sync::run_forever(state.clone(), state.sync.clone()));

    let app = rpc::router(state.clone(), &cookie);
    let listener = tokio::net::TcpListener::bind(listen).await?;
    info!(%listen, network = state.config.network.chain(), "setrya-signer serving");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    let _ = std::fs::remove_file(&cookie_path);
    Ok(())
}
