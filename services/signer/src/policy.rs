//! Pure validation rules. Everything here is deterministic and unit tested; the RPC layer calls
//! these before touching the wallet.

use std::net::{IpAddr, SocketAddr};

use zcash_address::{ConversionError, TryFromAddress, ZcashAddress, unified};
use zcash_protocol::consensus::NetworkType;

/// The only policy this signer will build, sign or report. Zallet's name for "fully shielded within
/// a single pool"; anything weaker is refused rather than downgraded.
pub const FULL_PRIVACY: &str = "FullPrivacy";

/// The only fund source the payer account uses: Orchard receivers, which deliver into the Ironwood
/// pool after NU6.3.
pub const FUND_SOURCE: &str = "orchard";

pub const ZATOSHIS_PER_ZEC: u64 = 100_000_000;
pub const MAX_MONEY_ZAT: u64 = 21_000_000 * ZATOSHIS_PER_ZEC;

#[derive(Debug, PartialEq, Eq)]
pub enum PolicyError {
    Amount(&'static str),
    Policy(String),
    FundSource(String),
    Recipient(&'static str),
    Listen(String),
}

impl std::fmt::Display for PolicyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PolicyError::Amount(why) => write!(f, "Invalid amount: {why}"),
            PolicyError::Policy(p) => write!(
                f,
                "Privacy policy {p:?} is not supported; this signer only builds {FULL_PRIVACY} transactions"
            ),
            PolicyError::FundSource(s) => write!(
                f,
                "Fund source {s:?} is not supported; this signer only spends from {FUND_SOURCE:?} (Ironwood)"
            ),
            PolicyError::Recipient(why) => write!(f, "Recipient rejected: {why}"),
            PolicyError::Listen(why) => write!(f, "Refusing to listen: {why}"),
        }
    }
}

impl std::error::Error for PolicyError {}

/// Parses a decimal ZEC amount (JSON number or string, as Zallet accepts) into zatoshis without
/// floating point. At most 8 fractional digits; zero and negative amounts are rejected.
pub fn parse_zec_amount(value: &serde_json::Value) -> Result<u64, PolicyError> {
    let text = match value {
        serde_json::Value::String(s) => s.trim().to_owned(),
        serde_json::Value::Number(n) => n.to_string(),
        _ => return Err(PolicyError::Amount("expected a number or decimal string")),
    };
    if text.is_empty() || text.starts_with('-') || text.starts_with('+') {
        return Err(PolicyError::Amount("must be a positive decimal"));
    }
    if text.contains(['e', 'E']) {
        return Err(PolicyError::Amount("exponent notation is not accepted"));
    }
    let (whole, fraction) = text.split_once('.').unwrap_or((text.as_str(), ""));
    if whole.is_empty() && fraction.is_empty() {
        return Err(PolicyError::Amount("must be a positive decimal"));
    }
    if !whole.chars().all(|c| c.is_ascii_digit()) || !fraction.chars().all(|c| c.is_ascii_digit()) {
        return Err(PolicyError::Amount(
            "must contain only digits and one decimal point",
        ));
    }
    if fraction.len() > 8 {
        return Err(PolicyError::Amount("more than 8 decimal places"));
    }
    let whole: u64 = if whole.is_empty() {
        0
    } else {
        whole
            .parse()
            .map_err(|_| PolicyError::Amount("too large"))?
    };
    let fraction: u64 = format!("{fraction:0<8}")
        .parse()
        .map_err(|_| PolicyError::Amount("invalid fraction"))?;
    let zat = whole
        .checked_mul(ZATOSHIS_PER_ZEC)
        .and_then(|w| w.checked_add(fraction))
        .ok_or(PolicyError::Amount("too large"))?;
    if zat == 0 {
        return Err(PolicyError::Amount("must be greater than zero"));
    }
    if zat > MAX_MONEY_ZAT {
        return Err(PolicyError::Amount("exceeds the 21M ZEC supply"));
    }
    Ok(zat)
}

pub fn require_full_privacy(policy: Option<&str>) -> Result<(), PolicyError> {
    match policy {
        Some(FULL_PRIVACY) => Ok(()),
        Some(other) => Err(PolicyError::Policy(other.to_owned())),
        None => Err(PolicyError::Policy("<missing>".to_owned())),
    }
}

pub fn require_fund_source(source: Option<&str>) -> Result<(), PolicyError> {
    match source {
        Some(FUND_SOURCE) => Ok(()),
        Some(other) => Err(PolicyError::FundSource(other.to_owned())),
        None => Err(PolicyError::FundSource("<missing>".to_owned())),
    }
}

struct OrchardCheck {
    net: NetworkType,
    has_orchard: bool,
}

impl TryFromAddress for OrchardCheck {
    type Error = &'static str;

    fn try_from_unified(
        net: NetworkType,
        data: unified::Address,
    ) -> Result<Self, ConversionError<Self::Error>> {
        use unified::Container;
        let has_orchard = data
            .items()
            .iter()
            .any(|r| matches!(r, unified::Receiver::Orchard(_)));
        Ok(OrchardCheck { net, has_orchard })
    }

    fn try_from_sapling(_: NetworkType, _: [u8; 43]) -> Result<Self, ConversionError<Self::Error>> {
        Err(ConversionError::User(
            "Sapling-only addresses would move value across pools",
        ))
    }

