Importing revenue brings the fee figures your platform reports into Setrya, row by row, so agreements can calculate what each partner is owed. Setrya keeps every original field, fingerprints the file, and asks you to classify each row before anything counts. A row only adds to a partner's payout once you've marked it eligible.

## Before you start

- Add a [revenue source](/docs/projects-and-sources#revenue-sources) and keep it enabled. Every import belongs to one. Without one, **Import revenue** says **Add a revenue source first**.
- Export your fees as a CSV. Files can be up to 5 MB, 20,000 rows and 64 columns. A `.csv`, `.txt` or `.tsv` file works. Spreadsheet formats aren't supported yet, and an `.xlsx` file is refused with "Upload a .csv file. Spreadsheet formats are not supported yet."
- If you don't have a file yet, **Download the template** on the upload step gives you one with the columns `external_id`, `occurred_at`, `description`, `amount`, `currency`, `fee_type`, `status` and `source_reference`.

## Import a file

Open **Revenue** and select **Import revenue**. The import has four steps: **Upload**, **Map columns**, **Classify** and **Commit**. Nothing is saved until the last one.

1. **Upload.** Choose the **Revenue source**, then drop a CSV on the box or choose a file. Setrya reads it and shows the file name, the row count, the delimiter it detected, the size and the file's SHA-256 fingerprint. Select **Preview mapping**.
2. **Map columns.** For each field, pick the column it comes from, or leave it **Not mapped**. **Date** and **Amount** are required. The others are optional: **Currency**, **External ID**, **Description**, **Status**, **Fee type**, **Fee period** and **Reference**. Set the **Date format** (YYYY-MM-DD, MM/DD/YYYY or DD/MM/YYYY), the **Decimal separator** and the **Time zone for dates without one**. The first ten rows of the file appear below so you can check the mapping. Select **Continue to classify**.
3. **Classify.** Every readable row appears with its amount, date, description, external ID and any issues Setrya found. Choose a **Type** and a **Decision** for each row: **Eligible**, **Held for review** or **Excluded**. Setrya suggests a decision, and the screen says "Suggestions below are a starting point. Every exclusion needs a note. No row is classified without your review." Tick **Only rows with issues** to see just the rows that need attention. Select **Review commit**.
4. **Commit.** Check the counts: **Will import**, **Eligible**, **Held for review**, **Excluded** and **Duplicates found**, with totals per currency. Tick **I reviewed these rows and understand the values come from my source file** and select **Commit import**.

Setrya records exactly what your file says. The commit step reminds you: "Imported values are not independently verified. Setrya records what your file says, with its hash, so every later calculation can be traced back to it."

### What Setrya suggests for each row

| The row | Suggested decision |
| --- | --- |
| A realised fee with no blocking issue | **Eligible** |
| Gross volume, or any type other than a realised fee | **Excluded**, with a note saying why |
| Any row with a blocking issue from the next table | **Held for review**, with the issues as its note |
| A row with no readable amount or date | Not imported. The commit step tells you how many. |

You can change any suggestion. An **Excluded** row needs a note, and **Review commit** stays off until every exclusion has one.

## Issues Setrya flags

Each issue appears as a badge on the row.

| Badge | What it means | Holds the row |
| --- | --- | --- |
| Missing date | The date column is empty. | Yes |
| Date could not be read | The date doesn't match the format you picked. | Yes |
| Amount is not a number | The amount cell can't be read as a number. | Yes |
| Amount is negative | The amount is below zero. | No |
| Same external_id appears twice in this file | Two rows share an ID. | Yes |
| Potential duplicate external_id already imported | A row with this ID came in an earlier import. | Yes |
| Row looks like gross trading volume labelled as fees | The row is labelled a fee but looks like volume. | Yes |
| Gross volume is not fee revenue | The row is volume. | No, it's excluded by default |
| Refund needs a decision before it changes the fee base | A refund or chargeback. | Yes |
| No external_id, duplicates can only be flagged by content | The row has no ID. | No |
| Currency code is not recognised | The currency cell isn't a currency code. | Yes |
| Currency differs from the source default | The row is in another currency than the source. | No |

Held rows stay out of every fee base until you decide them, either here or later in the period's [exception inbox](/docs/periods#resolve-exceptions).

## Duplicates

The same file can't be imported twice into the same source. On the upload step, a repeated file shows **This exact file was already imported for this source**, with a link to **Open the existing import**, and **Preview mapping** stays off.

When some rows repeat external IDs from earlier imports, the commit step offers two choices.

- **Skip rows whose external_id is already imported.**
- **Import them as distinct revisions, held until I review each one.**

## When an import is refused

| What the screen says | What it means | What to do |
| --- | --- | --- |
| Choose a CSV file. | No file was attached. | Choose a file. |
| Files are limited to 5 MB. | The file is too large. | Split the export. |
| Choose a revenue source. | No source is selected. | Pick one. |
| This source is disabled. Enable it before importing. | The source is disabled. | Enable it under **Sources**. |
| This upload expired. Upload the file again. | Too long passed between upload and commit. | Start again from **Upload**. |
| Map a column to date. | Date or amount isn't mapped. | Map both. |
| Each column can map to one field only. | One column is mapped twice. | Change one mapping. |
| Row N is excluded without a reason. | An excluded row has no note. | Add a note. |
| No rows can be imported. Every row is unreadable or a skipped duplicate. | Nothing would be saved. | Check the mapping and the file. |
| This exact file was already imported for this source. Open the existing import instead. | The file's fingerprint matches an earlier import. | Use the existing import. |

## After you commit

The import's page shows **Rows accepted**, **Eligible**, **Held**, **Excluded** and **Duplicates**, with a badge saying **Committed**, **Needs review** or **Voided**. If rows were held, it says how many and that "Held rows stay out of every fee base. Any agreement that draws on these fees is held too until you decide."

- The **Entries** tab lists every row. The **Issues** tab lists the rows that need attention. The **Provenance** tab shows the source file and its column mapping.
- **Download normalised CSV** gives you the rows as Setrya stored them.
- **Use in new period** starts a [settlement period](/docs/periods) from this import.

Raw rows are stored encrypted and unchanged. A correction never rewrites the original import.

## Reclassify rows later

On **Revenue**, select rows in the table, then select **Mark eligible**, **Exclude** or **Flag for review**. Write a reason and select **Apply with reason**. The confirmation names how many rows changed and says the change is in Activity.

You can filter the table by reference, classification, source and currency. A row in a frozen or closed period can't be selected. Its details say "This row belongs to a frozen or closed period. Corrections go into a later period as an adjustment, so the original stays as it was." Trying to change one is refused with "N selected row(s) belong to a frozen or closed period. Record a correction in a new period instead."

## Add a single entry by hand

On **Revenue**, select **Add manual entry**. Pick the **Source**, then fill in **Earned at**, **Type**, **Amount**, **Currency**, **Description**, an optional **External ID** and **Where this figure comes from**, which is required. Select **Save entry**. An external ID that's already recorded for the source is refused with "An entry with this external ID already exists for this source."

## Void an import

Voiding keeps every row and its history and removes them from future periods. It can't be undone, so import the corrected file afterwards.

1. On the import's **Provenance** tab, under **Void this import**, select **Void import**.
2. Write a **Reason** and confirm with **Void import**.

An import whose rows are in a frozen or closed period can't be voided: "Rows from this import are part of a frozen or closed period. Record a correction in a new period instead."
