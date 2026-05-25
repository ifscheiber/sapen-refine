export const activeButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-sm border border-[var(--accent-primary)] bg-[var(--workspace-selected)] px-2.5 text-[11px] font-semibold text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--focus-ring)] transition-colors hover:bg-[var(--workspace-panel-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50";

export const idleButtonClass =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--workspace-panel)] px-2.5 text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--workspace-panel-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50";

export const canvasToolbarShellClass =
  "shrink-0 border-b border-[var(--border-subtle)] bg-[var(--workspace-background)] px-0 py-1";

export const canvasToolbarContentClass =
  "flex w-full flex-wrap items-center gap-x-4 gap-y-1.5";

export const canvasToolbarIconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[var(--border-subtle)] bg-[var(--workspace-panel)] px-0 text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--workspace-panel-hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50";

export const canvasToolbarIconButtonActiveClass =
  "border-[var(--accent-primary)] bg-[var(--workspace-selected)] text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--focus-ring)]";

export const canvasToolbarDividerClass =
  "h-5 w-px bg-[var(--border-subtle)]";

export const canvasToolbarZoomSliderClass =
  "w-28 [&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-[var(--workspace-panel)] [&_[data-slot=slider-range]]:bg-[var(--accent-primary)] [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-thumb]]:border-[var(--border-hover)] [&_[data-slot=slider-thumb]]:bg-[var(--text-primary)]";
