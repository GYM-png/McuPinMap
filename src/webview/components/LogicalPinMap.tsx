import type { Pin } from "../../shared/types";
import { usePinMapStore } from "../state/usePinMapStore";
import { PackageMap } from "./PackageMap";

type PortGroup = {
  port: string;
  pins: Pin[];
};

const groupPinsByPort = (pins: Pin[]): PortGroup[] => {
  const groups = pins.reduce<Record<string, Pin[]>>((result, pin) => {
    const port = pin.port || "Other";
    result[port] = result[port] ?? [];
    result[port].push(pin);

    return result;
  }, {});

  return Object.entries(groups)
    .map(([port, portPins]) => ({
      port,
      pins: [...portPins].sort((left, right) => left.number - right.number)
    }))
    .sort((left, right) => left.port.localeCompare(right.port));
};

export const LogicalPinMap = (): JSX.Element => {
  const chip = usePinMapStore((state) => state.chip);
  const selectedPinName = usePinMapStore((state) => state.selectedPinName);
  const searchResults = usePinMapStore((state) => state.searchResults);
  const assignments = usePinMapStore((state) => state.assignments);
  const conflicts = usePinMapStore((state) => state.conflicts);
  const mapView = usePinMapStore((state) => state.mapView);
  const selectedPackageName = usePinMapStore((state) => state.selectedPackageName);
  const selectPin = usePinMapStore((state) => state.selectPin);
  const setMapView = usePinMapStore((state) => state.setMapView);
  const setSelectedPackageName = usePinMapStore((state) => state.setSelectedPackageName);

  const assignedPins = new Set(assignments.map((assignment) => assignment.pinName));
  const conflictedAssignmentIds = new Set(
    conflicts.flatMap((conflict) => conflict.assignmentIds)
  );
  const conflictedPins = new Set(
    assignments
      .filter((assignment) => conflictedAssignmentIds.has(assignment.id))
      .map((assignment) => assignment.pinName)
  );
  const searchPins = new Set(searchResults.map((result) => result.pinName));
  const ports = groupPinsByPort(chip?.pins ?? []);
  const selectedPackage = chip?.packages.find(
    (layout) => layout.packageName === selectedPackageName
  );
  const canShowPackageView = (chip?.packages.length ?? 0) > 0;

  if (!chip) {
    return (
      <section className="panel map-panel empty-map">
        <p className="empty-state">Search online chip data or import a local CSV to begin.</p>
      </section>
    );
  }

  return (
    <section className="panel map-panel" aria-labelledby="logical-map-title">
      <div className="map-title-row">
        <div>
          <p className="eyebrow">{mapView === "package" ? "Package Map" : "Logical Map"}</p>
          <h2 id="logical-map-title">{chip.displayName}</h2>
        </div>
        <div className="map-toolbar">
          <div className="map-view-toggle" aria-label="Map view">
            <button
              type="button"
              className={mapView === "logical" ? "is-active" : undefined}
              onClick={() => setMapView("logical")}
            >
              Logical
            </button>
            {canShowPackageView ? (
              <button
                type="button"
                className={mapView === "package" ? "is-active" : undefined}
                onClick={() => setMapView("package")}
              >
                Package
              </button>
            ) : null}
          </div>

          {canShowPackageView ? (
            <select
              className="package-selector"
              aria-label="Select package"
              value={selectedPackageName ?? ""}
              onChange={(event) => setSelectedPackageName(event.target.value)}
            >
              {chip.packages.map((layout) => (
                <option key={layout.packageName} value={layout.packageName}>
                  {layout.packageName}
                </option>
              ))}
            </select>
          ) : null}

          <dl className="summary-pills" aria-label="Map summary">
            <div>
              <dt>{mapView === "package" ? "Pads" : "Pins"}</dt>
              <dd>{mapView === "package" ? selectedPackage?.totalPads ?? 0 : chip.pins.length}</dd>
            </div>
            <div>
              <dt>Assigned</dt>
              <dd>{assignedPins.size}</dd>
            </div>
            <div>
              <dt>Conflicts</dt>
              <dd>{conflicts.length}</dd>
            </div>
          </dl>
        </div>
      </div>

      {mapView === "package" && selectedPackage ? (
        <PackageMap layout={selectedPackage} />
      ) : (
        <div className="port-grid">
          {ports.map((group) => (
            <article key={group.port} className="port-card">
              <h3>{group.port}</h3>
              <div className="pin-grid">
                {group.pins.map((pin) => {
                  const classNames = [
                    "pin-button",
                    pin.name === selectedPinName ? "is-selected" : "",
                    searchPins.has(pin.name) ? "is-search-match" : "",
                    assignedPins.has(pin.name) ? "is-assigned" : "",
                    conflictedPins.has(pin.name) ? "is-conflict" : ""
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={pin.name}
                      type="button"
                      className={classNames}
                      onClick={() => selectPin(pin.name)}
                    >
                      <span>{pin.name}</span>
                      <small>{pin.functions.length} fn</small>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
