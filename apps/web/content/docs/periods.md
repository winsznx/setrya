A settlement period is one stretch of time you're paying partners for, such as October. Setrya gathers the imported fees that fall inside it, applies each partner's agreement, converts what's owed into ZEC, and lists anything that needs your decision as an exception. When the numbers are right, you freeze the period into a hashed snapshot that you then [approve and pay](/docs/approve-and-pay).

## Before you start

- [Import](/docs/import-revenue) the fees for the dates you're settling.
- Activate an [agreement](/docs/agreements) for each partner you're paying from those fees.
- If any agreement is in a currency other than ZEC, have a [conversion rate](/docs/rates) ready, or enter one during the period's conversion step.

## Create a period

Open **Periods** and select **New period**. The wizard has five steps: **Scope**, **Eligible fee base**, **Apply agreements**, **Conversion** and **Calculate**. A summary beside it shows **Matched rows**, **Eligible base**, **Payable now** and **Held rows**. It's a "Live dry run of the same engine. Nothing is saved until you create the draft."

1. **Scope.** Enter a **Period name** such as "October creator fees", the **First day** and the **Last day**, and tick the sources it draws on. Both days are inclusive. Setrya stores the period from the start of the first day to the start of the day after the last one, in the project's time zone. Select **Continue**.
2. **Eligible fee base.** Check the totals of **Eligible fees**, **Excluded (volume, other)** and **Unresolved** rows, per currency. Unresolved rows become exceptions in the new period. Select **Continue**.
3. **Apply agreements.** Check which agreements and versions apply. If none do, the step says **No agreement covers these sources and dates**, and the period would owe nothing. Select **Continue**.
4. **Conversion.** For each currency that needs one, pick an **Approved rate snapshot**, or select **Enter a quote** to add one. Choosing "No rate. Rows in USD will be held." leaves those rows held. Amounts already in ZEC say **Already denominated in ZEC**. Select **Continue**.
5. **Calculate.** Check each payout row and its status, and any exceptions. Select **Create draft period**.

"Creating the draft saves this calculation and its exceptions. Nothing is approved and no funds move."

A few things the wizard tells you along the way:

- If some rows already belong to another period, it says how many and leaves them out "so no fee is consumed twice."
- If the wallet holds less than the payable total, it warns **Wallet balance is below the payable total**. You can still create and review the period, but approval stays blocked until the account holds enough confirmed shielded ZEC plus the network fee.
- **Continue** on the conversion step stays off while you're entering a quote. Save or cancel it first.

## The period page

The page shows the period's status, its dates and the source, then these figures.

| Figure | What it counts |
| --- | --- |
| **Source amount** | Every row in the period, any classification. |
| **Eligible base** | Rows classified eligible. |
| **Excluded** | Volume and other non-fee rows. |
| **Net owed** | The sum of every agreement's result, per currency. |
| **Approved ZEC** | The total in the approved snapshot. |
| **Confirmed paid** | Transactions that reached the confirmation threshold. |
| **Held rows** | Rows that won't be sent. |

The tabs are **Partner payouts**, **Source rows**, **Decisions**, **Payments** and **Documents**. Under **Partner payouts**, each partner's card shows every agreement row with its fee base, what's owed, the ZEC amount and a **Payable**, **Held**, **Credit** or **Nothing owed** badge. Opening a row shows the full calculation: **Window**, **Eligible fee base**, **× rate**, **= calculated**, **Amount owed**, **Conversion**, **ZEC payable (rounded down)**, **Residual not paid**, **Formula** and the fingerprint of the source rows used.

The **Lifecycle** card beside the tabs tracks **Created**, **Calculated**, **Exceptions resolved**, **Frozen**, **Approved**, **Prepared**, **Broadcast**, **Confirmed** and **Closed**. The **Conversion rates** card lets you attach or change a rate while the period is a draft.

### Period statuses

| Status | What it means |
| --- | --- |
| **Draft** | Calculated and editable. |
| **Frozen for review** | Locked into a snapshot, waiting for approval. |
| **Approved** | Approved, with payments ready to prepare. |
| **In payment** | At least one transaction is underway. |
| **Payments resolved** | Every transaction reached a final state. |
| **Closed** | Closed. Corrections go into a later period. |

### Recalculate

Select **Recalculate** to run the period again from the current imports, agreements and rates. Use it after you fix an address, add a rate or activate a revision. It only works on a draft. A frozen period says "This revision is frozen. Create a new revision to change it."

## Why a payout is held

A held row shows a **Held** box with each reason.

