import type { CSSProperties } from "react";
import type { PackageLayout, Pin } from "../../shared/types";
import {
  classifyPackagePin,
  deriveLqfpSides,
  getLqfpBodySize,
  type LqfpSide
} from "../lqfpPackageModel";
import { usePinMapStore } from "../state/usePinMapStore";

type LqfpPackageMapProps = {
  layout: PackageLayout;
};

const sideLabels: Record<LqfpSide, string> = {
  top: "Top side",
  right: "Right side",
  bottom: "Bottom side",
  left: "Left side"
};

const sideGridStyle = (side: LqfpSide, padCount: number): CSSProperties =>
  side === "left" || side === "right"
    ? { gridTemplateRows: `repeat(${padCount}, minmax(0, 1fr))` }
    : { gridTemplateColumns: `repeat(${padCount}, minmax(0, 1fr))` };

const packageMapStyle = (totalPads: number): CSSProperties & Record<string, string> => ({
  "--lqfp-body-size": getLqfpBodySize(totalPads)
});

export const LqfpPackageMap = ({ layout }: LqfpPackageMapProps): JSX.Element => {
  const chip = usePinMapStore((state) => state.chip);
  const selectedPinName = usePinMapStore((state) => state.selectedPinName);
  const searchResults = usePinMapStore((state) => state.searchResults);
  const assignments = usePinMapStore((state) => state.assignments);
  const conflicts = usePinMapStore((state) => state.conflicts);
  const selectPin = usePinMapStore((state) => state.selectPin);
  const pinsByName = new Map((chip?.pins ?? []).map((pin): [string, Pin] => [pin.name, pin]));
  const sides = deriveLqfpSides(layout);

  const renderSide = (side: LqfpSide): JSX.Element => (
    <div
      className={`lqfp-side lqfp-side-${side}`}
      aria-label={sideLabels[side]}
      style={sideGridStyle(side, sides[side].length)}
    >
      {sides[side].map((packagePin) => {
        const viewModel = classifyPackagePin({
          packagePin,
          pinsByName,
          selectedPinName,
          searchResults,
          assignments,
          conflicts
        });
        const title = `Pad ${packagePin.padNumber}: ${packagePin.pinName}`;

        return (
          <button
            key={packagePin.padNumber}
            type="button"
            className={viewModel.classNames}
            title={title}
            aria-disabled={!viewModel.isInteractive}
            onClick={() => {
              if (viewModel.pin) {
                selectPin(viewModel.pin.name);
              }
            }}
          >
            <span className="pad-number">{packagePin.padNumber}</span>
            <span className="pad-label">{viewModel.label}</span>
            {viewModel.pin ? (
              <small>{viewModel.pin.functions.length} fn</small>
            ) : (
              <small>{packagePin.pinType ?? "pin"}</small>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className="package-map"
      aria-label={`${layout.packageName} package map`}
      style={packageMapStyle(layout.totalPads)}
    >
      {renderSide("top")}
      {renderSide("left")}
      <div className="lqfp-body" aria-hidden="true">
        <strong>{layout.packageName}</strong>
        <span>{layout.totalPads} pads</span>
      </div>
      {renderSide("right")}
      {renderSide("bottom")}
    </div>
  );
};
