A project is one business or revenue stream. It holds that business's revenue sources, partners, agreements, settlement periods and statements, and every payment it makes comes from the payer wallet on your settlement host. A revenue source is where a project's fee figures come from, such as the payout report of the platform that pays you. Each source also records what its amount column means, which is how Setrya keeps trading volume from being paid out as if it were fees.

## Before you start

You need a signed-in, unlocked workspace. The first project is created during onboarding, on the **Organisation and project** step, with the **Create workspace** button. Everything below happens inside a project, from the sidebar under **Workspace**, **Settlement** and **System**.

## Project settings

Open **Settings**, then **Project**. The form has these fields.

| Field | What it does |
| --- | --- |
| **Organisation display name** | Your organisation's name. Shown under the issuer on statements. |
| **Project or brand name** | The project's name in the app and on statements. "A project groups fee sources, partner agreements, settlement periods and the payer wallet." |
| **Issuer label on statements** | How statements name the issuer, in the large heading at the top. |
| **Accounting currency** | USD or ZEC, for statements and summaries. It is never converted automatically. |
| **Time zone** | The time zone dates and times are shown in. |
| **Description** | Optional, up to 500 characters. |
| **Private contact** | Optional. "Shown only to you. Never added to statements." |
| **Logo** | Optional PNG, JPEG or WebP under 140 KB. Stored encrypted on the host and used only on your statements. **Remove logo** takes it off. |

The **Statement header preview** beside the form shows how the header of a statement will look as you type. Select **Save** to keep your changes. The confirmation says "Project saved. Existing statements keep the header they were issued with.", because a statement that was already issued never changes its header.

If the save fails, the form shows the reason next to the field.

| What the screen says | What it means | What to do |
| --- | --- | --- |
| Enter the organisation name | **Organisation display name** is empty. | Fill it in. |
| Enter a project name | **Project or brand name** is empty. | Fill it in. |
| Enter how statements should name the issuer | **Issuer label on statements** is empty. | Fill it in. |
| Choose a valid time zone | The time zone isn't one Setrya recognises. | Pick one from the list. |
| Logo must be a PNG, JPEG or WebP image | The logo file is another format. | Upload a PNG, JPEG or WebP. |
| Use an image under 140 KB. | The logo file is too large. | Pick a smaller image. |
| Archived projects are read-only. | The project is archived. | Restore it first. See [Archive or restore a project](#archive-or-restore-a-project). |

### Add another project

On the same page, under **Add project**, select **Add project**, fill in the same form and select **Create project**. You can also open the project switcher at the top of the sidebar and choose **Add project**, which jumps to this section.

Every project on one installation pays from the same payer account, the one configured on the settlement host. The page says so: "Payments come from the payer account configured on this host; to keep accounts separated, run a separate installation."

### Archive or restore a project

Archiving blocks new periods, imports and payments while keeping every record and export readable. Nothing is deleted.

1. Under **Archive project**, write a **Reason** of at least 3 characters.
2. Tick **I have exported what I need from this project**.
3. Select **Archive project**.

While a project is archived, any change to its work is refused with "This project is archived. Historical records stay readable; new work is blocked." To undo it, write a reason and select **Restore project**, which allows new periods again.

## Revenue sources

Open **Revenue**, then the **Sources** tab, or go straight to **Revenue sources**. Each source shows as a card with whether it's **Enabled** or **Disabled**, what its amount means, its currency, time zone, last import, held rows, and whether its fees arrive by CSV or manual entry.

### Add a source

1. Select **Add source**.
2. Under **How fees arrive**, choose **CSV import** to upload statements exported from the platform that pays you, or **Manual entry** to type individual fee records. **API connector** is shown as **Not connected** and can't be selected, because no provider integration is built.
3. Fill in the fields.
4. Select **Save source**. The confirmation says "Source added."

| Field | What it does |
| --- | --- |
| **Source name** | For example "Creator fees". |
| **Platform label** | Optional, for example "Launchpad dashboard". |
| **Default import currency** | A 3 to 5 letter code, such as USD. Rows in another currency are flagged when imported. |
| **Time zone for periods** | The time zone used for dates in this source's imports. |
| **What the amount column means** | See the next table. |
| **Reference URL** | Optional. Must be a full URL. |
| **Note** | Optional, up to 500 characters. |

### What the amount column means

This choice sets the default classification of every row you import from the source.

| Option | What it means | What happens to rows |
| --- | --- | --- |
| **Realised net fees** | "Money you actually earned after the platform took its cut." | Rows are suggested as eligible, so agreements can pay from them. |
| **Gross volume** | "Total traded or processed value." | Rows are excluded by default, because volume isn't revenue. |
| **Other** | Neither of the above. | Each row is held until you classify it. |

The form reminds you why this matters: "A $20,000 trading volume might have earned you $200 in fees. Setrya never calculates commissions from volume unless you explicitly reclassify a row and record why."

### Change or disable a source

On a source's card, select **Edit defaults**, change what you need and select **Save changes**. Changes apply to future imports only. Rows already imported keep their stored classification.

To stop new imports from a source, untick "Source enabled. Disabling stops new imports and keeps every existing record." Importing into a disabled source is refused with "This source is disabled. Enable it before importing."

If you and another tab edit the same source, the second save is refused with "This source changed elsewhere. Reload and try again."

| What the screen says | What it means | What to do |
| --- | --- | --- |
| Name the source | **Source name** is empty. | Fill it in. |
| Use a 3 to 5 letter currency code | **Default import currency** isn't a currency code. | Enter a code such as USD or ZEC. |
| Enter a full URL | **Reference URL** isn't a complete URL. | Include `https://`, or leave it empty. |

The **API connectors** card on the Sources page says the same thing as the form: "No provider integration is built. Sources arrive by CSV or manual entry until a real authenticated connector exists."

## Where to go next

With a source in place, [import its fees](/docs/import-revenue), then add the [partners](/docs/partners) you pay and their [agreements](/docs/agreements).
