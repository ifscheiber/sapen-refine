# RB-128 Shared Refine Annotation Toolbar and Zoom Primitives

## Context

Both the BBox editor and Slice Annotation editor need the same compact toolbar language and stable zoom behavior. Implementing these separately risks inconsistent UI, duplicated state logic, and future drift.

RB-124 through RB-127 can be implemented independently, but a shared primitive ticket can reduce duplication and make the Refine editor family more coherent.

## Goal

Introduce shared UI primitives/hooks for compact annotation toolbars and zoom behavior so that BBox and Slice Annotation editors use the same interaction and visual foundation.

## Scope

### In scope

- Shared compact annotation toolbar primitives.
- Shared icon-only toolbar button component or wrapper.
- Shared segmented-control styling for annotation family/label selection where feasible.
- Shared tooltip/accessibility conventions.
- Shared zoom hook/component:
  - slider;
  - Fit button;
  - stable viewport center behavior;
  - horizontal centering logic.
- Documentation/example usage for BBox and Slice Annotation editors.

### Out of scope

- Implementing the full BBox UX cleanup.
- Implementing full Slice Annotation autosave.
- Backend persistence changes.
- Domain-specific validation logic.

## Required primitives

### 1. Icon toolbar button

A shared component or style wrapper for annotation toolbar buttons:

- icon-only;
- tooltip required;
- accessible label required;
- active state;
- disabled state;
- keyboard focus state;
- same dimensions as Core Quick Analysis annotation toolbar where feasible.

Example conceptual API:

```tsx
<AnnotationIconButton
  icon={<PolygonIcon />}
  label="Polygon tool"
  tooltip="Polygon"
  active={tool === "polygon"}
  disabled={false}
  onClick={...}
/>
```

### 2. Compact toolbar layout

A shared layout helper for compact annotation toolbar rows:

- horizontal grouping;
- consistent spacing;
- separators between logical groups;
- no forced multi-row layout unless responsive constraints require it.

Logical groups:

```text
family | labels | tools | history | view
```

### 3. Shared zoom component/hook

Shared zoom should support:

- zoom slider;
- Fit button;
- min/max zoom;
- optional current zoom display;
- preserve viewport center on slider changes;
- keep image horizontally centered where possible;
- fit-to-viewport with horizontal and vertical centering.

The BBox editor and Slice Annotation editor should use the same component/hook.

### 4. Right-rail status pattern

Optional but preferred: define a common status card pattern for annotation editors:

- current mode/family;
- current label;
- save state;
- readiness/issues;
- current tool help.

This can be a component or just documented layout pattern.

## Acceptance criteria

- A shared icon-only annotation toolbar button primitive exists.
- Shared toolbar button primitive supports tooltip and accessible label.
- Shared toolbar styling is used by at least one editor in this ticket or is ready for RB-124/RB-127 adoption.
- Shared zoom component/hook exists.
- Shared zoom behavior supports stable center/horizontal centering requirements.
- BBox and Slice Annotation tickets can reference the same primitives.
- No visual regression in existing annotation editor toolbar usage.
- Documentation or inline examples explain how to use the shared primitives.

## Validation

Run relevant frontend checks:

```bash
npm run lint
npm run typecheck
npm run test
```

If a component storybook or visual test setup exists, add/update stories for:

- icon toolbar button;
- compact toolbar row;
- zoom slider + fit.
