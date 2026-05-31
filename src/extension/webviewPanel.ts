import * as vscode from "vscode";
import { upsertAssignment, removeAssignment } from "../shared/config/assignmentStore";
import { detectConflicts } from "../shared/config/conflictEngine";
import type { Assignment } from "../shared/types";
import type {
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage
} from "../shared/protocol";
import type { ChipRepository } from "./chipRepository";
import { renderAssignmentsAsJson, renderAssignmentsAsMarkdown } from "./exportConfig";

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

  const persistAssignments = async (nextAssignments: Assignment[]): Promise<void> => {
    await context.workspaceState.update(ASSIGNMENTS_KEY, nextAssignments);
    assignments = nextAssignments;
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
          postChipLoaded();
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
