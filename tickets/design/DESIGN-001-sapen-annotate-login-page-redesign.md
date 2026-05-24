# DESIGN-001 — SaPen Annotate Login Page Redesign

## Status

Ready for implementation

## Type

Design / UI implementation ticket

## Target application

`SaPen Annotate`

## Priority

High

## Goal

Redesign the SaPen Annotate login page so that it visually aligns with the SaPen Core dark “Obsidian Laboratory” design language while preserving the existing authentication behavior and avoiding broad, risky changes to the annotation editor or canvas.

The current generic login page should be replaced by a production-ready, dark, technical, compact login screen with a split-card layout:

- left side: product/module context
- right side: login form
- compact header
- compact footer
- no public demo credentials
- no unauthenticated help/settings controls

## Background

A Stitch-based design iteration has produced a suitable visual target for the new login page. The design direction is considered acceptable and should now be implemented in the actual SaPen Annotate repository.

Important product/design considerations:

- The app may be publicly hosted, so demo credentials must never be shown.
- The login page should feel like part of the SaPen platform, not like a generic SaaS template.
- Real logos will be added later. For now, a small temporary circular “S” mark is acceptable.
- The footer should remain because future “Powered by assembleMIND” branding may be added there.
- Existing SaPen Annotate design tokens and theme infrastructure should be respected.

## Reference design

Use the latest Stitch mockup as the visual target:

- dark near-black background
- compact top header
- temporary circular “S” logo mark
- `SaPen Annotate` title in the header
- centered split login card
- left information panel
- right login form panel
- compact footer with copyright/system line

Do not copy the standalone Stitch HTML directly. Recreate the design idiomatically inside the SaPen Annotate codebase.

## Existing design-system context

SaPen Annotate already has a design/token setup.

Expected existing files to inspect before implementation:

- `README.md`
- `DESIGN.md`
- `tokens.css`
- `themes.css`
- current login page/component
- app shell/header components
- Tailwind configuration
- `package.json`
- existing UI primitives/components

Implementation should prefer existing semantic classes and tokens, for example:

- `bg-background`
- `text-foreground`
- `border-border`
- `bg-card`
- existing annotation token classes where relevant

Do not globally replace the whole application theme unless it is clearly safe. The login redesign must not accidentally restyle the annotation editor, canvas, mask colors, or workflow pages.

## Recommended design-system strategy

Use one of the following approaches, in this order of preference:

1. Use existing semantic tokens/classes if they can reproduce the target design well enough.
2. Add a small, scoped auth/login styling layer if needed.
3. Add minimal additive semantic tokens to `tokens.css` if the repo conventions support this.

Avoid:

- replacing the full global theme
- adding a new component library
- introducing broad visual changes outside the login page
- changing annotation rendering/canvas logic

## Required layout

### Page shell

- Full viewport layout.
- Dark background.
- Flex column structure:
  - compact header
  - centered main content
  - compact footer

### Header

- Height: approximately `48px`.
- Border-bottom: thin muted border.
- Padding left/right: approximately `24px`.
- Left side only:
  - temporary circular logo mark with `S`
  - `SaPen Annotate`
- No right-side icons.
- No help icon.
- No settings icon.

### Main content

- Vertically center the login card between header and footer.
- Use responsive padding so the layout works on smaller screens.
- The central card should not feel too wide or too tall.

### Login card

Desktop:

- Width: approximately `840px`.
- Two-column grid:
  - left information panel
  - right form panel
- 1px border around card.
- 1px divider between panels.
- Slightly rounded corners, consistent with existing SaPen Annotate radius.
- Overflow hidden.

Mobile/small screens:

- Stack the two panels vertically.
- Avoid horizontal overflow.
- Keep inputs and button usable.

### Footer

- Keep footer.
- Height: approximately `40px`.
- Border-top: thin muted border.
- Padding left/right: approximately `24px`.
- Current text:

```text
© 2026 SaPen Systems.
```

- Keep it subtle.
- Do not add marketing navigation links.
- Leave room for future “Powered by assembleMIND” branding.

## Required content

### Left panel

Title:

```text
Workspace Access
```

Subtitle:

```text
Expert correction and annotation workspace for segmentation masks.
```

Feature bullets:

#### Versioned mask edits

```text
Track every committed mask version without overwriting model predictions.
```

#### Core handoff compatible

```text
Open correction handoffs from SaPen Core with scoped context.
```

#### Audit-ready corrections

```text
Keep prediction, expert refinement, and review state clearly separated.
```

Icons:

- Use existing icon utilities if already installed.
- If no icon library is available, use simple inline SVG icons.
- Do not add Google Material Symbols.
- Do not add a new icon dependency just for this page.
- It is acceptable to omit icons rather than adding a new dependency.

### Right panel

Login form:

- Email field
- Password field
- `Forgot password?` link aligned right in the same row as the `Password` label
- Full-width `Sign in` button

Labels:

- Use conventional labels:
  - `Email`
  - `Password`

Do not use:

- `Identifier`
- `Security Key`

## Form and authentication requirements

Preserve the existing authentication flow exactly.

The implementation must:

- keep the existing login submit behavior
- preserve existing auth API contracts
- preserve existing error handling
- restyle existing auth errors into the new design if necessary
- use a real submit button: `type="submit"`
- use accessible labels
- support keyboard navigation
- provide visible focus states
- use `autocomplete="email"` on the email input
- use `autocomplete="current-password"` on the password input

### Forgot password behavior

Before implementing, inspect whether a password reset route or flow already exists.

- If a route exists, link to it.
- If no route exists, add the visual link in the intended location and wire it to the most appropriate existing placeholder or create a minimal placeholder page only if consistent with repo conventions.
- Do not implement a full password-reset backend in this ticket.

