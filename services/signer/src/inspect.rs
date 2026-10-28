//! Turns a PCZT into Zallet's `pczt_inspect` result shape. Every number comes from the PCZT itself;
//! nothing is taken from the caller.

use pczt::Pczt;
use serde_json::{Value, json};

fn signed(value_sum: (u64, bool)) -> i128 {
    let (magnitude, negative) = value_sum;
    if negative {
        -i128::from(magnitude)
    } else {
        i128::from(magnitude)
    }
}

/// The wallet records `user_address` only for external recipients, so an output without one is
/// change back to this wallet. Outputs with neither value nor recipient are padding and are left
/// out.
fn shielded_output(value: Option<u64>, user_address: &Option<String>) -> Option<Value> {
    let value = value.unwrap_or(0);
    match user_address {
        Some(address) => Some(json!({ "value_zat": value, "user_address": address })),
        None if value > 0 => Some(json!({ "value_zat": value })),
        None => None,
    }
}

fn orchard_like(bundle: &pczt::orchard::Bundle) -> (Value, i128) {
    let balance = signed(*bundle.value_sum());
    let outputs: Vec<Value> = bundle
        .actions()
        .iter()
        .filter_map(|a| {
            let out = a.output();
            shielded_output(*out.value(), out.user_address())
        })
        .collect();
    let actions = bundle.actions().len();
    (
        json!({ "actions": actions, "outputs": outputs, "value_balance_zat": balance }),
        balance,
    )
}

pub fn inspect(pczt: &Pczt, privacy_policy: Option<&str>, wallet_created: bool) -> Value {
    let global = pczt.global();

    let t_in: Vec<Value> = pczt
        .transparent()
        .inputs()
        .iter()
        .map(|i| json!({ "value_zat": i.value() }))
        .collect();
    let t_in_sum: i128 = pczt
        .transparent()
        .inputs()
        .iter()
        .map(|i| i128::from(*i.value()))
        .sum();
    let t_out: Vec<Value> = pczt
        .transparent()
        .outputs()
        .iter()
        .map(|o| match o.user_address() {
            Some(a) => json!({ "value_zat": o.value(), "user_address": a }),
            None => json!({ "value_zat": o.value() }),
        })
        .collect();
    let t_out_sum: i128 = pczt
        .transparent()
        .outputs()
        .iter()
        .map(|o| i128::from(*o.value()))
        .sum();

    let sapling = pczt.sapling();
    let sapling_balance = *sapling.value_sum();
    let sapling_outputs: Vec<Value> = sapling
        .outputs()
        .iter()
        .filter_map(|o| shielded_output(*o.value(), o.user_address()))
        .collect();

    let (orchard, orchard_balance) = orchard_like(pczt.orchard());
    let (ironwood, ironwood_balance) = orchard_like(pczt.ironwood());

    let fee = t_in_sum - t_out_sum + sapling_balance + orchard_balance + ironwood_balance;

    let mut out = json!({
        "tx_version": global.tx_version(),
        "consensus_branch_id": format!("{:08x}", global.consensus_branch_id()),
        "expiry_height": global.expiry_height(),
        "wallet_created": wallet_created,
        "fee_zat": fee,
        "transparent": { "inputs": t_in, "outputs": t_out },
        "sapling": { "spends": sapling.spends().len(), "outputs": sapling_outputs, "value_balance_zat": sapling_balance },
        "orchard": orchard,
        "ironwood": ironwood,
    });
    if let Some(policy) = privacy_policy {
        out["privacy_policy"] = json!(policy);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn value_sum_sign() {
        assert_eq!(signed((15_000, false)), 15_000);
        assert_eq!(signed((15_000, true)), -15_000);
    }

    #[test]
    fn change_and_padding_outputs() {
        let ua = Some("utest1x".to_owned());
        assert_eq!(
            shielded_output(Some(5), &ua).unwrap()["user_address"],
            "utest1x"
        );
        assert!(
            shielded_output(Some(5), &None)
                .unwrap()
                .get("user_address")
                .is_none()
        );
        assert!(shielded_output(Some(0), &None).is_none());
        assert!(shielded_output(None, &None).is_none());
    }
}
