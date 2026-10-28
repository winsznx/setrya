//! On-disk layout of a signer data directory.
//!
//! ```text
//! DIR/config.toml     network, lightwalletd server, optional SOCKS proxy, birthday
//! DIR/identity.txt    age x25519 identity (0600) that decrypts the seed
//! DIR/seed.age        the wallet mnemonic, age-encrypted to identity.txt
//! DIR/wallet.sqlite   zcash_client_sqlite wallet database
//! DIR/.cookie         RPC credential, rewritten on every `serve`
//! ```

use std::{
    fs,
    io::{Read, Write},
    net::SocketAddr,
    path::{Path, PathBuf},
    str::FromStr,
};

use age::secrecy::ExposeSecret as _;
use anyhow::{Context, anyhow, bail};
use bip0039::{English, Mnemonic};
use secrecy::{ExposeSecret, SecretString, SecretVec};
use serde::{Deserialize, Serialize};
use zcash_protocol::consensus::Network;
use zeroize::Zeroize;

const CONFIG_FILE: &str = "config.toml";
const IDENTITY_FILE: &str = "identity.txt";
const SEED_FILE: &str = "seed.age";
const WALLET_DB: &str = "wallet.sqlite";
pub const COOKIE_FILE: &str = ".cookie";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NetworkName {
    Test,
    Main,
}

impl NetworkName {
    pub fn params(self) -> Network {
        match self {
            NetworkName::Test => Network::TestNetwork,
            NetworkName::Main => Network::MainNetwork,
        }
    }

    /// The `chain` string Zebra's `getblockchaininfo` reports.
    pub fn chain(self) -> &'static str {
        match self {
            NetworkName::Test => "test",
            NetworkName::Main => "main",
        }
    }

    pub fn default_server(self) -> &'static str {
        match self {
            NetworkName::Test => "testnet.zec.rocks:443",
            NetworkName::Main => "zec.rocks:443",
        }
    }
}

impl FromStr for NetworkName {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "test" | "testnet" => Ok(NetworkName::Test),
            "main" | "mainnet" => Ok(NetworkName::Main),
            other => bail!("unknown network {other:?}; use \"test\" or \"main\""),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Config {
    pub network: NetworkName,
    /// lightwalletd endpoint as `host:port`.
    pub lightwalletd: String,
    /// Optional SOCKS5 proxy (for example a local Tor daemon) for every lightwalletd connection.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub socks5: Option<SocketAddr>,
    pub birthday: u32,
}

pub struct DataDir {
    root: PathBuf,
}

impl DataDir {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn wallet_db(&self) -> PathBuf {
        self.root.join(WALLET_DB)
    }

    pub fn cookie(&self) -> PathBuf {
        self.root.join(COOKIE_FILE)
    }

    pub fn exists(&self) -> bool {
        self.root.join(CONFIG_FILE).exists()
    }

    pub fn read_config(&self) -> anyhow::Result<Config> {
        let text = fs::read_to_string(self.root.join(CONFIG_FILE)).with_context(|| {
            format!(
                "no signer config in {}; run `init` first",
                self.root.display()
            )
        })?;
        Ok(toml::from_str(&text)?)
    }

    pub fn write_config(&self, config: &Config) -> anyhow::Result<()> {
        fs::write(self.root.join(CONFIG_FILE), toml::to_string_pretty(config)?)?;
        Ok(())
    }

    /// Creates a fresh age identity and stores `mnemonic` encrypted to it. Fails rather than
    /// overwrite an existing seed.
    pub fn store_mnemonic(&self, mnemonic: &Mnemonic<English>) -> anyhow::Result<()> {
        fs::create_dir_all(&self.root)?;
        restrict_dir(&self.root)?;
        let identity_path = self.root.join(IDENTITY_FILE);
        let seed_path = self.root.join(SEED_FILE);
        if identity_path.exists() || seed_path.exists() {
            bail!("{} already holds a wallet seed", self.root.display());
        }
        let identity = age::x25519::Identity::generate();
        let recipient = identity.to_public();
        write_private(
            &identity_path,
            format!(
                "# public key: {recipient}\n{}\n",
                identity.to_string().expose_secret()
            )
            .as_bytes(),
        )?;

        let encryptor =
            age::Encryptor::with_recipients(std::iter::once(&recipient as &dyn age::Recipient))?;
        let mut ciphertext = vec![];
        let mut writer = encryptor.wrap_output(age::armor::ArmoredWriter::wrap_output(
            &mut ciphertext,
            age::armor::Format::AsciiArmor,
        )?)?;
        writer.write_all(mnemonic.phrase().as_bytes())?;
        writer.finish().and_then(|armor| armor.finish())?;
        write_private(&seed_path, &ciphertext)?;
        Ok(())
    }

    /// Decrypts the BIP 39 seed. Only called for signing and for proving Sapling spends; the
    /// returned buffer is zeroized on drop.
    pub fn seed(&self) -> anyhow::Result<SecretVec<u8>> {
        let identities = age::IdentityFile::from_file(
            self.root.join(IDENTITY_FILE).to_string_lossy().into_owned(),
        )?
        .into_identities()?;
        let ciphertext = fs::read(self.root.join(SEED_FILE))?;
        let decryptor = age::Decryptor::new(age::armor::ArmoredReader::new(&ciphertext[..]))?;
        let mut buf = vec![];
        let read = decryptor
            .decrypt(identities.iter().map(|i| i.as_ref() as &dyn age::Identity))?
            .read_to_end(&mut buf);
        let phrase = SecretVec::new(buf);
        read?;
        let text = std::str::from_utf8(phrase.expose_secret())
            .map_err(|_| anyhow!("seed file is corrupt"))?;
        let mut seed = <Mnemonic<English>>::from_phrase(text)?.to_seed("");
        let secret = SecretVec::new(seed.to_vec());
        seed.zeroize();
        Ok(secret)
    }

    /// Writes the RPC credential. `group_readable` makes it 0640 so a co-located client in the signer's group can
    /// read it without access to the rest of the data directory.
    pub fn write_cookie(
        &self,
        path: &Path,
        secret: &SecretString,
        group_readable: bool,
    ) -> anyhow::Result<()> {
        let _ = fs::remove_file(path);
        write_with_mode(
            path,
            format!("__cookie__:{}", secret.expose_secret()).as_bytes(),
            if group_readable { 0o640 } else { 0o600 },
        )
    }

    pub fn root(&self) -> &Path {
        &self.root
    }
}

fn write_private(path: &Path, contents: &[u8]) -> anyhow::Result<()> {
    write_with_mode(path, contents, 0o600)
}

fn write_with_mode(
    path: &Path,
    contents: &[u8],
    #[allow(unused_variables)] mode: u32,
) -> anyhow::Result<()> {
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(mode);
    }
    let mut file = options
        .open(path)
        .with_context(|| format!("cannot create {}", path.display()))?;
    file.write_all(contents)?;
    file.sync_all()?;
    Ok(())
}

fn restrict_dir(path: &Path) -> anyhow::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}
