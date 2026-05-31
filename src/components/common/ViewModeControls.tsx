/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: ViewModeControls.tsx
 *
 * Description:
 * Shared controls for per-surface anchor and normalization view preferences.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import SegmentedToggle from "@/components/common/SegmentedToggle";
import {
  SURFACE_AVAILABLE_AXES,
  VIEW_MODE_AXIS_OPTIONS,
  type ViewAxis,
  type ViewSurface,
} from "@/lib/viewMode/viewModeTypes";
import { useViewMode } from "@/lib/viewMode/viewModeStore";

type ViewModeControlsProps = {
  surface: ViewSurface;
  availableAxes?: ViewAxis[];
  size?: "sm" | "md";
};

const AXIS_LABEL: Record<ViewAxis, string> = {
  anchor: "Anchor",
  normalization: "Metric",
};

export default function ViewModeControls({
  surface,
  availableAxes,
  size = "md",
}: ViewModeControlsProps) {
  const [viewMode, setViewMode] = useViewMode(surface);
  const axes = availableAxes ?? SURFACE_AVAILABLE_AXES[surface];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {axes.map((axis) => (
        <div key={axis} className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-(--muted)">
            {AXIS_LABEL[axis]}
          </span>
          <SegmentedToggle
            ariaLabel={`${AXIS_LABEL[axis]} mode`}
            value={viewMode[axis]}
            items={VIEW_MODE_AXIS_OPTIONS[axis]}
            onChange={(next) => setViewMode({ ...viewMode, [axis]: next })}
            size={size}
          />
        </div>
      ))}
    </div>
  );
}
