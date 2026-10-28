A partner is a person or business you pay a share of your fees to, such as a promoter, a creator or a contributor. Each partner has a profile, any number of [agreements](/docs/agreements), and one payout address at a time. Setrya checks that address can receive a fully shielded payment before it will pay it, and keeps every earlier address as a version in the partner's history.

## Before you start

You need a signed-in, unlocked project. You can add a partner without an address. Setrya will still calculate what they're owed, but every payout to them is held until a good address is on file.

## Add a partner

1. Open **Partners** and select **Add partner**.
2. Fill in the details.
3. Under **Payout address**, paste the partner's **Zcash unified address**, or leave it empty for now. The network badge beside the heading shows which Zcash network this installation pays on.
4. If you entered an address, tick **I confirmed this address with the intended recipient**. Check it through a different channel from the one the address arrived on.
5. Select **Save partner**, or **Save & add agreement** to go straight to a new agreement for them.

| Field | What it does |
| --- | --- |
| **Display name** | How the partner appears in the app and on their statement. Required. |
| **Category** | Promoter, Creator, Contributor or Other. |
| **Short reference** | Optional, up to 40 characters, such as an internal ID. |
| **Contact or email** | Optional. "Stored encrypted. Setrya never contacts partners." |
| **Internal notes** | Optional. "Private. Never appears on a statement." |
| **Active** | "Inactive partners keep their history but get no new entitlements." |

The form warns you before you save: "Check the address with the recipient yourself. A wrong shielded address cannot be traced or reversed."

## The address check

As you paste an address, Setrya reads it and checks it against this installation's network. When it passes, it shows a QR code, **Shielded capable**, the network, a badge for each receiver in the address, a short description such as "Unified address with sapling, orchard receivers.", and **Copy address**.

Setrya pays from the Ironwood pool. Since the NU6.3 network upgrade, a payment to an Orchard receiver lands in Ironwood, so the address needs an Orchard receiver. A unified address from a current Zcash wallet usually has one.

When the check fails, the form shows the reason and **Save partner** stays off.

| What the screen says | What it means | What to do |
| --- | --- | --- |
| Enter a single Zcash address. | The box is empty, too long or has spaces in it. | Paste one address, with nothing around it. |
| Transparent addresses reveal the amount and recipient. Ask for a shielded or unified address. | It's a transparent `t` address. | Ask for a unified address. |
| TEX addresses only accept transparent funds and cannot receive a shielded payment. | It's a TEX address. | Ask for a unified address. |
| This unified address only has transparent receivers. | The unified address has no shielded receiver. | Ask for one with an Orchard receiver. |
| This is not a valid unified address. Check it was copied completely. | It's damaged or incomplete. | Copy it again from the partner's wallet. |
| Mixed-case Bech32 strings are not valid. | Some letters were changed to capitals. | Copy it again. |
| This address is for mainnet, but Setrya is running on testnet. | The address is for a different network. | Ask for an address on this installation's network. |
| This address has no Orchard receiver (which receives into the Ironwood pool), so paying it would move value across pools and reveal the amount. | The address can only receive in another pool. | Ask for a unified address with an Orchard receiver. |
| Sapling-only addresses cannot be paid from the Ironwood pool without crossing pools and revealing the amount. Ask for a unified address with an Orchard receiver. | It's a Sapling `zs` address. | Ask for a unified address. |
| This is not a valid Sapling address. | It looks like a Sapling address but doesn't decode. | Copy it again. |
| This does not look like a Zcash address. | It's something else. | Ask for their Zcash unified address. |

## Wallet readiness

Each partner's profile and the **Partners** list show where their address stands.

| Badge | What it means | What it does to payouts |
| --- | --- | --- |
| **Verified format** | A valid address on this network, confirmed with the recipient. | Payouts can be paid. |
| **Missing** | No address on file. | Held: "Partner has no payout address". |
| **Requires confirmation** | You didn't tick the confirmation box. | Held: "Payout address not confirmed with the recipient". |
| **Unsupported** | The address no longer passes the check, or is for another network. | Held: "Payout address cannot receive a fully shielded payment", or "Payout address is for a different network". |

On **Partners**, the cards at the top count **Active partners**, **Missing payout address**, **Due for settlement** and **Currently held**, and the table has a **Wallet readiness** column. Lists show addresses masked. Open a partner to reveal the full address deliberately.

## The partner profile

A partner's page shows **Owed in open periods**, **Approved, not confirmed**, **Confirmed paid** and **Latest statement**, then their agreements, any upcoming payout, their settlement history and **Statements for this partner only**. The **Payout address** card shows the current address with its badge and **Confirmed with recipient**, and **Address history** lists every version.

## Change a payout address

Changing an address creates a new version effective now. It never edits a payment that's already signed or broadcast.

1. On the partner's page, select **Edit**.
2. Under **Change wallet address**, paste the **New unified address**. When it passes the check, Setrya shows the **Old** and **New** addresses side by side.
3. Write a **Reason for the change** of at least 3 characters.
4. Tick **I reconfirmed the new address with the recipient through a separate channel**.
5. Select **Change address**.

If the partner is part of an unsettled period, the page lists it under **Unsettled periods affected**. Any prepared payment to them that isn't signed yet is invalidated and needs approval again, and the confirmation says how many approvals were invalidated. Afterwards the partner's page shows **Payout address changed since the last approval** until a new approval is made.

Pasting the current address again is refused with "That is already the current address."

## Edit or deactivate a partner

On **Edit**, change the details and select **Save**. If someone else changed the partner in the meantime, the save is refused with "This partner changed since you opened it. Reload and apply your edits again."

To stop new entitlements, select **Deactivate** on the partner's page and confirm. "New periods will not create entitlements for this partner. Their agreements, payments and statements stay in the record. You can reactivate them from Edit." Activating an agreement for an inactive partner is refused with "This partner is inactive, so new entitlements cannot start."
