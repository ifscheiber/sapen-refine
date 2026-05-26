"use client";

import type React from "react";
import { Maximize2Icon, SearchIcon } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/components/ui/utils";
import { clampNumber } from "../canvasGeometry";
import {
  canvasToolbarContentClass,
  canvasToolbarDividerClass,
  canvasToolbarIconButtonActiveClass,
  canvasToolbarIconButtonClass,
  canvasToolbarShellClass,
  canvasToolbarZoomSliderClass,
} from "../editorStyles";

export function AnnotationToolbarShell({
  children,
  ariaLabel,
  className,
  contentClassName,
}: {
  children: React.ReactNode;
  ariaLabel: string;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn(canvasToolbarShellClass, className)}>
      <div role="toolbar" aria-label={ariaLabel} className={cn(canvasToolbarContentClass, contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export function AnnotationToolbarGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex items-center gap-1.5", className)}>{children}</div>;
}

export function AnnotationToolbarDivider({ className }: { className?: string }) {
  return <div className={cn(canvasToolbarDividerClass, className)} />;
}

export function AnnotationIconButton({
  icon: Icon,
  label,
  tooltip = label,
  active = false,
  disabled = false,
  onClick,
  className,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: "true" }>;
  label: string;
  tooltip?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(canvasToolbarIconButtonClass, active && canvasToolbarIconButtonActiveClass, className)}
          aria-label={label}
          aria-pressed={active || undefined}
          onClick={onClick}
          disabled={disabled}
        >
          <Icon className="size-4" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function AnnotationSegmentButton({
  children,
  label,
  active = false,
  disabled = false,
  onClick,
  swatch,
  title,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  swatch?: [number, number, number];
  title?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-sm border px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-50",
        active
          ? "border-[var(--accent-primary)] bg-[var(--workspace-selected)] text-[var(--text-primary)] shadow-[inset_0_0_0_1px_var(--focus-ring)]"
          : "border-[var(--border-subtle)] bg-[var(--workspace-panel)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:bg-[var(--workspace-panel-hover)] hover:text-[var(--text-primary)]",
      )}
      aria-label={title ? `${label}: ${title}` : label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {swatch ? (
        <span
          className="size-2 rounded-full border border-[var(--border-subtle)]"
          style={{ backgroundColor: `rgb(${swatch[0]}, ${swatch[1]}, ${swatch[2]})` }}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </button>
  );
}

export function AnnotationZoomControl({
  zoom,
  minZoom,
  maxZoom,
  onZoomChange,
  onFit,
  label = "Zoom",
  fitLabel = "Fit image",
  title,
}: {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomChange?: (zoom: number) => void;
  onFit?: () => void;
  label?: string;
  fitLabel?: string;
  title?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]" title={title}>
      <SearchIcon className="size-3.5" aria-hidden="true" />
      <Slider
        aria-label={label}
        value={[zoom]}
        min={minZoom}
        max={maxZoom}
        step={0.01}
        onValueChange={(value) => onZoomChange?.(clampNumber(value[0] ?? zoom, minZoom, maxZoom))}
        disabled={!onZoomChange}
        className={canvasToolbarZoomSliderClass}
      />
      <span className="w-10 text-right tabular-nums">{Math.round(zoom * 100)}%</span>
      <AnnotationIconButton
        icon={Maximize2Icon}
        label={fitLabel}
        tooltip={fitLabel}
        onClick={onFit}
        disabled={!onFit}
      />
    </div>
  );
}
