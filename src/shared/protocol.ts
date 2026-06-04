import type { Assignment, Chip, ChipSummary, Conflict } from "./types";
import type { RemoteChipSummary } from "./data/remoteChipIndex";

export type ExtensionToWebviewMessage =
  | { type: "chipsLoaded"; chips: ChipSummary[]; selectedChipId?: string }
  | { type: "remoteChipSearchResults"; chips: RemoteChipSummary[] }
  | { type: "chipDownloadStarted"; chipId: string }
  | { type: "chipDownloadCompleted"; chip: ChipSummary }
  | { type: "installedChipsLoaded"; chips: ChipSummary[]; selectedChipId?: string }
  | { type: "chipLoaded"; chip: Chip; assignments: Assignment[]; conflicts: Conflict[] }
  | { type: "assignmentsUpdated"; assignments: Assignment[]; conflicts: Conflict[] }
  | { type: "error"; message: string };

export type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "selectChip"; chipId: string }
  | { type: "searchRemoteChips"; query: string }
  | { type: "downloadRemoteChip"; chipId: string }
  | { type: "refreshInstalledChips" }
  | { type: "assignFunction"; assignment: Assignment }
  | { type: "removeAssignment"; assignmentId: string }
  | { type: "export"; format: "json" | "markdown" };
