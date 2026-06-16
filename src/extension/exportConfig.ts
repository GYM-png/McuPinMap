import type { Assignment } from "../shared/types";

export function renderAssignmentsAsJson(assignments: Assignment[]): string {
  return JSON.stringify({ assignments }, null, 2);
}

const escapeMarkdownTableCell = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");

export function renderAssignmentsAsMarkdown(assignments: Assignment[]): string {
  const rows = assignments
    .map((assignment) => {
      const cells = [
        assignment.pinName,
        assignment.af,
        assignment.functionRaw,
        assignment.peripheral,
        assignment.signal
      ].map(escapeMarkdownTableCell);

      return `| ${cells.join(" | ")} |`;
    })
    .join("\n");

  return [
    "# McuPinMap Assignments",
    "",
    "| Pin | AF | Function | Peripheral | Signal |",
    "|---|---|---|---|---|",
    rows
  ].join("\n");
}
