import * as vscode from "vscode";
import { ChipRepository } from "./chipRepository";
import { ProjectPinMapStore } from "./projectPinMapStore";
import { openPinMapPanel, PinMapViewProvider } from "./webviewPanel";

export function activate(context: vscode.ExtensionContext): void {
  const chipRepository = new ChipRepository(context);
  const projectPinMapStore = new ProjectPinMapStore(() => vscode.workspace.workspaceFolders);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PinMapViewProvider.viewType,
      new PinMapViewProvider(context, chipRepository, projectPinMapStore)
    ),
    vscode.commands.registerCommand("mcupinmap.openPinMap", () => {
      openPinMapPanel(context, chipRepository, projectPinMapStore);
    })
  );
}

export function deactivate(): void {}
