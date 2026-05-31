import type { WebviewToExtensionMessage } from "../shared/protocol";

type VsCodeApi = {
  postMessage(message: WebviewToExtensionMessage): void;
};

declare const acquireVsCodeApi: () => VsCodeApi;

export const vscode = acquireVsCodeApi();
