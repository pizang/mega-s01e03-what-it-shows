# kb — the support knowledge base

**kb** = knowledge base. What the support desk knows about how our products break, written
down where the code can keep it honest.

One desk takes reports for every product we run: `sched-prod` (calendar invites for about
300k people) and the rest. When something
goes wrong, the reports reach the desk first. This kb is how the desk triages them, what each
incident turned out to be, and why we decided what we decided.

## What's here

```
src/routes/kb/      the pages (.svx: Markdown with components)
  triage/           how the desk handles incoming reports
  incidents/        one page per big ticket
  decisions/        numbered decision records
src/lib/kb/         components and the logic they run
src/lib/layouts/    the frame every page shares
src/lib/data/       exports from the ticket system
```

## Conventions

- Words in the page, logic in `src/lib` (imported as `#lib/…`). A number that can be computed belongs in a component.
- Every page starts with frontmatter: `title`, `owner`, `status`, `reviewed`.
- A decision is never edited after it is accepted. A new record replaces it.
- A page you add is signed: its frontmatter carries your `signature` and it ends with `<RenderStamp {signature} />`, so the desk knows who wrote it.

## Owners

Support desk. Decision records: whoever signed them.

---

Exported 2026-10-04 from the `support` repo, `apps/kb/` → `src/`.

## S01E03 review

The new signed review is `src/routes/kb/incidents/4471-review/+page.svx`.
`rendered/kb/incidents/4471-review/index.html` is its actual Svelte server rendering,
with the exported calculation components, timeline, interactive dedupe explorer,
and computed desk reference. The original accepted decision is unchanged.

Engineering tickets:
- [Shared parser](https://github.com/pizang/mega-s01e03-what-it-shows/issues/2)
- [Booking-v3 hint](https://github.com/pizang/mega-s01e03-what-it-shows/issues/1)

The rendered review is also captured in `rendered/review.webp` for a static visual reference.

The audit deduplicates overlapping export rows by report ID, resolves tenants from
their directory files, and runs `causes.ts`. Its snapshot is not a claim about the
current support queue. Intake tags and browser locales are not cause identifiers.
Five desk-noted timing anomalies remain included in the parser count, with their
uncertainty preserved in the review and issue rather than asserted as another cause.

### Reproduce

With Bun installed, run from this directory:

```sh
bun install
bun run audit
bun run render
bun run preview
```

Open `http://127.0.0.1:4173/kb/incidents/4471-review`. The rendered directory must be
served as the web root so `/assets/` and the links to other kb pages resolve.
No GitHub Pages deployment is required or configured.

`scripts/render.mjs` compiles the original `.svx` and `.svelte` files, preserving
their logic. It structurally expands the export's eager `import.meta.glob` calls,
bundles both server rendering and browser hydration, and writes static HTML/CSS/JS.
It does not replace computed components with hand-written tables or fabricate a
desk reference. Run the build again if the source, signature, or snapshot changes.

### Observed verification

- Rendered all kb pages and opened the review in Chromium.
- Observed the calculated report partition, intake-tag breakdown, anomaly footnote,
  received/merged timeline, and signature stamp.
- Changed the first explorer report from `form` to `app`: its cause changed from
  hint to parser and the verdict changed from keep apart to merge; restored it.
- Opened the accepted historical decision and observed its stale-page banner.
- Opened the kb index and observed the new review in its computed page list.
- No browser errors were reported during these checks.

The export contains no product parser or live booking form. These checks verify the
kb diagnosis and rendered behavior, not a product fix.
