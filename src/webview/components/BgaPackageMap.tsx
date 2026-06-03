import { useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import type { PackageLayout, Pin } from "../../shared/types";
import { buildBgaGridModel } from "../bgaPackageModel";
import {
  clampPackagePan,
  getCenteredPackagePan,
  getDraggedPackagePan,
  getNextPackageZoom,
  getPackagePanBounds,
  stopPackageWheelScroll,
  type PackagePanDragInput
} from "../lqfpPackageModel";
import { usePinMapStore } from "../state/usePinMapStore";

type BgaPackageMapProps = {
  layout: PackageLayout;
};

export const BgaPackageMap = ({ layout }: BgaPackageMapProps): JSX.Element => {
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
  const grid = buildBgaGridModel({
    packagePins: layout.pins,
    pinsByName,
    selectedPinName,
    searchResults,
    assignments,
    conflicts
  });
  const style = {
    "--bga-column-count": grid.columns.length.toString(),
    "--package-zoom": zoom.toString(),
    "--package-pan-x": `${pan.x}px`,
    "--package-pan-y": `${pan.y}px`
  } as CSSProperties & Record<string, string>;

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

    if (
      !packageMapElement ||
      event.button !== 0 ||
      (event.target instanceof HTMLElement && event.target.closest("button"))
    ) {
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

  return (
    <div
      ref={packageMapRef}
      className={`package-map bga-package-map${dragState ? " is-dragging" : ""}`}
      aria-label={`${layout.packageName} package map`}
      title="Use mouse wheel to zoom the package map"
      style={style}
    >
      <button
        type="button"
        className="package-center-button"
        onClick={centerPackageMap}
        title="Center package map"
      >
        Center
      </button>
      <div
        ref={packageMapContentRef}
        className="bga-grid-shell"
        onMouseDown={handleBodyMouseDown}
      >
        <div className="bga-package-frame">
          <div className="bga-package-title">
            <strong>{layout.packageName}</strong>
            <span>{layout.totalPads} balls</span>
          </div>
          <div className="bga-corner" aria-hidden="true" />
          <div className="bga-column-header" aria-label="BGA columns">
            {grid.columns.map((column) => (
              <span key={column}>{column}</span>
            ))}
          </div>

          {grid.rows.map((row, rowIndex) => (
            <div key={row} className="bga-row">
              <div className="bga-row-label">{row}</div>
              <div className="bga-row-cells">
                {grid.cells[rowIndex].map((cell) => {
                  const viewModel = cell.viewModel;
                  const packagePin = cell.packagePin;

                  if (!viewModel || !packagePin) {
                    return (
                      <span
                        key={`${cell.row}${cell.column}`}
                        className="bga-ball is-empty"
                        aria-hidden="true"
                      />
                    );
                  }

                  return (
                    <button
                      key={packagePin.ballName}
                      type="button"
                      className={`bga-ball ${viewModel.classNames}`}
                      title={`${packagePin.ballName}: ${packagePin.pinName}`}
                      aria-disabled={!viewModel.isInteractive}
                      onClick={() => {
                        if (viewModel.pin) {
                          selectPin(viewModel.pin.name);
                        }
                      }}
                    >
                      <span className="ball-name">{packagePin.ballName}</span>
                      <span className="ball-label">{viewModel.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
