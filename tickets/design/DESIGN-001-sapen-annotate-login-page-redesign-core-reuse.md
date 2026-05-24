# DESIGN-001 — SaPen Annotate Login Page Redesign with SaPen Core Reuse

## Status

Ready for implementation

## Type

Design / UI implementation ticket

## Target repository

Work in the `sapen-annotate` repository.

Important path context for Codex:

- Codex will be started from the `sapen-annotate` repository.
- The SaPen Core reference repository is located one directory up and then in `sapen`.
- Therefore, paths into the SaPen repository must be referenced as:

```text
../sapen/...
```

Examples:

```text
../sapen/apps/sapen-core/src/features/auth/LoginView.tsx
../sapen/apps/sapen-core/src/features/auth/LoginPageClient.tsx
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/packages/ui/src/styles/theme.css
../sapen/packages/assets/src/index.ts
```

Do **not** assume that `apps/sapen-core/...` exists inside `sapen-annotate`.

## Goal

Redesign the SaPen Annotate login page so that it visually aligns with the SaPen Core dark application shell and the approved SaPen Annotate login mockup, while preserving the existing SaPen Annotate authentication behavior.

The login screen should become a production-ready, dark, compact SaPen-style auth screen.

It must:

- use the SaPen Core visual language where possible
- reuse or mirror existing SaPen Core auth/UI/assets patterns where appropriate
- preserve existing SaPen Annotate login/auth behavior
- avoid public demo credentials
- avoid unauthenticated settings/help controls
- avoid broad changes to the annotation editor or canvas

## Key update compared to the first ticket version

With the full SaPen repository now available as reference, this ticket must explicitly inspect and reuse/mirror existing SaPen Core patterns instead of relying mainly on the Stitch HTML/design.

The Stitch mockup remains the layout target, but the SaPen Core repo is the implementation/design-system reference.

## Reference hierarchy

Use these references in this order:

1. **SaPen Core implementation patterns** from `../sapen/...`
2. **Existing SaPen Annotate auth behavior** in the local repo
3. **Approved Stitch login mockup** as visual/layout target
4. Existing local `sapen-annotate` tokens/theme/components

Do not paste the standalone Stitch HTML.

## Required reference inspection

From the `sapen-annotate` repository, inspect the SaPen Core reference files using `../sapen/...` paths.

### SaPen Core auth references

Inspect:

```text
../sapen/apps/sapen-core/src/features/auth/LoginView.tsx
../sapen/apps/sapen-core/src/features/auth/LoginPageClient.tsx
../sapen/apps/sapen-core/src/features/auth/loginValidation.ts
../sapen/apps/sapen-core/src/features/auth/loginRedirects.ts
```

Purpose:

- learn how SaPen Core structures the login view/client split
- reuse the approach for controlled inputs, validation errors, loading state, and redirect handling if applicable
- reuse the error-display pattern where appropriate
- do not blindly copy the current Core visual design if it conflicts with the approved split-card mockup

Important note:

The current SaPen Core `LoginView` may still use a centered single card with decorative background shapes. Treat it as a **technical/auth/UI component reference**, not as the final visual layout target.

### SaPen Core shell/brand references

Inspect:

```text
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
```

Purpose:

- align header height, border, background, spacing, and SaPen brand treatment
- use SaPen Core topbar conventions where suitable for the unauthenticated login header

### SaPen shared UI/theme/assets references

Inspect:

```text
../sapen/packages/ui/src/styles/theme.css
../sapen/packages/ui/src/styles/index.css
../sapen/packages/ui/src/styles/fonts.css
../sapen/packages/ui/src/components/ui/button.tsx
../sapen/packages/ui/src/components/ui/card.tsx
../sapen/packages/ui/src/components/ui/input.tsx
../sapen/packages/ui/src/components/ui/label.tsx
../sapen/packages/assets/src/index.ts
../sapen/packages/assets/src/sapen-logo-grey.svg
../sapen/packages/assets/src/sapen-logo-white.svg
../sapen/packages/assets/src/logo-assemblemind.png
```

Purpose:

- reuse/mirror existing enterprise CSS variables and component styles
- reuse/mirror SaPen logo handling if assets are available in `sapen-annotate`
- reuse/mirror `Button`, `Card`, `Input`, and `Label` patterns if the local repo has matching primitives
- use `assembleMindLogo` / powered-by footer pattern if the local repo already has access to the asset, or leave a clean placeholder for later

