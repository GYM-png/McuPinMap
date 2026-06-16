import * as vscode from "vscode";
import { upsertAssignment, removeAssignment } from "../shared/config/assignmentStore";
import { detectConflicts } from "../shared/config/conflictEngine";
import type { Assignment } from "../shared/types";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage
} from "../shared/protocol";
import type { ChipRepository } from "./chipRepository";
import { importLocalCsvWithDialog } from "./csvImport";
import { renderAssignmentsAsJson, renderAssignmentsAsMarkdown } from "./exportConfig";
import { RemoteChipRegistry } from "./remoteChipRegistry";
import { getNonce, renderPinMapLauncherHtml } from "./sidebarLauncher";

const ASSIGNMENTS_KEY = "mcupinmap.assignments";

let currentPinMapPanel: vscode.WebviewPanel | undefined;

export const openPinMapPanel = (
  context: vscode.ExtensionContext,
  chipRepository: ChipRepository
): void => {
  if (currentPinMapPanel) {
    currentPinMapPanel.reveal(vscode.ViewColumn.One);
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
  });

  initializePinMapWebview(panel.webview, context, chipRepository);
};

export class PinMapViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "mcupinmap.pinMapView";

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly chipRepository: ChipRepository
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = {
      enableScripts: true
    };

    webviewView.webview.html = renderPinMapLauncherHtml(getNonce());
    webviewView.webview.onDidReceiveMessage(
      (message: { type?: string }) => {
        if (message.type === "openPinMap") {
          openPinMapPanel(this.context, this.chipRepository);
        }
      },
      undefined,
      this.context.subscriptions
    );
  }
}

const initializePinMapWebview = (
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  chipRepository: ChipRepository
): void => {
  const remoteChipRegistry = new RemoteChipRegistry(context, chipRepository);
  let installedChips = chipRepository.listChips();
  let selectedChipId: string | undefined = installedChips[0]?.id;
  let assignments = context.workspaceState.get<Assignment[]>(ASSIGNMENTS_KEY, []);

  const postMessage = (message: ExtensionToWebviewMessage): void => {
    void webview.postMessage(message);
  };

  const getSelectedAssignments = (): Assignment[] =>
    selectedChipId
      ? assignments.filter((assignment) => assignment.chipId === selectedChipId)
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

  const postPersistenceError = (error: unknown): void => {
    postMessage({
      type: "error",
      message:
        error instanceof Error
          ? `Failed to save assignments: ${error.message}`
          : "Failed to save assignments."
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

  webview.html = getHtml(webview, context.extensionUri);

  webview.onDidReceiveMessage(
    async (message: WebviewToExtensionMessage) => {
      switch (message.type) {
        case "ready":
          refreshInstalledChips();
          postMessage({ type: "chipsLoaded", chips: installedChips, selectedChipId });
          postInstalledChipsLoaded();
          postChipLoaded();
          break;

        case "selectChip":
          selectedChipId = message.chipId;
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
            selectedChipId = chip.id;
            refreshInstalledChips();
            postInstalledChipsLoaded();
            postMessage({ type: "chipDownloadCompleted", chip });
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
            selectedChipId = chip.id;
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
            await persistAssignments(nextAssignments);
            postAssignmentsUpdated();
          } catch (error) {
            postPersistenceError(error);
          }

          break;
        }

        case "removeAssignment": {
          const nextAssignments = removeAssignment(assignments, message.assignmentId);

          try {
            await persistAssignments(nextAssignments);
            postAssignmentsUpdated();
          } catch (error) {
            postPersistenceError(error);
          }

          break;
        }

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
