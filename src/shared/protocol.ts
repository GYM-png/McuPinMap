import type { Assignment, Chip, ChipSummary, Conflict } from "./types";
import type { RemoteChipSummary } from "./data/remoteChipIndex";
import type { ProjectPinMapDocument, ProjectPinMapSummary } from "./projectPinMapConfig";

export type ExtensionToWebviewMessage =
  | { type: "chipsLoaded"; chips: ChipSummary[]; selectedChipId?: string }
  | { type: "remoteChipSearchResults"; query: string; chips: RemoteChipSummary[] }
  | { type: "chipDownloadStarted"; chipId: string }
  | { type: "chipDownloadCompleted"; chip: ChipSummary }
  | { type: "chipImportCancelled" }
  | { type: "chipImportCompleted"; chip: ChipSummary }
  | { type: "projectMapsLoaded"; maps: ProjectPinMapSummary[]; activeMapId?: string }
  | {
      type: "projectMapLoaded";
      map: ProjectPinMapSummary;
      mapView?: "logical" | "package";
      selectedPackageName?: string;
    }
  | { type: "projectMapSaveStarted" }
  | { type: "projectMapSaved"; map: ProjectPinMapSummary }
  | { type: "projectMapSaveFailed"; message: string }
  | { type: "installedChipsLoaded"; chips: ChipSummary[]; selectedChipId?: string }
  | { type: "chipLoaded"; chip: Chip; assignments: Assignment[]; conflicts: Conflict[] }
  | { type: "assignmentsUpdated"; assignments: Assignment[]; conflicts: Conflict[] }
  | { type: "error"; message: string };

export type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "selectChip"; chipId: string }
  | { type: "searchRemoteChips"; query: string }
  | { type: "downloadRemoteChip"; chipId: string }
  | { type: "importLocalCsv" }
  | { type: "refreshInstalledChips" }
  | { type: "removeInstalledChip"; chipId: string }
  | { type: "selectProjectMap"; mapId: string }
  | { type: "createProjectMap"; name: string }
  | { type: "duplicateProjectMap"; sourceMapId?: string; name: string }
  | { type: "requestRenameProjectMap"; mapId: string; mapName?: string }
  | { type: "renameProjectMap"; mapId: string; name: string }
  | { type: "saveProjectMap"; map: ProjectPinMapDocument }
  | { type: "assignFunction"; assignment: Assignment }
  | { type: "removeAssignment"; assignmentId: string }
  | { type: "export"; format: "json" | "markdown" };
