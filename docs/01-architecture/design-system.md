# Design System

RB-043 establishes a central token layer for colors, typography, radii, surfaces, shell colors, and annotation labels.

Design values live in:

- `src/design/tokens.css`
- `src/design/themes.css`
- `src/design/editorCanvas.ts`
- `src/design/README.md`

`src/app/globals.css` imports Tailwind plus the design layer. Active production components should use semantic classes such as `bg-background`, `text-foreground`, `border-border`, `bg-card`, and shell token names. `npm run check:design-hardcoding` catches obvious raw color regressions outside approved design files.

The authenticated shell, project workspace, and crop annotation editor use a local SaPen Core-aligned mirror in `src/components/shell/*` and `src/components/workspace/*`. These components should stay token-driven and route-addressable; project selection belongs to URLs and the contextual sidebar, while the main Projects workspace renders only the active annotation project. Editor-specific controls keep the same token layer through `src/features/editor/editorStyles.ts` and `src/design/editorCanvas.ts`.