Important:

Do not import files directly from `../sapen/...` into `sapen-annotate` unless the repository is intentionally configured to do so. The `../sapen` paths are primarily a **reference source**. Prefer local reuse, local equivalents, or carefully mirrored patterns.

### SaPen Annotate local inspection

Inspect local `sapen-annotate` files before implementation:

```text
README.md
DESIGN.md
tokens.css
themes.css
package.json
src/app
src/components
src/lib
```

Locate the current login page/client/view and auth utilities. If these exact paths do not exist, find equivalent files.

## Design-system reuse strategy

Use the safest available option:

1. Prefer existing `sapen-annotate` components/tokens if they already map well to the SaPen Core style.
2. If the local repo already consumes `@sapen/ui` and `@sapen/assets`, reuse:
   - `Button`
   - `Card`
   - `Input`
   - `Label`
   - `sapenLogoGrey` or `sapenLogoWhite`
   - `assembleMindLogo`
3. If `@sapen/ui` / `@sapen/assets` are not available in `sapen-annotate`, mirror the relevant styling locally with scoped auth classes.
4. Do not introduce a new component library.
5. Do not add CDN fonts, icons, or Tailwind.
6. Do not globally replace the theme if that risks changing annotation editor/canvas behavior.

Preferred semantic variables/classes should follow the SaPen Core enterprise tokens where available:

```text
--app-background
--shell-topbar-bg
--workspace-background
--workspace-surface
--workspace-input-background
--border-subtle
--border-default
--accent-primary
--accent-primary-hover
--text-primary
--text-secondary
--text-muted
--brand
--brand-hover
--focus-ring
```

If these variables are not present locally, add only minimal scoped/additive variables needed for the login page.

## Approved visual layout

The approved Stitch mockup is the visual layout target:

- full viewport dark shell
- compact top header
- SaPen/SaPen Annotate branding on the left
- centered split-card login panel
- left side: product/module context
- right side: login form
- compact footer
- no demo credentials
- no unauthenticated help/settings icons

## Required layout

### Page shell

- Full viewport layout.
- Dark background aligned with SaPen Core shell.
- Flex column structure:
  - compact header
  - centered main content
  - compact footer

### Header

Prefer SaPen Core `AppTopBar` style:

- height approximately `48px` to `56px`
- dark shell background
- bottom border using muted/subtle border token
- horizontal padding close to SaPen Core
- left side:
  - SaPen logo if available
  - otherwise temporary circular/hex `S` mark
  - `SaPen Annotate`
- no right-side unauthenticated icons
- no settings icon
- no help icon

Logo guidance:

- If `sapen-annotate` can import/use SaPen assets safely, use the SaPen grey/white logo asset and add `Annotate` as module text.
- If not, keep the temporary mark but make it easy to replace later.

### Main content

- Vertically center the login card between header and footer.
- Use responsive padding.
- Avoid large empty white/light areas.
- Keep the layout compact and precise.

### Login card

Desktop:

- width around `840px`
- two-column grid:
  - left information panel
  - right form panel
- 1px border around card
- 1px divider between panels
- subtle radius consistent with SaPen Core
- tonal layering instead of heavy shadow

Small screens:

- stack panels vertically
- avoid horizontal overflow
- keep inputs and button usable

### Footer

Keep the footer because future assembleMIND branding is expected.

Current minimal footer:

```text
© 2026 SaPen Systems.
```

If `assembleMindLogo` is available locally, the footer may already include or prepare for:

```text
powered by assembleMIND
```

Requirements:

- height approximately `40px`
- subtle top border
- no marketing navigation
- no external links unless already part of product conventions
- keep it visually quiet

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

- Use existing icon utilities only if already installed.
- If no icon utility exists, use simple inline SVGs or omit icons.
- Do not add Google Material Symbols.
- Do not add a new icon dependency.

### Right panel

Login form:

- Email field
- Password field
- `Forgot password?` link aligned right in the same row as the `Password` label
- full-width `Sign in` button

Labels:

- `Email`
- `Password`

Do not use:

- `Identifier`
- `Security Key`

Optional access-request link:

- SaPen Core has a `Request access` action pattern.
- Only include `Request access` if SaPen Annotate already supports it or product wants it now.
- If unsupported, omit it to keep the screen clean.

## Form and authentication requirements

Preserve existing SaPen Annotate authentication behavior exactly.

Implementation must:

- keep existing login submit behavior
- preserve existing auth API contracts
- preserve existing redirect/next handling
- preserve existing auth/RBAC behavior
- preserve existing error handling
- restyle validation/auth errors into the new design
- use a real submit button: `type="submit"`
- use accessible labels
- support keyboard navigation
- provide visible focus states
- use `autocomplete="email"` on the email input
- use `autocomplete="current-password"` on the password input
- keep loading state, e.g. `Signing in...`

If SaPen Annotate lacks robust validation and SaPen Core validation can be mirrored safely, consider mirroring the Core `loginValidation` approach locally without changing auth contracts.

### Forgot password behavior

Before implementing, inspect whether a password reset route/flow already exists.

- If a route exists, link to it.
- If no route exists, keep the link visible but handle it safely according to local repo conventions, e.g. set a non-sensitive inline message: `Password reset is not available yet.`
- Do not implement a full password-reset backend in this ticket.
- Do not route to a broken page.

## Security constraints

The login page must never show demo credentials.

Do not include or render:

```text
Demo Credentials
admin@sapen.local
admin1234
```

Also avoid:

- any other public credential hint
- unauthenticated settings icon
- unauthenticated help icon
- social login
- public auth hints that weaken security

## Visual style requirements

Match SaPen Core / Obsidian Laboratory direction:

- `--app-background` / near-black base
- `--shell-topbar-bg` for header if available
- `--workspace-surface` or equivalent for card panels
- dark input background
- thin muted borders
- compact spacing
- uppercase micro-labels with letter spacing
- muted blue-gray secondary text
- indigo/violet primary action
- restrained hover/focus states
- no excessive glow
- no decorative background blobs unless already part of Core and still restrained
- no marketing-heavy website feel
- quiet, technical, production-ready application screen

Amber should be reserved for warnings/statuses and should not be used on this login page except possibly in a temporary mark if already consistent.

## Explicit implementation constraints

Do not:

- paste standalone Stitch HTML
- use Tailwind CDN
- use Google Fonts CDN
- use Material Symbols CDN
- add a new component library
- globally replace the full app theme
- touch annotation canvas rendering
- touch mask-color logic
- change auth contracts unless strictly necessary
- import directly from `../sapen/...` unless the repo is intentionally configured to support that

Prefer:

- existing SaPen Annotate primitives
- `@sapen/ui` primitives if locally available
- `@sapen/assets` if locally available
- scoped auth/login styling
- SaPen Core enterprise token names where safe

## Suggested component structure

Use local repository conventions.

Possible components:

```text
LoginPageClient
LoginView
AuthShell
LoginFeatureList
LoginFooterBranding
```

Do not over-engineer. A focused login page update is sufficient.

## Validation

Inspect local `package.json` and run the repo-appropriate commands.

At minimum attempt:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If the repository uses different scripts, use the correct ones.

Also run grep-style checks to ensure the following are absent from production login UI/code:

```text
Demo Credentials
admin1234
admin@sapen.local
cdn.tailwindcss.com
fonts.googleapis.com
Material Symbols
```

If any command cannot be run, document why.

## Acceptance criteria

- [ ] Login page visually matches the approved split-card SaPen Annotate direction.
- [ ] SaPen Core auth/UI/assets patterns were inspected via `../sapen/...`.
- [ ] Existing SaPen Annotate login/auth behavior is preserved.
- [ ] Existing redirect/next handling is preserved.
- [ ] Existing auth errors and validation errors remain visible and accessible.
- [ ] No demo credentials are shown.
- [ ] No public credential hints remain in the login UI.
- [ ] `Forgot password?` link is present and safely handled.
- [ ] Header follows SaPen Core topbar styling as closely as practical.
- [ ] Header contains only SaPen/SaPen Annotate branding, no unauthenticated help/settings icons.
- [ ] Footer is compact and ready for future assembleMIND branding.
- [ ] Main card is vertically centered between header and footer.
- [ ] Desktop layout uses a two-column split card.
- [ ] Mobile layout stacks panels cleanly.
- [ ] Inputs have accessible labels and proper autocomplete attributes.
- [ ] Focus states are visible and consistent with SaPen Core tokens.
- [ ] Styling is integrated through local/shared tokens or scoped auth classes.
- [ ] Annotation editor/canvas visual behavior is not unintentionally changed.
- [ ] Typecheck/lint/test/build status is reported.