    fn try_from_transparent_p2pkh(
        _: NetworkType,
        _: [u8; 20],
    ) -> Result<Self, ConversionError<Self::Error>> {
        Err(ConversionError::User(
            "transparent addresses reveal the amount and recipient",
        ))
    }

    fn try_from_transparent_p2sh(
        _: NetworkType,
        _: [u8; 20],
    ) -> Result<Self, ConversionError<Self::Error>> {
        Err(ConversionError::User(
            "transparent addresses reveal the amount and recipient",
        ))
    }

    fn try_from_tex(_: NetworkType, _: [u8; 20]) -> Result<Self, ConversionError<Self::Error>> {
        Err(ConversionError::User(
            "TEX addresses only accept transparent funds",
        ))
    }
}

/// Accepts only a unified address on `network` that carries an Orchard receiver, which the wallet
/// pays inside the Ironwood pool. Anything else would cross pools or leave the shielded set.
pub fn check_recipient(address: &str, network: NetworkType) -> Result<ZcashAddress, PolicyError> {
    let parsed = ZcashAddress::try_from_encoded(address)
        .map_err(|_| PolicyError::Recipient("not a valid Zcash address"))?;
    let check = parsed
        .clone()
        .convert::<OrchardCheck>()
        .map_err(|e| match e {
            ConversionError::User(why) => PolicyError::Recipient(why),
            _ => PolicyError::Recipient("unsupported address type"),
        })?;
    if check.net != network {
        return Err(PolicyError::Recipient("address is for a different network"));
    }
    if !check.has_orchard {
        return Err(PolicyError::Recipient(
            "unified address has no Orchard receiver, so paying it would cross pools",
        ));
    }
    Ok(parsed)
}

fn is_private(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_loopback() || v4.is_private() || v4.is_link_local(),
        IpAddr::V6(v6) => {
            v6.is_loopback() || (v6.segments()[0] & 0xfe00) == 0xfc00 || v6.is_unicast_link_local()
        }
    }
}

/// Loopback is always allowed. Private-network addresses (a container network, for example) need
/// an explicit opt in. Public and unspecified addresses are never allowed: wallet RPC must not be
/// reachable from the internet.
pub fn check_listen(addr: SocketAddr, allow_private: bool) -> Result<(), PolicyError> {
    let ip = addr.ip();
    if ip.is_loopback() {
        return Ok(());
    }
    if ip.is_unspecified() {
        return Err(PolicyError::Listen(format!(
            "{addr} listens on every interface; pick a loopback or private address"
        )));
    }
    if !is_private(ip) {
        return Err(PolicyError::Listen(format!("{addr} is a public address")));
    }
    if !allow_private {
        return Err(PolicyError::Listen(format!(
            "{addr} is a private network address; pass --allow-private-bind to use it"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_decimal_amounts_exactly() {
        assert_eq!(parse_zec_amount(&json!("4.6")).unwrap(), 460_000_000);
        assert_eq!(parse_zec_amount(&json!("0.00000001")).unwrap(), 1);
        assert_eq!(parse_zec_amount(&json!(".5")).unwrap(), 50_000_000);
        assert_eq!(parse_zec_amount(&json!(2)).unwrap(), 200_000_000);
        assert_eq!(parse_zec_amount(&json!(0.1)).unwrap(), 10_000_000);
        assert_eq!(parse_zec_amount(&json!("21000000")).unwrap(), MAX_MONEY_ZAT);
    }

    #[test]
    fn rejects_bad_amounts() {
        for bad in [
            json!("0"),
            json!("-1"),
            json!("1.123456789"),
            json!("1e3"),
            json!("abc"),
            json!("."),
            json!(""),
            json!("21000000.00000001"),
            json!(null),
            json!(true),
        ] {
            assert!(parse_zec_amount(&bad).is_err(), "{bad} should be rejected");
        }
    }

    #[test]
    fn only_full_privacy_and_orchard_source() {
        assert!(require_full_privacy(Some("FullPrivacy")).is_ok());
        assert!(require_full_privacy(Some("AllowRevealedAmounts")).is_err());
        assert!(require_full_privacy(None).is_err());
        assert!(require_fund_source(Some("orchard")).is_ok());
        assert!(require_fund_source(Some("sapling")).is_err());
        assert!(require_fund_source(None).is_err());
    }

    #[test]
    fn rejects_non_orchard_recipients() {
        // ZIP 320 test vector TEX address and a mainnet P2PKH address.
        assert!(
            check_recipient(
                "tex1s2rt77ggv6q989lr49rkgzmh5slsksa9khdgte",
                NetworkType::Main
            )
            .is_err()
        );
        assert!(check_recipient("t1Rv4exT7bqhZqi2j7xz8bUHDMxwosrjADU", NetworkType::Main).is_err());
        assert!(check_recipient("not-an-address", NetworkType::Test).is_err());
    }

    #[test]
    fn listen_address_rules() {
        assert!(check_listen("127.0.0.1:28232".parse().unwrap(), false).is_ok());
        assert!(check_listen("[::1]:28232".parse().unwrap(), false).is_ok());
        assert!(check_listen("0.0.0.0:28232".parse().unwrap(), true).is_err());
        assert!(check_listen("8.8.8.8:28232".parse().unwrap(), true).is_err());
        assert!(check_listen("172.18.0.5:28232".parse().unwrap(), false).is_err());
        assert!(check_listen("172.18.0.5:28232".parse().unwrap(), true).is_ok());
    }
}
