---
name: refresh-dataset
description: Run a refresh of the car-calc car dataset end to end, from the market sweep through research agents to a reviewed pull request. Use when asked to refresh, update or re-check the car data, sweep the market for new or discontinued models, or continue an unfinished refresh.
---

# Refresh the car dataset

You are the orchestrator. You run the brand sweep, dispatch research agents (each follows the
`research-car-family` skill), integrate their files, and hand the person one pull request with a
change report. Pushing to `main` deploys to production at carcalc.fyi, so all work lands on a
branch and only the person merges.

The refresh is a **diff against what we hold**: held families are updated, new families added,
discontinued ones removed, and every change carries provenance.

## Files you own

- `data/families/`, `data/vehicles/`, `data/provenance/`: written by research agents, one family
  each. You only delete or rename families here (step 4).
- `data/watchlist.json`: models already checked and not held. You keep it current.
- `data/car-images.json`, `data/model-aliases.json`, `public/images/cars/`: images (step 6).
- `docs/refresh-log/<research date>/`: the sweep result and progress notes for this refresh.
- `data/vehicles.json`, `data/families.json`: regenerated only by `node scripts/build-dataset.js`.

## Step 0: Preflight

- Research date is today's real date. Pass it to every agent.
- On a branch from the latest `main`. Continuing a refresh? Read
  `docs/refresh-log/<date>/progress.md` and resume from where it says.
- `node scripts/build-dataset.js` ends with 0 failures, and `npm test` is green.
- Searches may be capped per session (`CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION`; 200 by default
  in past runs). A research family costs roughly 20–45 searches from scratch and far fewer when
  provenance gives it URLs to re-open. Plan the batch size to the budget.

**Done when** all four hold.

## Step 1: Sweep the market

Dispatch one agent per brand, all at once, each with [sweep-brand.md](sweep-brand.md) as its
binding instructions, the research date, the brand's held family ids and variant counts (from
`data/vehicles.json`), and the brand's `data/watchlist.json` entries. Brands to sweep: every `make`
in `data/vehicles.json` plus every make in the watchlist whose `recheckAfter` has passed.

Merge the returned JSON into `docs/refresh-log/<date>/sweep.json` and commit it.

Then **stop and show the person** a short summary: new families to add, held families no longer on
sale, renames, and watchlist changes, each with its evidence link. Research is the expensive part,
so the person confirms the work list before it starts.

**Done when** every brand has returned (or is listed as failed with the reason) and the person has
the summary.

## Step 2: Plan batches

Turn the confirmed work list into batches:

- `update` for every held family still on sale, `new` for each new family, `check` for anything the
  sweep could not settle.
- Keep **platform siblings in one batch** so their judged fields can be compared: Hyundai/Kia/Genesis
  E-GMP; Toyota/Lexus/Subaru e-TNGA; VW Group MEB and PPE; VW Group PHEVs; BMW; Mercedes; BYD and
  Denza; Geely, Zeekr and Polestar; Chery, Omoda and Jaecoo.
- Batch size to the search budget. Write the plan to `docs/refresh-log/<date>/progress.md`.

## Step 3: Dispatch research agents

One agent per family, a batch at a time, in parallel. Each prompt contains:

- "Use the `research-car-family` skill (`.claude/skills/research-car-family/SKILL.md`); it is
  binding."
- The familyId, make, model, mode, and research date.
- The sweep's notes for that family, introduced as leads to test.
- Sibling family ids to anchor judged fields against.
- The boundaries: write only its own three files, no git, no shared files.

At most one agent at a time should depend on a browser; a second one can be locked out.

## Step 4: Integrate each batch

When a batch's agents return:

1. **Removals.** For each held family reported not on sale with evidence: delete its three data
   files, its `data/car-images.json` entry and image file, and any `data/model-aliases.json` entry;
   add a `not-on-sale` watchlist entry with the evidence. The build fails on an orphaned image
   record, which catches a half-done removal.
2. **Renames** (a family sold under a new name, e.g. Omoda E5 → Chery E5): new familyId, move the
   files, rewrite `familyId` and row ids, and move the image and alias keys. Changing ids breaks
   saved Compare links, so rename only when the make or model name itself changed.
3. **Sibling diff.** Compare judged fields (`insuranceAnnual`, `depreciationCurve`, PHEV
   `fuelConsumptionL100km`, any `judged` boot figure) across siblings in the batch. Every row passes
   the validator alone; only this comparison catches a heavier car given more range.
4. **Checks:** `node scripts/check-provenance.js <batch family ids>`, `node scripts/build-dataset.js`
   (0 failures), `npm test`.
5. **Commit** the batch. The message lists each agent's LOW CONFIDENCE items; that is the record of
   which figures are soft. Update `progress.md`.

**Done when** the batch is committed with green checks, or a family that cannot be entered honestly
has been left out and recorded in the watchlist.

If the search budget runs out mid-refresh, stop between batches, commit, push the branch, and make
`progress.md` say exactly what remains.

## Step 5: Watchlist, rates and tax tables

- Update every watchlist entry the sweep or agents checked: new `checkedAt`, a `recheckAfter` that
  fits the evidence (an expected launch month, or about six months for a settled negative), and
  remove entries that are now held. `node --test data/watchlist.test.js` must pass.
- Re-check `data/rates.json` (finance rates, electricity, running costs) and `data/tax-tables.json`
  (LCT thresholds and VIC duty change each 1 July; FBT phase-in dates). Update with sources if moved.

## Step 6: Images

Run `npm run curate -- --only <new family ids>`. Resolve flags with `--alias` (the car's market name
elsewhere), never by picking a photo by hand. Then put `public/contact-sheet.html` in front of the
person: the eyeball check is the only defence against a wrongly badged sibling.

## Step 7: Check the app

Start the server (`npm start`), confirm the header's variant count matches the build output, and
load both tabs in a headless browser, including a PHEV view (`?includePhev=true`). Confirm new
families render with their data. A green API with a broken page has happened before.

## Step 8: Pull request

Push the branch and open one PR. Its description is the change report:

- Counts: families and variants before and after; added, removed, renamed.
- **Every row that crossed $75,000, $80,809 or $91,661**, and every price change over 15%. Compute
  these from main's `data/vehicles/*.json` (read with `git show main:data/vehicles/<id>.json`) against
  the branch's. The aggregates are not committed, so there is no `main:data/vehicles.json`.
- Spec changes to battery, range, seats or towing.
- Every LOW CONFIDENCE item, grouped by family.
- New families still without a photo, and the contact sheet status.
- Watchlist changes, and whether rates and tax tables changed.

Update the README's variant counts in the same PR. The person reviews and merges; merging deploys.
