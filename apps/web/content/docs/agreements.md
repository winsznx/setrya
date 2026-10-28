An agreement is the rule that turns your eligible fees into what one partner is owed, such as 20% of the realised fees from one source. Agreements are versioned. When terms change you create a revision with its own start date, and every period keeps the version it was calculated with, so a later change never rewrites a frozen or paid period.

## Before you start

You need at least one [partner](/docs/partners) and one [revenue source](/docs/projects-and-sources#revenue-sources). The agreement form asks for both.

## Create an agreement

1. Open **Agreements** and select **New agreement**.
2. Fill in **Parties**, the dates, **Entitlement**, and **Payment and terms**.
3. Check the **Formula** and **Worked example** beside the form.
4. Tick **Terms will be snapshotted when a period is frozen**. "Later revisions never change a frozen or paid period."
5. Select **Activate**, or **Save as draft** to finish later. **Cancel** leaves without saving.

### Parties and dates

| Field | What it does |
| --- | --- |
| **Partner** | Who this agreement pays. Choose from the project's partners. |
| **Revenue sources** | Which sources' fees count. Choose at least one. |
| **Agreement label** | A name such as "Creator share 2026". Required. |
| **External contract reference** | Optional, for your own records. |
| **Effective from** | The first day the agreement counts. |
| **Effective until** | Optional. "Exclusive. Leave empty for open-ended." |

### Entitlement

Under **Rule**, choose one of two kinds.

**Percentage of eligible realised fees** is "Applied to the period’s eligible fee base for the chosen sources."

| Field | What it does |
| --- | --- |
| **Rate** | The share, above 0% and at most 100%, with up to 4 decimal places. |
| **Cap per period** | Optional. The most this agreement can owe in one period, in the source's currency. |
| **Refunds and chargebacks** | **Reduce the fee base (negative adjustment)**, or **Ignore refunds for this agreement**. |
| **How this share relates to other agreements on the same fees** | **Share of one pool**: "All exclusive shares on a source must total 100% or less." Or **Independent obligation**: "Paid from your own balance even if shares exceed 100%." |

**Fixed amount per period** is "Owed once for each period the agreement covers." Enter an **Amount** above zero and a **Currency**. A ZEC amount is "Paid exactly, no price involved." Any other currency is "Converted with a rate snapshot you approve per period." See [Conversion rates](/docs/rates).

### Payment and terms

Payouts are settled in ZEC from your shielded account. "Network fees are paid by you, never deducted from the partner. The payout address comes from the partner profile. Setrya performs no onchain conversion."

- **Settlement cadence**: **Each settlement period**, **Weekly** or **Monthly**.
- **Basis definition**: optional, for example "Net creator fees shown on the launchpad payout report, after platform fees."
- **Exclusions** and **Operator notes**: optional. Operator notes are private.

### Formula and worked example

The **Formula** card writes the rule in words, such as "20% of eligible realised fees after refunds", or "Fixed 50 USD per period". The **Worked example**, marked **Example only**, lets you type a **Sample fee base** and see what **Would be owed**. It's "Illustrative arithmetic, not an amount payable. Real amounts come from imported fees in a settlement period."

## Overlapping terms

Setrya checks the agreement against every other active agreement on the same sources while you fill in the form, and shows an **Overlapping terms** warning when something conflicts.

| What the screen says | What it means | What to do |
| --- | --- | --- |
| Exclusive shares on this source would total N%. Activation is blocked until they total 100% or less. | Shares of one pool add up to more than 100%. | Lower a rate, or mark the agreements as independent obligations. |
| This partner already has an active agreement on the same fees. Periods will hold both until you confirm they are meant to stack. | Two agreements pay the same partner from the same fees. | Activate anyway, then confirm or hold them in the period's [exception inbox](/docs/periods#resolve-exceptions). |

When independent obligations on a source add up to more than 100%, a checkbox appears: "Independent commissions on this source total N% of fees. I will fund the difference from my own balance." **Activate** stays off until you tick it.

## When saving is refused

| What the screen says | What it means | What to do |
| --- | --- | --- |
| Choose at least one revenue source | No source is ticked. | Tick a source. |
| Name the agreement | **Agreement label** is empty. | Fill it in. |
| Rate must be above 0% and at most 100% | The rate is out of range. | Fix the rate. |
| Amount must be greater than zero | A fixed amount is zero. | Enter an amount. |
| Acknowledge that terms are snapshotted when a period is frozen. | The snapshot box isn't ticked. | Tick it. |
| Choose a partner from this project. | The partner isn't in this project. | Pick one from the list. |
| This partner is inactive, so new entitlements cannot start. | The partner is deactivated. | Reactivate them from their **Edit** page. |
| The end date must be after the start date. | **Effective until** is on or before **Effective from**. | Fix the dates. |
| Exclusive shares on this source would exceed 100%. Lower a rate, or mark these agreements as independent obligations paid from your own balance. | The pool is overcommitted. | See [Overlapping terms](#overlapping-terms). |
| Independent obligations on this source exceed 100% of fees. Confirm you will fund the difference yourself. | The overcommitment isn't acknowledged. | Tick the overcommitment box. |

## Revise an agreement

1. On the agreement's page, select **Create revision**. The form says "You're creating version N. Historical calculations do not change."
2. Change the terms and dates, and write a **Reason for this revision**.
3. Select **Activate revision**, or **Save as draft**.

When a revision is activated, earlier active versions stop from its **Effective from** date onward. A version that started before that date keeps covering the days up to it. A period that spans the change splits its fee base by date, so each version applies only to its own days. Frozen, paid and closed periods keep the version they used.

A saved draft revision has no effect until you activate it. The agreement's page shows **A draft revision is waiting** with a link to **Continue the revision**. If draft periods use the agreement, the page says they "will pick up an activated revision when recalculated."

If someone else changed the agreement after you opened it, saving is refused with "This agreement changed since you opened it. Reload and try again."

## The agreements list

**Agreements** shows **Active**, **Expiring in 30 days**, **Draft** and **Superseded versions** at the top, then each agreement with its **Rate or amount**. An agreement's own page shows the **Current rule**, every version under **Versions**, **Periods using this agreement**, and its **Activity**.

## End an agreement

1. On the agreement's page, select **End agreement**.
2. Pick the **End date (exclusive)** and write a **Reason**.
3. Confirm with **End agreement**.

"Fees from the end date onward no longer count. Nothing is deleted, and periods that already used this agreement keep their version." An ended agreement can't be revised: "This agreement has ended. Create a new agreement instead."
