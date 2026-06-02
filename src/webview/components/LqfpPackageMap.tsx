import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import type { PackageLayout, Pin } from "../../shared/types";
import {
  clampPackagePan,
  classifyPackagePin,
  deriveLqfpSides,
  getCenteredPackagePan,
  getDraggedPackagePan,
  getLqfpBodySize,
  getNextPackageZoom,
  getPackagePanBounds,
  stopPackageWheelScroll,
  type PackagePanDragInput,
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

const packageMapStyle = (
  totalPads: number,
  zoom: number,
  pan: { x: number; y: number }
): CSSProperties & Record<string, string> => ({
  "--lqfp-base-body-size": getLqfpBodySize(totalPads),
  "--package-zoom": zoom.toString(),
  "--package-pan-x": `${pan.x}px`,
  "--package-pan-y": `${pan.y}px`
});

export const LqfpPackageMap = ({ layout }: LqfpPackageMapProps): JSX.Element => {
  const packageMapRef = useRef<HTMLDivElement>(null);
  const packageMapContentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<
    Omit<PackagePanDragInput, "currentClientX" | "currentClientY"> | undefined
  >();
  const chip = usePinMapStore((state) => state.chip);
  const selectedPinName = usePinMapStore((state) => state.selectedPinName);
  const searchResults = usePinMapStore((state) => state.searchResults);
  const assignments = usePinMapStore((state) => state.assignments);
  const conflicts = usePinMapStore((state) => state.conflicts);
  const selectPin = usePinMapStore((state) => state.selectPin);
  const pinsByName = new Map((chip?.pins ?? []).map((pin): [string, Pin] => [pin.name, pin]));
  const sides = deriveLqfpSides(layout);

  useEffect(() => {
    const packageMapElement = packageMapRef.current;

    if (!packageMapElement) {
      return;
    }

    const handleWheel = (event: WheelEvent): void => {
      stopPackageWheelScroll(event);
      setZoom((currentZoom) => getNextPackageZoom(currentZoom, event.deltaY));
    };

    packageMapElement.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      packageMapElement.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    const packageMapElement = packageMapRef.current;

    if (!packageMapElement || !dragState) {
      return;
    }

    const handleMouseMove = (event: MouseEvent): void => {
      event.preventDefault();
      event.stopPropagation();

      const nextPan = getDraggedPackagePan({
        ...dragState,
        currentClientX: event.clientX,
        currentClientY: event.clientY
      });

      const contentElement = packageMapContentRef.current;
      const bounds = contentElement
        ? getPackagePanBounds({
            viewportWidth: packageMapElement.clientWidth,
            viewportHeight: packageMapElement.clientHeight,
            contentWidth: contentElement.offsetWidth,
            contentHeight: contentElement.offsetHeight
          })
        : undefined;

      setPan(
        bounds
          ? clampPackagePan({ x: nextPan.panX, y: nextPan.panY }, bounds)
          : { x: nextPan.panX, y: nextPan.panY }
      );
    };

    const handleMouseUp = (): void => {
      setDragState(undefined);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp, { once: true });

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState]);

  const handleBodyMouseDown = (event: ReactMouseEvent<HTMLDivElement>): void => {
    const packageMapElement = packageMapRef.current;

    if (!packageMapElement || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragState({
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y
    });
  };

  const centerPackageMap = (): void => {
    const centeredPan = getCenteredPackagePan();
    setPan({ x: centeredPan.panX, y: centeredPan.panY });
  };

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
      ref={packageMapRef}
      className={`package-map${dragState ? " is-dragging" : ""}`}
      aria-label={`${layout.packageName} package map`}
      title="Use mouse wheel to zoom the package map"
      style={packageMapStyle(layout.totalPads, zoom, pan)}
    >
      <button
        type="button"
        className="package-center-button"
        onClick={centerPackageMap}
        title="Center package map"
      >
        Center
      </button>
      <div ref={packageMapContentRef} className="package-map-content">
        {renderSide("top")}
        {renderSide("left")}
        <div className="lqfp-body" aria-hidden="true" onMouseDown={handleBodyMouseDown}>
          <strong>{layout.packageName}</strong>
          <span>{layout.totalPads} pads</span>
        </div>
        {renderSide("right")}
        {renderSide("bottom")}
      </div>
    </div>
  );
};
