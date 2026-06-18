import * as vscode from "vscode";
import { upsertAssignment, removeAssignment } from "../shared/config/assignmentStore";
import { detectConflicts } from "../shared/config/conflictEngine";
import {
  createNextProjectPinMapId,
  createProjectPinMapDocument,
  summarizeProjectPinMap,
  type ProjectPinMapDocument
} from "../shared/projectPinMapConfig";
import type { Assignment } from "../shared/types";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage
} from "../shared/protocol";
import type { ChipRepository } from "./chipRepository";
import { importLocalCsvWithDialog } from "./csvImport";
import { renderAssignmentsAsJson, renderAssignmentsAsMarkdown } from "./exportConfig";
import type { ProjectPinMapStore, ProjectPinMapStoreResult } from "./projectPinMapStore";
import { RemoteChipRegistry } from "./remoteChipRegistry";
import { getNonce, renderPinMapLauncherHtml, type PinMapLauncherState } from "./sidebarLauncher";

const ASSIGNMENTS_KEY = "mcupinmap.assignments";

let currentPinMapPanel: vscode.WebviewPanel | undefined;
let currentPinMapController: PinMapWebviewController | undefined;

export type OpenPinMapPanelOptions = {
  mapId?: string;
};

type PinMapWebviewController = {
  selectProjectMap: (mapId: string) => void;
};

export const toLauncherState = (result: ProjectPinMapStoreResult): PinMapLauncherState => {
  switch (result.kind) {
    case "ready":
      return {
        kind: "ready",
        maps: result.index.maps,
        activeMapId: result.index.activeMapId
      };

    case "empty":
      return { kind: "empty" };

    case "no-workspace":
      return { kind: "no-workspace" };

    case "error":
      return { kind: "error", message: result.message };
  }
};

type SidebarLauncherMessage =
  | { type: "openProjectMap"; mapId: string }
  | { type: "createDefaultMap" }
  | { type: "newProjectMap" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const parseSidebarLauncherMessage = (message: unknown): SidebarLauncherMessage | undefined => {
  if (!isRecord(message) || typeof message.type !== "string") {
    return undefined;
  }

  if (message.type === "openProjectMap") {
    return typeof message.mapId === "string" && message.mapId.length > 0
      ? { type: "openProjectMap", mapId: message.mapId }
      : undefined;
  }

  if (message.type === "createDefaultMap" || message.type === "newProjectMap") {
    return { type: message.type };
  }

  return undefined;
};

export const openPinMapPanel = (
  context: vscode.ExtensionContext,
  chipRepository: ChipRepository,
  projectPinMapStore: ProjectPinMapStore,
  options: OpenPinMapPanelOptions = {}
): void => {
  if (currentPinMapPanel) {
    currentPinMapPanel.reveal(vscode.ViewColumn.One);
    if (options.mapId) {
      currentPinMapController?.selectProjectMap(options.mapId);
    }
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "mcupinmap.pinMap",
    "McuPinMap Pin Map",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "webview")]
    }
  );
  currentPinMapPanel = panel;
  panel.onDidDispose(() => {
    currentPinMapPanel = undefined;
    currentPinMapController = undefined;
  });

  currentPinMapController = initializePinMapWebview(
    panel.webview,
    context,
    chipRepository,
    projectPinMapStore,
    options
  );
};

