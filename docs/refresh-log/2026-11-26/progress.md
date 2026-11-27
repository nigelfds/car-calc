# Refresh progress, 2026-11-26

- [x] Step 0: preflight (build 0 failures, tests green, branch from main at a84056e)
- [x] Step 1: market sweep, see sweep.md. Waiting for the person to confirm the work list.
- [ ] Step 2: plan batches
- [x] Steps 3-4: research and integrate. Done. Trial (10), waves 1 to 4 (26 each, wave 3 partly rerun after a pause) and wave 5 (22): all 134 families have provenance. See trial.md and wave-1.md to wave-5.md.
- [ ] Step 5: watchlist, rates, tax tables. Known watchlist fixes from the sweep: Denza, Mitsubishi
      and Land Rover now sell BEVs; Nissan has a PHEV coming; LDV MIFA 9 and Isuzu D-Max EV are off.
- [ ] Steps 6-8: images, app check, PR

## After the refresh (approved by the owner 2026-11-26)

1. Add `node scripts/check-provenance.js --all` coverage to `npm test` once every family has a
   provenance file, so a row without provenance fails the pre-push hook.
2. Delete `docs/archive/` (the five pre-skill research briefs; git history keeps them).
3. Drop watchlist backlog entries the provenance files make redundant ("Unsourced consumption
   figures", "Hyundai/Kia gross battery figures") as their families are refreshed.
4. Separate PR: stop committing `data/vehicles.json` and `data/families.json`; generate them at
   deploy with a Heroku build step. Check the live site after it deploys.
