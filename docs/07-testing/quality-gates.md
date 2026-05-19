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

Optional local destructive smoke:

- `npm run db:reset`
- `npm run prisma:migrate`
- `npm run seed`
- `npm run dev`
