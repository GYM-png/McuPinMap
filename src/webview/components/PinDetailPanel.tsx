import { createAssignmentId } from "../../shared/config/assignmentStore";
import { createFunctionAssignmentMessage } from "../assignmentMessages";
import { usePinMapStore } from "../state/usePinMapStore";
import { vscode } from "../vscodeApi";

export const PinDetailPanel = (): JSX.Element => {
  const chip = usePinMapStore((state) => state.chip);
  const pin = usePinMapStore((state) => state.selectedPin());
  const assignments = usePinMapStore((state) => state.assignments);
  const assignedFunctionIds = new Set(
    assignments
      .filter((assignment) => assignment.pinName === pin?.name)
      .map((assignment) => assignment.id)
  );

  return (
    <section className="panel detail-panel" aria-labelledby="pin-detail-title">
      <div className="panel-heading">
        <p className="eyebrow">Pin Detail</p>
        <h2 id="pin-detail-title">{pin?.name ?? "Select a pin"}</h2>
      </div>

      {!chip || !pin ? (
        <p className="empty-state">Choose a pin from the logical map to inspect functions.</p>
      ) : (
        <>
          <p className="meta-line">
            Port {pin.port}, index {pin.number}
          </p>
          <div className="function-list">
            {pin.functions.length === 0 ? (
              <p className="empty-state">No alternate functions listed for this pin.</p>
            ) : null}
            {pin.functions.map((fn) => {
              const assignment = {
                id: createAssignmentId(chip.id, pin.name, fn.raw),
                chipId: chip.id,
                pinName: pin.name,
                functionRaw: fn.raw,
                af: fn.af,
                peripheral: fn.peripheral,
                signal: fn.signal
              };
              const isAssigned = assignedFunctionIds.has(assignment.id);

              return (
                <article key={assignment.id} className="function-card">
                  <div>
                    <strong>{fn.raw}</strong>
                    <small>
                      {fn.af} / {fn.peripheral} / {fn.signal}
                    </small>
                  </div>
                  <button
                    type="button"
                    className={isAssigned ? "secondary-action is-active" : "primary-action"}
                    onClick={() =>
                      vscode.postMessage(
                        createFunctionAssignmentMessage(assignment, isAssigned)
                      )
                    }
                  >
                    {isAssigned ? "Assigned" : "Assign"}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
