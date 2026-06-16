import type { WebviewToExtensionMessage } from "../shared/protocol";

type VsCodeApi = {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
};

declare const acquireVsCodeApi: () => VsCodeApi;

export const vscode = acquireVsCodeApi();
