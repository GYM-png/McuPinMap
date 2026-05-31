import type { Assignment, Chip, ChipSummary, Conflict } from "./types";

export type ExtensionToWebviewMessage =
  | { type: "chipsLoaded"; chips: ChipSummary[]; selectedChipId?: string }
  | { type: "chipLoaded"; chip: Chip; assignments: Assignment[]; conflicts: Conflict[] }
  | { type: "assignmentsUpdated"; assignments: Assignment[]; conflicts: Conflict[] }
  | { type: "error"; message: string };

export type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "selectChip"; chipId: string }
  | { type: "assignFunction"; assignment: Assignment }
  | { type: "removeAssignment"; assignmentId: string }
  | { type: "export"; format: "json" | "markdown" };
