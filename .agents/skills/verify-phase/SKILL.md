---
name: verify-phase
description: Run full verification (typecheck, unit tests, headless determinism check) and record authentic evidence in docs/proof/ before tagging a phase.
---

# Skill: Verify Phase

Use this skill at the end of every SDLC phase (or before creating a `phase-N` tag).

## Steps
1. Ensure all acceptance criteria in `docs/notes/assumptions.md` have matching unit tests or headless scenarios in `tests/scenarios/`.
2. Run the automated verification pipeline:
   ```bash
   npm run verify -- --write-proof phase-N
   npm run build
   ```
3. Check that the generated `docs/proof/phase-N-verification.md` accurately matches the current git HEAD and has zero skipped/broken assertions.
4. Perform an independent review pass (e.g. spawn a fresh subagent or inspect `git diff` separately from the implementation turn) to confirm no rules in `AGENTS.md` were violated.
5. Commit changes cleanly, create the annotated/lightweight tag `git tag phase-N`, and push both branch and tag.