## Security constraints

The login page must never show demo credentials.

Do not include or render:

- `Demo Credentials`
- `admin@sapen.local`
- `admin1234`
- any other public credential hint

Also avoid:

- unauthenticated settings icon
- unauthenticated help icon
- social login
- public auth hints that weaken security

## Visual style requirements

Match the SaPen Core / Obsidian Laboratory direction:

- near-black / deep navy background
- slightly elevated dark surfaces
- thin muted borders
- compact spacing
- uppercase micro-labels with letter spacing
- muted blue-gray secondary text
- indigo/violet primary button
- restrained hover/focus states
- no excessive glow
- no illustrations
- no marketing-heavy website feel
- quiet, technical, production-ready application screen

Amber should be reserved for warnings/statuses and should not be used on this login page except possibly in the temporary logo mark if already matching the mockup.

## Implementation constraints

Do not:

- paste standalone Stitch HTML directly
- use Tailwind CDN
- use Google Fonts CDN
- use Material Symbols CDN
- add a new component library
- globally replace the full app theme
- touch annotation canvas rendering or mask-color logic
- change auth contracts unless strictly necessary

Prefer:

- existing UI primitives
- semantic token classes
- scoped login/auth styling
- simple inline SVGs if icons are needed

## Suggested component structure

Use the existing repo conventions. If appropriate, extract small components such as:

- `AuthShell`
- `LoginCard`
- `LoginFeatureList`

Do not over-engineer this slice. A focused login page update is sufficient.

## Validation

After implementation, inspect `package.json` and run the repo-appropriate checks.

At minimum, attempt:

- typecheck
- lint
- tests relevant to auth/login if present
- build if reasonably available

Also run grep-style checks to ensure the following are absent from production login UI/code:

- `Demo Credentials`
- `admin1234`
- `admin@sapen.local`
- `cdn.tailwindcss.com`
- `fonts.googleapis.com`
- `Material Symbols`

If any check cannot be run, document why.

## Acceptance criteria

- [ ] Login page visually matches the approved Stitch direction.
- [ ] Existing login/auth behavior is preserved.
- [ ] No demo credentials are shown.
- [ ] No public credential hints remain in the login UI.
- [ ] `Forgot password?` link is present and positioned in the password label row.
- [ ] Header is compact and contains only the temporary logo mark plus `SaPen Annotate`.
- [ ] No help/settings icons are shown before authentication.
- [ ] Footer is compact and contains only the current system/copyright line.
- [ ] Main card is vertically centered between header and footer.
- [ ] Desktop layout uses a two-column split card.
- [ ] Mobile layout stacks the panels cleanly.
- [ ] Inputs have accessible labels and proper autocomplete attributes.
- [ ] Focus states are visible and consistent with the design system.
- [ ] Styling is integrated through existing or scoped design-system tokens/classes.
- [ ] Annotation editor/canvas visual behavior is not unintentionally changed.
- [ ] Typecheck/lint/build/test status is reported.

## Codex implementation prompt

```text
You are working in the SaPen Annotate repository.

Implement DESIGN-001: SaPen Annotate Login Page Redesign.

Goal:
Replace the current generic login page with the approved dark SaPen-style login screen while preserving the existing authentication behavior.

Read first:
- README.md
- DESIGN.md
- tokens.css
- themes.css
- current login page/component
- app shell/header components
- Tailwind setup
- package.json
- existing UI primitives/components

Important:
- Do not paste the standalone Stitch HTML directly.
- Do not use Tailwind CDN.
- Do not use Google Fonts CDN.
- Do not use Material Symbols CDN.
- Do not add a new component library.
- Do not expose demo credentials.
- Do not add help/settings icons before authentication.
- Do not touch editorCanvas.ts or annotation rendering logic unless a compile error forces a trivial import/type fix.

Design:
- Full viewport dark shell.
- Header height around 48px.
- Header left only: temporary circular “S” mark and “SaPen Annotate”.
- Main content vertically centered.
- Central split card about 840px wide on desktop.
- Left panel: Workspace Access + three feature bullets.
- Right panel: Email, Password, Forgot password?, Sign in.
- Footer height around 40px with “© 2026 SaPen Systems.”
- Responsive stacked layout on small screens.
- Use existing semantic classes/tokens where possible.
- Add only scoped or additive styling if needed.

Content:
Title: Workspace Access
Subtitle: Expert correction and annotation workspace for segmentation masks.

Feature bullets:
1. Versioned mask edits
   Track every committed mask version without overwriting model predictions.
2. Core handoff compatible
   Open correction handoffs from SaPen Core with scoped context.
3. Audit-ready corrections
   Keep prediction, expert refinement, and review state clearly separated.

Form:
- Preserve existing auth submit behavior and error handling.
- Email input uses autocomplete="email".
- Password input uses autocomplete="current-password".
- Forgot password link should point to an existing reset route if available; otherwise use the safest repo-consistent placeholder without implementing reset backend.
- Button type must be submit.

Validation:
Run appropriate repo checks:
- typecheck
- lint
- relevant tests
- build if feasible

Run grep checks for:
- Demo Credentials
- admin1234
- admin@sapen.local
- cdn.tailwindcss.com
- fonts.googleapis.com
- Material Symbols

Deliver:
A concise report with:
A. What changed
B. Files changed
C. How auth behavior was preserved
D. Design-system approach
E. Validation commands/results
F. Limitations/TODOs

If repository rules allow commits, create one focused commit:
Update annotate login page to SaPen dark design
```

## Out of scope

- Full SaPen Annotate redesign
- Annotation editor redesign
- Canvas tooling redesign
- Mask color changes
- New logo design
- assembleMIND footer branding implementation
- Password reset backend implementation
- Auth provider changes
- Social login
