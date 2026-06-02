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

export const getLqfpBodySize = (totalPads: number): string => {
  if (totalPads >= 176) {
    return "min(68vw, 700px)";
  }

  if (totalPads >= 144) {
    return "min(64vw, 620px)";
  }

  return "min(56vw, 520px)";
};

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
