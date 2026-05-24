# Handoff ZIP Checklist

## Purpose

Use this checklist before sharing the repository for Codex, human review, or customer trial deployment preparation.

## Checklist

- Prefer the reproducible archive command:

```bash
npm run handoff:archive
```

- Confirm `git status --short` is clean before creating a customer-facing handoff. The archive command refuses a dirty worktree by default; use `--allow-dirty` only for an internal diagnostic handoff.
- Validate any manual, external, or otherwise supplied ZIP before review or sharing:

```bash
npm run handoff:validate -- <archive.zip>
```

- Do not include `.env`, `.env.local`, or other real secret files.
- Do not include `node_modules/`, `.next/`, build output, cache folders, local MinIO/Postgres data, or logs.
- Keep `.env.example` with placeholders only.
- Include `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, and `docs/`.
- Move completed tickets into the matching `done/` folder.
- Inspect `handoff-manifest.json` inside generated archives for commit hash, dirty state, root file summary, and exclusion summary.

## Important Files

- `.gitignore`
- `.env.example`
- `scripts/create-handoff-archive.mjs`
- `scripts/validate-handoff-archive.mjs`
- `tickets/`
- `docs/`

## Invariants And Constraints

- Handoff archives must not contain real credentials, `.git`, local database/storage volumes, build output, Playwright reports, or test traces.
- The validator checks archive hygiene only. It does not prove application correctness, test status, dependency safety, or database integrity.
- The validator scans ZIP entry names and reports path names/counts only. It must not print file contents, secret values, git config contents, logs, or binary payload snippets.
- If an archive containing `.env`, `.env.local`, `.git`, logs, or other sensitive material was already shared externally, regenerate the handoff and rotate any real secrets that may have been exposed.

## Known Gaps

- Real customer handoff should be created from a clean commit. Internal `--allow-dirty` handoffs must be labeled as such.
- Strict archive creation can fail on a dirty worktree. The validator is independent of the current worktree because it checks an already-created ZIP.

## Related Tickets / Docs

- [environment.md](environment.md)
