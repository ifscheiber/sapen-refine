# Quality Gates

Current required root gates:

- `npm run prisma:generate`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test`
- `npm run check:design-hardcoding`

Current editor-related unit coverage:

- `tests/unit/editor-canvas-geometry.test.ts` covers coordinate mapping, clamping, fit zoom, and display sizing helpers.

Manual smoke coverage:

- `docs/07-testing/manual-smoke-editor-ipad.md` defines the current desktop and iPad Safari editor trial checklist.

Optional local destructive smoke:

- `npm run db:reset`
- `npm run prisma:migrate`
- `npm run seed`
- `npm run dev`