## Codex implementation prompt

```text
You are working in the sapen-annotate repository.

Important:
The SaPen Core reference repository is located at ../sapen relative to the sapen-annotate repository root.
When inspecting SaPen Core files, use paths like ../sapen/apps/sapen-core/...
Do not assume apps/sapen-core exists inside sapen-annotate.

Implement DESIGN-001: SaPen Annotate Login Page Redesign with SaPen Core Reuse.

Goal:
Replace the current generic login page with the approved dark SaPen-style split-card login screen while preserving the existing SaPen Annotate authentication behavior.

First inspect SaPen Core references:
../sapen/apps/sapen-core/src/features/auth/LoginView.tsx
../sapen/apps/sapen-core/src/features/auth/LoginPageClient.tsx
../sapen/apps/sapen-core/src/features/auth/loginValidation.ts
../sapen/apps/sapen-core/src/features/auth/loginRedirects.ts
../sapen/apps/sapen-core/src/features/shell/AppTopBar.tsx
../sapen/packages/ui/src/styles/theme.css
../sapen/packages/ui/src/components/ui/button.tsx
../sapen/packages/ui/src/components/ui/card.tsx
../sapen/packages/ui/src/components/ui/input.tsx
../sapen/packages/ui/src/components/ui/label.tsx
../sapen/packages/assets/src/index.ts

Then inspect local sapen-annotate files:
README.md
DESIGN.md
tokens.css
themes.css
package.json
src/app
src/components
src/lib

If paths differ, locate equivalent files.

Use SaPen Core as the implementation/style reference:
- auth view/client split
- validation/error display pattern if applicable
- AppTopBar brand/header style
- @sapen/ui Button/Card/Input/Label patterns if available
- @sapen/assets logo/powered-by patterns if available
- enterprise CSS variables such as --app-background, --shell-topbar-bg, --workspace-surface, --border-subtle, --accent-primary, --text-primary, --text-secondary

Do not import directly from ../sapen unless the local repo is intentionally configured to support it. Use it as a reference source and reuse local equivalents or scoped mirrored patterns.

Approved layout:
- full viewport dark shell
- compact header
- centered split card about 840px wide
- left panel: Workspace Access + three feature bullets
- right panel: Email, Password, Forgot password?, Sign in
- compact footer with © 2026 SaPen Systems and optional powered-by assembleMIND if local asset is available
- responsive stacked layout on small screens

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
- preserve existing auth submit behavior and API contracts
- preserve redirect/next behavior
- preserve existing auth errors
- Email input uses autocomplete="email"
- Password input uses autocomplete="current-password"
- Forgot password link should use an existing reset route if available; otherwise show a safe inline not-available message
- Button type must be submit
- Loading state must remain

Security:
- no demo credentials
- no admin@sapen.local
- no admin1234
- no help/settings icons before authentication
- no social login
- no CDN fonts/icons/Tailwind

Do not touch:
- AnnotationCanvas drawing logic
- mask serialization/deserialization
- mask overlay rendering
- autosave behavior
- Core handoff contracts
unless a compile error forces a trivial import/type fix.

Run validation:
- typecheck
- lint
- relevant tests
- build if feasible

Run grep checks for:
Demo Credentials
admin1234
admin@sapen.local
cdn.tailwindcss.com
fonts.googleapis.com
Material Symbols

Deliver a concise report:
A. What changed
B. Files changed
C. SaPen Core patterns/assets/components reused or mirrored
D. How auth behavior and redirect handling were preserved
E. Validation commands/results
F. Limitations/follow-ups

If repository rules allow commits, create one focused commit:
Update annotate login page to SaPen Core style
```

## Out of scope

- Full SaPen Annotate redesign
- Auth provider changes
- Password reset backend implementation
- Social login
- New logo design
- Full assembleMIND footer branding if assets are not locally available
- Annotation editor redesign
- Canvas tooling redesign
- Mask color changes
