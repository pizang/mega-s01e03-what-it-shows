Related separate cause: [shared parser](https://github.com/pizang/mega-s01e03-what-it-shows/issues/2).
KB: [signed source](https://github.com/pizang/mega-s01e03-what-it-shows/blob/main/src/routes/kb/incidents/4471-review/+page.svx), [rendered HTML](https://github.com/pizang/mega-s01e03-what-it-shows/blob/main/rendered/kb/incidents/4471-review/index.html).

## Problem
Booking-v3 prints MM/DD/YYYY for day-first tenants, while its form interprets input in tenant order. The kb classifier assigns 33 distinct reports from #4471 to this separate problem. Correcting the shared parser alone does not correct the form's instruction.

## Evidence
- R-41230: copper.studio, es-ES, booking-v3, form; 6 January became 1 June, despite intake tag parser.
- R-41241: alder.physio, de-DE, booking-v3, form; browser en-US does not change tenant order.
- R-41251: pale.harbour, pt-PT, booking-v3, form; 7 January became 1 July. Its repeated export row is one report.
- Affected tenants: alder.physio, copper.studio, pale.harbour.
- Received 2026-04-17 through 2026-09-22. Intake tags: parser 15, hint 18.

## Classification and fix boundary
Resolve each tenant from src/lib/data/tenants and use causeOf in src/lib/kb/causes.ts after uniqueById. Only form reports for day-first booking-v3 tenants are in this group. Those tenants' app/email reports remain parser reports. Align the date hint with the form's tenant-specific interpretation, and verify the printed instruction and stored date together for all affected tenants.

## Verification boundary
DATE_HINT and causeOf establish this mechanism in the kb; a live booking form is not included. Do not treat this as a runtime reproduction or claim a shipped fix. This group was absorbed into #4471 without its own engineering ticket.

## Reproducible count
Snapshot: kb export dated 2026-10-04. Deduplicate the 427 export rows by id, filter mergedInto === 4471, and classify using tenant locale, form version, and channel. The two groups partition 412 unique reports; no unplaced reports. Browser locale, subject, and intake tags are not cause identifiers.

KB review: src/routes/kb/incidents/4471-review/+page.svx.

<details>
<summary>Report IDs included in this count</summary>

R-41230, R-41241, R-41251, R-41259, R-41262, R-41275, R-41294, R-41305, R-41308, R-41366, R-41372, R-41384, R-41387, R-41396, R-41400, R-41406, R-41415, R-41416, R-41418, R-41428, R-41439, R-41441, R-41449, R-41453, R-41456, R-41460, R-41472, R-41485, R-41493, R-41539, R-41572, R-41582, R-41584

</details>
