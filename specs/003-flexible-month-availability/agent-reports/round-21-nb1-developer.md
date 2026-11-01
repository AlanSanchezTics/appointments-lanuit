# Round 21 NB-1 (Developer) - Pin identity of the 48 gate differences

## Result

Done. The gate test in `tests/lib/availability/equivalence-legacy.test.ts` now pins which 48 of the 432 combinations differ from the legacy oracle, not only how many. Not committed.

## Files changed

- `tests/lib/availability/equivalence-legacy.test.ts` (only the body of the gate test, after the `filter` call; title and the 432 test untouched).
- No production code, docs, or other tests touched. No integration tests run. `.env` not read.
- Note: this test file is untracked in git (`?? tests/...`), so there is no git diff baseline. Scope was verified by construction (single `Edit` on the `toHaveLength(48)` line) and by grep of all `it(` titles (lines 78, 83, 91, 101, 107 unchanged).

## Final assertion form

1. Identity (literal, 48 lines, no hash): 
   `expect(blockDifferences.map(({ occupied, blocked }) => JSON.stringify({ occupied, blocked })).sort()).toEqual([ ...48 template-literal keys... ])`
   The literal was generated from the engine/oracle run and compared line-by-line against the typed file contents (`diff` identical). Keys are unique (48 distinct).
2. Superset (checked, holds for all 48, so the assertion was added):
   ```ts
   const missingFromEngine = blockDifferences
     .filter(({ occupied, blocked }) => {
       const engine = engineSlots("BLOCK_MODE", occupied, blocked);
       return legacySlots("BLOCK_MODE", occupied, blocked).some((slot) => !engine.includes(slot));
     })
     .map(({ occupied, blocked }) => JSON.stringify({ occupied, blocked }));
   expect(missingFromEngine).toEqual([]);
   ```
   Scratch check: for all 48 differences, legacy slots missing from the engine = 0. Engine adds slots in 48/48 (extra slots only). Engine is a strict superset in every difference.

## Verification

Executed:
- `npx vitest run tests/lib/availability/equivalence-legacy.test.ts` on the final file: 5 passed, 0 failed.
- `npx eslint tests/lib/availability/equivalence-legacy.test.ts`: no output (no lint errors reported; the exit status captured by my shell was from `tail`, so I am not claiming an exit code).

Mutation evidence (both reverted; restored file checked with `cmp` against a backup, then re-run green):
1. Expected-list mutation: one key replaced by a different key, same length (`{"occupied":[],"blocked":["13:00","18:00"]}` -> `{"occupied":[],"blocked":["14:00","18:00"]}`). Result: gate test FAILED (`expected [ …(48) ] to deeply equal [ …(48) ]`), while the 432 test and the others stayed green. This is the case the old `toHaveLength(48)` could not catch.
2. Engine-call mutation in the superset block (`engineSlots(...).slice(1)`). Result: gate test FAILED (`expected [ …(10) ] to deeply equal []`), showing the superset assertion discriminates.

Post-restore: `Tests 5 passed (5)`.

## Not verified / limitations

- Verification is a vitest run of this one file only, as the brief asked. The rest of the availability suite was not run.
- The identity check depends on the `SLOT_MODE_PRESETS.BLOCK_MODE.times` base and the legacy oracle. If a future intentional change moves the gate, the literal must be regenerated and the change treated as a product decision, as the existing comment already says.
- The scratch script used to generate the list lives in the session scratchpad (`/private/tmp/claude-501/-Volumes-weknow-SSD-development-personal-Docker-appointments-lanuit/92ed9b47-cfd9-4d1b-b04d-b113455908c3/scratchpad/diff48.ts`), outside the repo.

## Handoff

Done: discriminating gate test, superset assertion, mutation evidence.
Pending: none for NB-1. Owner/Orchestrator to decide whether to commit (not committed per brief).
Next step: Reviewer pass, if the workflow requires one.