export class PinMapViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mcupinmap.pinMapView";

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly chipRepository: ChipRepository,
    private readonly projectPinMapStore: ProjectPinMapStore
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true
    };

    const renderLauncher = (state: PinMapLauncherState): void => {
      webviewView.webview.html = renderPinMapLauncherHtml(getNonce(), state);
    };

    void (async () => {
      renderLauncher(toLauncherState(await this.projectPinMapStore.listMaps()));
    })();

    webviewView.webview.onDidReceiveMessage(
      (message: unknown) => {
        const launcherMessage = parseSidebarLauncherMessage(message);
        if (!launcherMessage) {
          return;
        }

        void (async () => {
          switch (launcherMessage.type) {
            case "openProjectMap": {
              const result = await this.projectPinMapStore.selectMap(launcherMessage.mapId);
              renderLauncher(toLauncherState(result));
              if (result.kind === "ready" && result.activeMap) {
                openPinMapPanel(this.context, this.chipRepository, this.projectPinMapStore, {
                  mapId: result.activeMap.id
                });
              }
              break;
            }

            case "createDefaultMap": {
              const result = await this.projectPinMapStore.createDefaultMap();
              if (result.kind === "ready" && result.activeMap) {
                openPinMapPanel(this.context, this.chipRepository, this.projectPinMapStore, {
                  mapId: result.activeMap.id
                });
              }
              renderLauncher(toLauncherState(result));
              break;
            }

            case "newProjectMap": {
              const result = await this.projectPinMapStore.duplicateMap(undefined, "New Map");
              if (result.kind === "ready" && result.activeMap) {
                openPinMapPanel(this.context, this.chipRepository, this.projectPinMapStore, {
                  mapId: result.activeMap.id
                });
              }
              renderLauncher(toLauncherState(result));
              break;
            }
          }
        })();
      },
      undefined,
      this.context.subscriptions
    );
  }
}

