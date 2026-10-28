A conversion rate turns what a partner is owed in a currency like USD into the ZEC you pay them. Setrya never fetches a price. You enter each rate yourself, with where it came from and when, and approve it. Every ZEC amount on a statement can then be traced back to a rate you chose.

## When you need a rate

You need one for every currency a period owes in, other than ZEC. Agreements that are already in ZEC are paid exactly, and the period's conversion step says **Already denominated in ZEC**. A fixed agreement in ZEC needs no rate either.

Without a rate, the rows in that currency are held with "No approved conversion rate to ZEC", and the period shows a "Source currency missing rate" exception.

## Enter a quote

You can enter a quote on the **Conversion** step of a [new period](/docs/periods#create-a-period), or in the **Conversion rates** card on a draft period's page.

1. Select **Enter a quote**.
2. Under **I am entering**, choose how you have the price. **The ZEC price: 1 ZEC = X USD** is the usual way exchanges quote it. **ZEC per unit: 1 USD = X ZEC** is the other way round. Setrya stores both as a rate from your currency to ZEC, so a conversion never has to guess the direction.
3. Enter the **Rate value X**, with up to 18 decimal places.
4. Enter the **Quote time (UTC)**.
5. Enter the **Quote source**, such as the exchange name and pair, or your OTC desk.
6. Tick **I approve this rate for converting amounts owed into ZEC**.
7. Select **Save approved rate**. The period uses it straight away.

| What the screen says | What it means | What to do |
| --- | --- | --- |
| Use a plain positive number | The rate isn't a number, or has more than 18 decimals. | Type digits and one decimal point. |
| A rate must be above zero. | The rate is 0. | Enter the real rate. |
| Name where the quote came from | **Quote source** is shorter than 3 characters. | Name the source. |
| The quote time is in the future. | The quote time is more than 5 minutes ahead. | Use the time you got the quote. |
| Approve the rate to use it | The approval box isn't ticked. | Tick it. |

## Expiry

A rate expires a fixed number of hours after its quote time. The default is 72 hours, and you can change it with **Manual rate expiry (hours)** in **Settings**, **Settlement defaults**. The form shows the expiry under **Quote source**: "A rate is never refreshed after a period is frozen."

A rate that has expired by the time the period is calculated holds its rows with "The conversion rate expired". Enter a new quote and recalculate.

## Attach or change a period's rate

On a draft period's page, the **Conversion rates** card lists each currency as, for example, **USD → ZEC**, with the rate it uses. Choose another approved rate from the list, or "No rate (rows held)" to hold that currency's rows. The card reminds you these are "Manual rates, not onchain conversions."

Rates lock when you freeze the period: "Rates are locked once a period is frozen. Start a new revision to change them." Choosing a rate for another currency is refused with "That rate does not convert this currency."

## Rounding

Each payout is converted exactly, then rounded down to whole zatoshis. A zatoshi is 0.00000001 ZEC, the smallest unit. Rounding down means no partner is ever sent more than their approved amount. The fraction left over is recorded on the row as **Residual not paid** rather than dropped.

The calculation trail shows the whole conversion: **Conversion** names the rate and its snapshot, **ZEC payable (rounded down)** shows the amount in ZEC and in zatoshis, and **Residual not paid** shows what rounding left behind.

Payouts smaller than the project's **Minimum payout (zatoshis)** are held rather than sent. See [Fees and limits](/docs/fees-and-limits).
