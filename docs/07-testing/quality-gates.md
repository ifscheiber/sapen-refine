# Quality Gates

Current required root gates:

- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run check:design-hardcoding`
- `npm run test:e2e` for the desktop browser smoke when local DB/MinIO are available.

Current editor-related unit coverage:

- `tests/unit/editor-canvas-geometry.test.ts` covers coordinate mapping, clamping, fit zoom, and display sizing helpers.

Current E2E coverage:

- `tests/e2e/desktop-browser-smoke.spec.ts` covers the current desktop MVP browser workflow.
- `tests/e2e/ipad-viewport-prep.spec.ts` covers only iPad-sized browser preparation, not real iPad Safari.

Manual smoke coverage:

- `docs/07-testing/manual-smoke-desktop-browser.md` defines the current desktop browser MVP smoke path.
- `docs/07-testing/manual-smoke-editor-ipad.md` defines the current desktop and iPad Safari editor trial checklist.

Optional local destructive smoke:

- `npm run db:rebuild` before DB-backed tests when the local schema changed.
- `npm run db:reset`
- `npm run prisma:migrate`
- `npm run seed`
- `npm run dev`

RB-049 note: `npm run test` includes `tests/integration/annotation-domain-schema.test.ts`, which connects to the local PostgreSQL container. Run `npm run db:rebuild` after schema changes or when the local DB is stale.
