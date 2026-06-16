import * as vscode from "vscode";
import { ChipRepository } from "./chipRepository";
import { openPinMapPanel, PinMapViewProvider } from "./webviewPanel";

export function activate(context: vscode.ExtensionContext): void {
  const chipRepository = new ChipRepository(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PinMapViewProvider.viewType,
      new PinMapViewProvider(context, chipRepository)
    ),
    vscode.commands.registerCommand("mcupinfunc.openPinMap", () => {
      openPinMapPanel(context, chipRepository);
    })
  );
}

export function deactivate(): void {}
