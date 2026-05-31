import type { Assignment } from "../shared/types";

export function renderAssignmentsAsJson(assignments: Assignment[]): string {
  return JSON.stringify({ assignments }, null, 2);
}

export function renderAssignmentsAsMarkdown(assignments: Assignment[]): string {
  const rows = assignments
    .map(
      (assignment) =>
        `| ${assignment.pinName} | ${assignment.af} | ${assignment.functionRaw} | ${assignment.peripheral} | ${assignment.signal} |`
    )
    .join("\n");

  return [
    "# McuPinFunc Assignments",
    "",
    "| Pin | AF | Function | Peripheral | Signal |",
    "|---|---|---|---|---|",
    rows
  ].join("\n");
}