const initializePinMapWebview = (
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  chipRepository: ChipRepository,
  projectPinMapStore: ProjectPinMapStore,
  options: OpenPinMapPanelOptions
): PinMapWebviewController => {
  const remoteChipRegistry = new RemoteChipRegistry(context, chipRepository);
  let installedChips = chipRepository.listChips();
  let selectedChipId: string | undefined = installedChips[0]?.id;
  let activeProjectMap: ProjectPinMapDocument | undefined;
  let assignments = context.workspaceState.get<Assignment[]>(ASSIGNMENTS_KEY, []);

  const postMessage = (message: ExtensionToWebviewMessage): void => {
    void webview.postMessage(message);
  };

  const getSelectedAssignments = (): Assignment[] =>
    selectedChipId
      ? assignments.filter((assignment) => assignment.chipId === selectedChipId)
      : [];

  const getAssignmentsForChip = (
    sourceAssignments: Assignment[],
    chipId: string | undefined
  ): Assignment[] =>
    chipId
      ? sourceAssignments.filter((assignment) => assignment.chipId === chipId)
      : [];

  const persistAssignments = async (nextAssignments: Assignment[]): Promise<void> => {
    await context.workspaceState.update(ASSIGNMENTS_KEY, nextAssignments);
    assignments = nextAssignments;
  };

  const refreshInstalledChips = (): void => {
    installedChips = chipRepository.listChips();
    if (!selectedChipId || !installedChips.some((chip) => chip.id === selectedChipId)) {
      selectedChipId = installedChips[0]?.id;
    }
  };

  const postInstalledChipsLoaded = (): void => {
    postMessage({ type: "installedChipsLoaded", chips: installedChips, selectedChipId });
  };

  const projectMapStoreErrorMessage = (result: ProjectPinMapStoreResult): string => {
    if (result.kind === "no-workspace") {
      return "Open a workspace folder to use project pin maps.";
    }

    if (result.kind === "error") {
      return result.message;
    }

    return "Unable to use project pin maps.";
  };

  const postProjectMapsLoaded = (result: ProjectPinMapStoreResult): void => {
    if (result.kind === "ready") {
      postMessage({
        type: "projectMapsLoaded",
        maps: result.index.maps,
        activeMapId: result.index.activeMapId
      });
      return;
    }

    if (result.kind === "empty") {
      postMessage({ type: "projectMapsLoaded", maps: result.index?.maps ?? [] });
    }
  };

  const postPersistenceError = (error: unknown): void => {
    postMessage({
      type: "error",
      message:
        error instanceof Error
          ? `Failed to save assignments: ${error.message}`
          : "Failed to save assignments."
    });
  };

  const activateProjectMap = (map: ProjectPinMapDocument): void => {
    activeProjectMap = map;
    selectedChipId = map.chipId;
    assignments = map.assignments;
    postMessage({
      type: "projectMapLoaded",
      map: summarizeProjectPinMap(map),
      mapView: map.mapView,
      selectedPackageName: map.selectedPackageName
    });
  };

  const postChipLoaded = (): void => {
    if (!selectedChipId) {
      return;
    }

    try {
      const chipAssignments = getSelectedAssignments();
      postMessage({
        type: "chipLoaded",
        chip: chipRepository.loadChip(selectedChipId),
        assignments: chipAssignments,
        conflicts: detectConflicts(chipAssignments)
      });
    } catch (error) {
      postMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to load selected chip."
      });
    }
  };

  const postAssignmentsUpdated = (): void => {
    const chipAssignments = getSelectedAssignments();
    postMessage({
      type: "assignmentsUpdated",
      assignments: chipAssignments,
      conflicts: detectConflicts(chipAssignments)
    });
  };

  const saveActiveProjectMap = async (
    patch: Partial<ProjectPinMapDocument> = {}
  ): Promise<boolean> => {
    if (!activeProjectMap) {
      return true;
    }

    postMessage({ type: "projectMapSaveStarted" });

    const patchHasChipId = Object.prototype.hasOwnProperty.call(patch, "chipId");
    const nextChipId = patchHasChipId ? patch.chipId : selectedChipId;
    const nextMap: ProjectPinMapDocument = {
      ...activeProjectMap,
      ...patch,
      ...(nextChipId === undefined ? {} : { chipId: nextChipId }),
      assignments: patch.assignments ?? getSelectedAssignments()
    };
    if (nextChipId === undefined) {
      delete nextMap.chipId;
    }

    const result = await projectPinMapStore.saveMap(nextMap);

    if (result.kind === "ready" && result.activeMap) {
      activateProjectMap(result.activeMap);
      postMessage({ type: "projectMapSaved", map: summarizeProjectPinMap(result.activeMap) });
      postProjectMapsLoaded(result);
      return true;
    }

    postMessage({ type: "projectMapSaveFailed", message: projectMapStoreErrorMessage(result) });
    return false;
  };

  const saveProjectMapDocument = async (map: ProjectPinMapDocument): Promise<boolean> => {
    postMessage({ type: "projectMapSaveStarted" });

    const result = await projectPinMapStore.saveMap(map);
    if (result.kind === "ready" && result.activeMap) {
      activateProjectMap(result.activeMap);
      postMessage({ type: "projectMapSaved", map: summarizeProjectPinMap(result.activeMap) });
      postProjectMapsLoaded(result);
      return true;
    }

    postMessage({ type: "projectMapSaveFailed", message: projectMapStoreErrorMessage(result) });
    return false;
  };

  const exportAssignments = async (format: "json" | "markdown"): Promise<void> => {
    const document = await vscode.workspace.openTextDocument({
      content:
        format === "json"
          ? renderAssignmentsAsJson(getSelectedAssignments())
          : renderAssignmentsAsMarkdown(getSelectedAssignments()),
      language: format === "json" ? "json" : "markdown"
    });

    await vscode.window.showTextDocument(document, { preview: false });
  };

  const loadProjectMap = async (
    mapId?: string,
    options: { postError?: boolean } = {}
  ): Promise<ProjectPinMapStoreResult> => {
    const result = await projectPinMapStore.loadMap(mapId);
    postProjectMapsLoaded(result);

    if (result.kind === "ready" && result.activeMap) {
      activateProjectMap(result.activeMap);
      return result;
    }

    if (
      options.postError !== false &&
      (result.kind === "no-workspace" || result.kind === "error")
    ) {
      postMessage({ type: "error", message: projectMapStoreErrorMessage(result) });
    }

    return result;
  };

  const selectProjectMap = (mapId: string): void => {
    void (async () => {
      const result = await loadProjectMap(mapId);
      if (result.kind === "ready" && result.activeMap) {
        postChipLoaded();
      }
    })();
  };

  const createProjectMap = async (name: string): Promise<ProjectPinMapStoreResult> => {
    const listedMaps = await projectPinMapStore.listMaps();
    if (listedMaps.kind === "no-workspace" || listedMaps.kind === "error") {
      return listedMaps;
    }

    const existingIds = new Set(
      listedMaps.kind === "ready" ? listedMaps.index.maps.map((map) => map.id) : []
    );
    const now = new Date().toISOString();
    const map = createProjectPinMapDocument(
      createNextProjectPinMapId(name, existingIds),
      name,
      now
    );

    return projectPinMapStore.saveMap(map);
  };

  webview.html = getHtml(webview, context.extensionUri);

  webview.onDidReceiveMessage(
    async (message: WebviewToExtensionMessage) => {
      switch (message.type) {
        case "ready":
          refreshInstalledChips();
          const projectMapLoadResult = await loadProjectMap(options.mapId, { postError: false });
          postMessage({ type: "chipsLoaded", chips: installedChips, selectedChipId });
          postInstalledChipsLoaded();
          postChipLoaded();
          if (
            projectMapLoadResult.kind === "no-workspace" ||
            projectMapLoadResult.kind === "error"
          ) {
            postMessage({
              type: "error",
              message: projectMapStoreErrorMessage(projectMapLoadResult)
            });
          }
          break;

        case "selectChip":
          if (activeProjectMap) {
            const saved = await saveActiveProjectMap({
              chipId: message.chipId,
              assignments: getAssignmentsForChip(assignments, message.chipId)
            });
            if (!saved) {
              break;
            }
          } else {
            selectedChipId = message.chipId;
          }
          postChipLoaded();
          break;

        case "refreshInstalledChips":
          refreshInstalledChips();
          postInstalledChipsLoaded();
          postChipLoaded();
          break;

        case "removeInstalledChip": {
          const chip = installedChips.find((entry) => entry.id === message.chipId);
          const selection = await vscode.window.showWarningMessage(
            `Remove ${chip?.displayName ?? message.chipId} from the local chip library?`,
            { modal: true },
            "Remove"
          );

          if (selection !== "Remove") {
            break;
          }

          chipRepository.removeChip(message.chipId);
          if (selectedChipId === message.chipId) {
            selectedChipId = undefined;
          }
          refreshInstalledChips();
          postInstalledChipsLoaded();
          postChipLoaded();
          break;
        }

        case "searchRemoteChips":
          try {
            postMessage({
              type: "remoteChipSearchResults",
              query: message.query,
              chips: await remoteChipRegistry.searchRemoteChips(message.query)
            });
          } catch (error) {
            postMessage({
              type: "error",
              message:
                error instanceof Error ? error.message : "Unable to search remote chip index."
            });
          }

          break;

        case "downloadRemoteChip":
          postMessage({ type: "chipDownloadStarted", chipId: message.chipId });

          try {
            const chip = await remoteChipRegistry.downloadRemoteChip(message.chipId);
            refreshInstalledChips();
            postInstalledChipsLoaded();
            postMessage({ type: "chipDownloadCompleted", chip });
            if (activeProjectMap) {
              const saved = await saveActiveProjectMap({
                chipId: chip.id,
                assignments: getAssignmentsForChip(assignments, chip.id)
              });
              if (!saved) {
                break;
              }
            } else {
              selectedChipId = chip.id;
            }
            postChipLoaded();
          } catch (error) {
            postMessage({
              type: "error",
              message:
                error instanceof Error ? error.message : "Unable to download selected chip."
            });
          }

          break;

        case "importLocalCsv":
          try {
            const chip = await importLocalCsvWithDialog();
            if (!chip) {
              postMessage({ type: "chipImportCancelled" });
              break;
            }

            const existingChip = installedChips.find(
              (installedChip) => installedChip.id.toLowerCase() === chip.id.toLowerCase()
            );
            if (existingChip) {
              const selection = await vscode.window.showWarningMessage(
                `Chip ${chip.displayName} will replace the installed chip ${existingChip.displayName}.`,
                { modal: true },
                "Replace"
              );

              if (selection !== "Replace") {
                postMessage({ type: "chipImportCancelled" });
                break;
              }
            }

            chipRepository.saveImportedChip(chip);
            refreshInstalledChips();
            postInstalledChipsLoaded();
            postMessage({
              type: "chipImportCompleted",
              chip: {
                id: chip.id,
                displayName: chip.displayName,
                vendor: chip.vendor,
                family: chip.family
              }
            });
            if (activeProjectMap) {
              const saved = await saveActiveProjectMap({
                chipId: chip.id,
                assignments: getAssignmentsForChip(assignments, chip.id)
              });
              if (!saved) {
                break;
              }
            } else {
              selectedChipId = chip.id;
            }
            postChipLoaded();
          } catch (error) {
            postMessage({
              type: "error",
              message: error instanceof Error ? error.message : "Unable to import local CSV files."
            });
          }

          break;

        case "assignFunction": {
          const nextAssignments = upsertAssignment(assignments, message.assignment);

          try {
            if (activeProjectMap) {
              const saved = await saveActiveProjectMap({
                assignments: getAssignmentsForChip(nextAssignments, selectedChipId)
              });
              if (!saved) {
                break;
              }
            } else {
              await persistAssignments(nextAssignments);
            }
            postAssignmentsUpdated();
          } catch (error) {
            postPersistenceError(error);
          }

          break;
        }

        case "removeAssignment": {
          const nextAssignments = removeAssignment(assignments, message.assignmentId);

          try {
            if (activeProjectMap) {
              const saved = await saveActiveProjectMap({
                assignments: getAssignmentsForChip(nextAssignments, selectedChipId)
              });
              if (!saved) {
                break;
              }
            } else {
              await persistAssignments(nextAssignments);
            }
            postAssignmentsUpdated();
          } catch (error) {
            postPersistenceError(error);
          }

          break;
        }

        case "selectProjectMap": {
          const result = await loadProjectMap(message.mapId);
          if (result.kind === "ready" && result.activeMap) {
            postChipLoaded();
          }
          break;
        }

        case "createProjectMap": {
          const result = await createProjectMap(message.name);
          postProjectMapsLoaded(result);

          if (result.kind === "ready" && result.activeMap) {
            activateProjectMap(result.activeMap);
            postChipLoaded();
          } else {
            postMessage({
              type: "projectMapSaveFailed",
              message: projectMapStoreErrorMessage(result)
            });
          }

          break;
        }

        case "duplicateProjectMap": {
          const sourceMapId = message.sourceMapId ?? activeProjectMap?.id;
          if (!sourceMapId) {
            postMessage({
              type: "projectMapSaveFailed",
              message: "Select a project pin map before duplicating it."
            });
            break;
          }

          const result = await projectPinMapStore.duplicateMap(sourceMapId, message.name);
          postProjectMapsLoaded(result);

          if (result.kind === "ready" && result.activeMap) {
            activateProjectMap(result.activeMap);
            postChipLoaded();
          } else {
            postMessage({
              type: "projectMapSaveFailed",
              message: projectMapStoreErrorMessage(result)
            });
          }

          break;
        }

        case "renameProjectMap": {
          const result = await projectPinMapStore.renameMap(message.mapId, message.name);
          postProjectMapsLoaded(result);

          if (result.kind === "ready" && result.activeMap) {
            activateProjectMap(result.activeMap);
            postMessage({
              type: "projectMapSaved",
              map: summarizeProjectPinMap(result.activeMap)
            });
            postChipLoaded();
          } else {
            postMessage({
              type: "projectMapSaveFailed",
              message: projectMapStoreErrorMessage(result)
            });
          }

          break;
        }

        case "saveProjectMap":
          if (await saveProjectMapDocument(message.map)) {
            postChipLoaded();
          }
          break;

        case "export":
          try {
            await exportAssignments(message.format);
          } catch (error) {
            postMessage({
              type: "error",
              message:
                error instanceof Error
                  ? `Failed to export assignments: ${error.message}`
                  : "Failed to export assignments."
            });
          }

          break;
      }
    },
    undefined,
    context.subscriptions
  );

  return { selectProjectMap };
};

const getHtml = (webview: vscode.Webview, extensionUri: vscode.Uri): string => {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", "assets", "main.js")
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "webview", "assets", "main.css")
  );
  const nonce = getWebviewNonce();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>McuPinMap Pin Map</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
};

const getWebviewNonce = (): string => {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";

  for (let index = 0; index < 32; index += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
};
