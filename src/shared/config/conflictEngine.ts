import type { Assignment, Conflict } from "../types";

type ConflictKind = Conflict["kind"];

const createGroupedConflicts = (
  assignments: Assignment[],
  makeKey: (assignment: Assignment) => string,
  createConflict: (key: string, rows: Assignment[]) => Conflict
): Conflict[] => {
  const groups = new Map<string, Assignment[]>();

  for (const assignment of assignments) {
    const key = makeKey(assignment);
    const rows = groups.get(key);

    if (rows) {
      rows.push(assignment);
    } else {
      groups.set(key, [assignment]);
    }
  }

  return Array.from(groups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => createConflict(key, rows));
};

export const detectConflicts = (assignments: Assignment[]): Conflict[] => [
  ...createGroupedConflicts(
    assignments,
    (assignment) => assignment.pinName,
    (pinName, rows) => ({
      id: `pin-overlap:${pinName}`,
      kind: "pin-overlap" satisfies ConflictKind,
      message: `${pinName} has ${rows.length} assigned functions.`,
      assignmentIds: rows.map((row) => row.id)
    })
  ),
  ...createGroupedConflicts(
    assignments,
    (assignment) => `${assignment.peripheral}:${assignment.signal}`,
    (key, rows) => {
      const [peripheral, signal] = key.split(":");

      return {
        id: `signal-duplicate:${peripheral}:${signal}`,
        kind: "signal-duplicate" satisfies ConflictKind,
        message: `${peripheral}_${signal} is assigned to ${rows.length} pins.`,
        assignmentIds: rows.map((row) => row.id)
      };
    }
  )
];
