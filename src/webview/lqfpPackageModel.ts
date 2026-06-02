import type { SearchResult } from "../shared/data/searchIndex";
import type { Assignment, Conflict, PackagePin, Pin } from "../shared/types";

export type LqfpSide = "top" | "right" | "bottom" | "left";

export type LqfpSides = Record<LqfpSide, PackagePin[]>;

export type PackagePinClassificationInput = {
  packagePin: PackagePin;
  pinsByName: Map<string, Pin>;
  selectedPinName?: string;
  searchResults: SearchResult[];
  assignments: Assignment[];
  conflicts: Conflict[];
};

export type PackagePinViewModel = {
  packagePin: PackagePin;
  pin?: Pin;
  label: string;
  isInteractive: boolean;
  isSelected: boolean;
  isSearchMatch: boolean;
  isAssigned: boolean;
  isConflict: boolean;
  classNames: string;
};

export type PackageDragInput = {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
};

export type PackagePanDragInput = {
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
  startPanX: number;
  startPanY: number;
};

export type PackagePanBoundsInput = {
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
};

export const getLqfpBodySize = (totalPads: number): string => {
  if (totalPads >= 176) {
    return "min(68vw, 700px)";
  }

  if (totalPads >= 144) {
    return "min(64vw, 620px)";
  }

  return "min(56vw, 520px)";
};

const PACKAGE_ZOOM_STEP = 0.1;
const PACKAGE_ZOOM_MIN = 0.6;
const PACKAGE_ZOOM_MAX = 1.8;
const PACKAGE_MIN_VISIBLE_EDGE = 24;

export const getNextPackageZoom = (currentZoom: number, wheelDeltaY: number): number => {
  const direction = wheelDeltaY < 0 ? 1 : -1;
  const nextZoom = currentZoom + direction * PACKAGE_ZOOM_STEP;
  const clampedZoom = Math.min(PACKAGE_ZOOM_MAX, Math.max(PACKAGE_ZOOM_MIN, nextZoom));

  return Math.round(clampedZoom * 10) / 10;
};

export const stopPackageWheelScroll = (event: {
  preventDefault: () => void;
  stopPropagation: () => void;
}): void => {
  event.preventDefault();
  event.stopPropagation();
};

export const getDraggedPackageScroll = ({
  startClientX,
  startClientY,
  currentClientX,
  currentClientY,
  startScrollLeft,
  startScrollTop
}: PackageDragInput): { scrollLeft: number; scrollTop: number } => ({
  scrollLeft: startScrollLeft + startClientX - currentClientX,
  scrollTop: startScrollTop + startClientY - currentClientY
});

export const getDraggedPackagePan = ({
  startClientX,
  startClientY,
  currentClientX,
  currentClientY,
  startPanX,
  startPanY
}: PackagePanDragInput): { panX: number; panY: number } => ({
  panX: startPanX + currentClientX - startClientX,
  panY: startPanY + currentClientY - startClientY
});

export const getCenteredPackagePan = (): { panX: number; panY: number } => ({
  panX: 0,
  panY: 0
});

export const getPackagePanBounds = ({
  viewportWidth,
  viewportHeight,
  contentWidth,
  contentHeight
}: PackagePanBoundsInput): {
  minPanX: number;
  maxPanX: number;
  minPanY: number;
  maxPanY: number;
} => {
  const minVisibleWidth = Math.min(PACKAGE_MIN_VISIBLE_EDGE, viewportWidth, contentWidth);
  const minVisibleHeight = Math.min(PACKAGE_MIN_VISIBLE_EDGE, viewportHeight, contentHeight);

  return {
    minPanX: minVisibleWidth - contentWidth,
    maxPanX: viewportWidth - minVisibleWidth,
    minPanY: minVisibleHeight - contentHeight,
    maxPanY: viewportHeight - minVisibleHeight
  };
};

export const clampPackagePan = (
  pan: { x: number; y: number },
  bounds: ReturnType<typeof getPackagePanBounds>
): { x: number; y: number } => ({
  x: Math.min(bounds.maxPanX, Math.max(bounds.minPanX, pan.x)),
  y: Math.min(bounds.maxPanY, Math.max(bounds.minPanY, pan.y))
});

const emptySides = (): LqfpSides => ({
  top: [],
  right: [],
  bottom: [],
  left: []
});

export const deriveLqfpSides = (layout: { totalPads: number; pins: PackagePin[] }): LqfpSides => {
  const pinsByPad = new Map(layout.pins.map((pin) => [pin.padNumber, pin]));
  const perSide = layout.totalPads / 4;
  const sides = emptySides();

  if (!Number.isInteger(perSide) || perSide <= 0) {
    return sides;
  }

  for (let padNumber = 1; padNumber <= layout.totalPads; padNumber += 1) {
    const packagePin = pinsByPad.get(padNumber);
    if (!packagePin) {
      continue;
    }

    if (padNumber <= perSide) {
      sides.left.push(packagePin);
    } else if (padNumber <= perSide * 2) {
      sides.bottom.push(packagePin);
    } else if (padNumber <= perSide * 3) {
      sides.right.unshift(packagePin);
    } else {
      sides.top.unshift(packagePin);
    }
  }

  return sides;
};

export const classifyPackagePin = ({
  packagePin,
  pinsByName,
  selectedPinName,
  searchResults,
  assignments,
  conflicts
}: PackagePinClassificationInput): PackagePinViewModel => {
  const pin = pinsByName.get(packagePin.pinName);
  const isMappedGpio = packagePin.pinType === "gpio" && pin !== undefined;
  const conflictedAssignmentIds = new Set(conflicts.flatMap((conflict) => conflict.assignmentIds));
  const isAssigned = assignments.some((assignment) => assignment.pinName === packagePin.pinName);
  const isConflict = assignments.some(
    (assignment) =>
      assignment.pinName === packagePin.pinName &&
      conflictedAssignmentIds.has(assignment.id)
  );
  const isSearchMatch = searchResults.some((result) => result.pinName === packagePin.pinName);
  const isSelected = packagePin.pinName === selectedPinName;
  const typeClass = `is-${packagePin.pinType ?? "unknown"}`;
  const classNames = [
    "lqfp-pad",
    typeClass,
    isMappedGpio ? "is-interactive" : "",
    packagePin.pinType === "gpio" && !pin ? "is-unmapped" : "",
    isSelected ? "is-selected" : "",
    isSearchMatch ? "is-search-match" : "",
    isAssigned ? "is-assigned" : "",
    isConflict ? "is-conflict" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return {
    packagePin,
    pin,
    label: packagePin.pinName,
    isInteractive: isMappedGpio,
    isSelected,
    isSearchMatch,
    isAssigned,
    isConflict,
    classNames
  };
};
