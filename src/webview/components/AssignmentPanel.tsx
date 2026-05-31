import { usePinMapStore } from "../state/usePinMapStore";
import { vscode } from "../vscodeApi";

export const AssignmentPanel = (): JSX.Element => {
  const assignments = usePinMapStore((state) => state.assignments);
  const conflicts = usePinMapStore((state) => state.conflicts);

  return (
    <section className="panel assignment-panel" aria-labelledby="assignment-title">
      <div className="panel-heading">
        <p className="eyebrow">Workspace</p>
        <h2 id="assignment-title">Assignments</h2>
      </div>

      <div className="assignment-list">
        {assignments.length === 0 ? (
          <p className="empty-state">No functions assigned yet.</p>
        ) : null}
        {assignments.map((assignment) => (
          <article key={assignment.id} className="assignment-card">
            <div>
              <strong>
                {assignment.pinName} / {assignment.functionRaw}
              </strong>
              <small>
                {assignment.peripheral} {assignment.signal}
              </small>
            </div>
            <button
              type="button"
              className="ghost-action"
              onClick={() =>
                vscode.postMessage({
                  type: "removeAssignment",
                  assignmentId: assignment.id
                })
              }
            >
              Remove
            </button>
          </article>
        ))}
      </div>

      {conflicts.length > 0 ? (
        <div className="conflict-list" aria-label="Assignment conflicts">
          <h3>Conflicts</h3>
          {conflicts.map((conflict) => (
            <p key={conflict.id} className="conflict-card">
              {conflict.message}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
};
