# Handoff ZIP Checklist

## Purpose

Use this checklist before sharing or zipping the repository for Codex or human handoff.

## Checklist

- Confirm `git status --short` only shows intentional changes.
- Do not include `.env`, `.env.local`, or other real secret files.
- Do not include `node_modules/`, `.next/`, build output, cache folders, local MinIO/Postgres data, or logs.
- Keep `.env.example` with placeholders only.
- Include `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, and `docs/`.
- Move completed tickets into the matching `done/` folder.

## Important Files

- `.gitignore`
- `.env.example`
- `tickets/`
- `docs/`

## Invariants And Constraints

- Handoff archives must not contain real credentials or local database/storage volumes.

## Known Gaps

- No automated ZIP hygiene script exists yet.

## Related Tickets / Docs

- [environment.md](environment.md)
