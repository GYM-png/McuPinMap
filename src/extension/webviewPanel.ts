import * as vscode from "vscode";
import { upsertAssignment, removeAssignment } from "../shared/config/assignmentStore";
import { detectConflicts } from "../shared/config/conflictEngine";
import type { Assignment } from "../shared/types";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage
} from "../shared/protocol";
import type { ChipRepository } from "./chipRepository";

const ASSIGNMENTS_KEY = "mcupinfunc.assignments";

export const openPinMapPanel = (
  context: vscode.ExtensionContext,
  chipRepository: ChipRepository
): void => {
  const chips = chipRepository.listChips();
  let selectedChipId = chips[0]?.id;
  let assignments = context.workspaceState.get<Assignment[]>(ASSIGNMENTS_KEY, []);

  const panel = vscode.window.createWebviewPanel(
    "mcupinfunc.pinMap",
    "McuPinFunc Pin Map",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "webview")]
    }
  );

  const postMessage = (message: ExtensionToWebviewMessage): void => {
    void panel.webview.postMessage(message);
  };

  const getSelectedAssignments = (): Assignment[] =>
    selectedChipId
      ? assignments.filter((assignment) => assignment.chipId === selectedChipId)
      : [];

  const persistAssignments = async (): Promise<void> => {
    await context.workspaceState.update(ASSIGNMENTS_KEY, assignments);
  };

  const postChipLoaded = (): void => {
    if (!selectedChipId) {
      postMessage({ type: "error", message: "No bundled chips are available." });
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

  panel.webview.html = getHtml(panel.webview, context.extensionUri);

  panel.webview.onDidReceiveMessage(
    async (message: WebviewToExtensionMessage) => {
      switch (message.type) {
        case "ready":
          postMessage({ type: "chipsLoaded", chips, selectedChipId });
          postChipLoaded();
          break;

        case "selectChip":
          selectedChipId = message.chipId;
          assignments = assignments.filter(
            (assignment) => assignment.chipId === selectedChipId
          );
          await persistAssignments();
          postChipLoaded();
          break;

        case "assignFunction":
          assignments = upsertAssignment(assignments, message.assignment);
          await persistAssignments();
          postAssignmentsUpdated();
          break;

        case "removeAssignment":
          assignments = removeAssignment(assignments, message.assignmentId);
          await persistAssignments();
          postAssignmentsUpdated();
          break;

        case "export":
          postMessage({
            type: "error",
            message: "Export is not implemented in this webview shell yet."
          });
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
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>McuPinFunc Pin Map</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
  </body>
</html>`;
};

const getNonce = (): string => {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";

  for (let index = 0; index < 32; index += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
};
