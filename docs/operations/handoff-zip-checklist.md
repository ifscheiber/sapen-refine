# Handoff ZIP Checklist

## Purpose

Use this checklist before sharing the repository for Codex, human review, or customer trial deployment preparation.

## Checklist

- Prefer the reproducible archive command:

```bash
npm run handoff:archive
```

- Confirm `git status --short` is clean before creating a customer-facing handoff. The archive command refuses a dirty worktree by default; use `--allow-dirty` only for an internal diagnostic handoff.
- Do not include `.env`, `.env.local`, or other real secret files.
- Do not include `node_modules/`, `.next/`, build output, cache folders, local MinIO/Postgres data, or logs.
- Keep `.env.example` with placeholders only.
- Include `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, and `docs/`.
- Move completed tickets into the matching `done/` folder.
- Inspect `handoff-manifest.json` inside the archive for commit hash, dirty state, root file summary, and exclusion summary.

## Important Files

- `.gitignore`
- `.env.example`
- `tickets/`
- `docs/`

## Invariants And Constraints

- Handoff archives must not contain real credentials, `.git`, local database/storage volumes, build output, Playwright reports, or test traces.

## Known Gaps

- Real customer handoff should be created from a clean commit. Internal `--allow-dirty` handoffs must be labeled as such.

## Related Tickets / Docs

- [environment.md](environment.md)