| What the screen says | What it means | What to do |
| --- | --- | --- |
| A source row in this fee base needs a decision | An unresolved row feeds this agreement. | Decide it in the exception inbox. |
| No approved conversion rate to ZEC | The currency has no rate attached. | Attach a [rate](/docs/rates) and recalculate. |
| The conversion rate expired | The attached rate's expiry has passed. | Enter a new quote. |
| The conversion rate is not approved | The rate was saved without approval. | Enter an approved rate. |
| The rate is set in the wrong direction | The rate doesn't convert this currency into ZEC. | Enter a quote for this currency. |
| Partner has no payout address | No address on file. | Add one on the [partner](/docs/partners#change-a-payout-address) profile. |
| Payout address cannot receive a fully shielded payment | The address fails the shielded check. | Ask the partner for a unified address with an Orchard receiver. |
| Payout address not confirmed with the recipient | The confirmation box wasn't ticked. | Reconfirm the address and update it. |
| Payout address is for a different network | The address is for mainnet on a testnet installation, or the other way round. | Get an address for this network. |
| Exclusive agreements on this source exceed 100% | The shares of one pool add up to more than 100%. | Revise an agreement. |
| Two agreements pay this partner from the same fees | Two agreements overlap. | Confirm or hold them in the exception inbox. |
| More than one fixed version covers this period | Two fixed-amount versions overlap the period. | Revise the agreement dates. |
| Amount is below the minimum useful payout | The ZEC amount is below the project's minimum payout. | Let it carry forward, or lower **Minimum payout** in [settlement settings](/docs/fees-and-limits). |
| Refunds exceed fees, carried forward as a credit | Refunds outweigh fees for this agreement. | Nothing. The credit carries forward. |
| Held by the operator | You chose to hold it. | Change the decision while the period is a draft. |

## Resolve exceptions

Exceptions are what Setrya needs you to decide. Open them with **Review exceptions** on the period page, which shows how many are blocking.

The inbox lists each exception with a **Blocking** or **Warning** badge, the partner or row it concerns, and the money at risk. Selecting one shows the **Original record**, the **Normalised interpretation** with **Why flagged**, and the **Affected payouts**.

| Exception | Blocking |
| --- | --- |
| Source row appears to represent volume, not earned fees | Yes, when an agreement uses the row |
| Duplicate external reference | Yes, when an agreement uses the row |
| Refund reverses prior fee | Yes, when an agreement uses the row |
| Source row needs classification | Yes, when an agreement uses the row |
| Agreements overlap for the same partner and fees | Yes |
| Agreement date mismatch | Yes |
| Source currency missing rate | Yes |
| Missing or invalid shielded address | Yes |
| Overcommitted payout pool | Yes |
| Payout below minimum | No |
| Net amount is negative | No |

A held row that no agreement uses in this period is listed as a warning, with "No agreement in this period uses this row yet."

To decide one:

1. Choose a decision. Which ones you can pick depends on the exception.
2. Check **Preview before saving**, which shows **Owed now** and **Owed after**, and **Payable now** and **Payable after**.
3. Write a **Reason** of at least 3 characters.
4. Select **Save decision**. Setrya saves it and recalculates the period.

| Decision | What it does | Offered for |
| --- | --- | --- |
| **Exclude with reason** | "The row stays in the record and leaves this period’s fee base." | Source row exceptions |
| **Correct classification to eligible** | "Count the row as realised fees in this period." | Source row exceptions |
| **Confirm both agreements apply** | "Both obligations are intended to stack on the same fees." | Overlapping agreements |
| **Hold payment** | "Affected payouts stay unpaid in this revision and can carry forward at close." | Every exception |
| **Leave unresolved** | Records your note. Affected payouts stay held. | Every exception |

Two exceptions can't be overridden here. For a missing rate, attach an approved rate in **Conversion rates** on the period page. For an address problem, "An owner override never bypasses the address check. Fix the address on the partner profile, then recalculate."

Decisions lock when the period is frozen: "Decisions are locked after freezing. Create a new revision to change them."

## Freeze for approval

When no blocking exception is left, **Freeze for approval** appears on the period page.

1. Select **Freeze for approval**.
2. Read the summary and confirm. Setrya recalculates once more, then records a hashed snapshot of every source row, agreement version, rate, address version and amount. Nothing is approved or sent at this step.

The period becomes **Frozen for review**, and the page says "This revision is locked. Approve it, or start a new revision to change anything." Next, select **Review for approval** and follow [Approve and pay](/docs/approve-and-pay).

| What the screen says | What it means | What to do |
| --- | --- | --- |
| N blocking exception(s) still need a decision. Resolve, exclude or hold each one first. | Blocking exceptions remain. | Open the inbox. |
| Nothing is payable in this period yet, so there is nothing to approve. | Every row is held or owes nothing. | Resolve exceptions or add a rate, then recalculate. |
| Only a draft can be frozen. | The period is already frozen. | Nothing to do. |
| This period was revised elsewhere. Reload. | Someone changed the period in another tab. | Reload the page. |
| A payee address changed or is no longer valid. Recalculate the draft. | An address changed since the last calculation. | Select **Recalculate**. |

## Start a new revision

A frozen or approved period that isn't paid yet can be changed by starting a new revision.

1. Select **Create new revision**.
2. Write a **Reason** and confirm.

"The current snapshot and any approval stay in the record but stop being usable. Your exception decisions carry over. Revisions are refused once a transaction is signed." When a payment is already signed or broadcast, the change goes into a later period: "A transaction for this approval is already signed or broadcast. Record corrections in a later period."
