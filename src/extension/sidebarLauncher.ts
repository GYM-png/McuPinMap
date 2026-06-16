export const renderPinMapLauncherHtml = (nonce: string): string => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
    <title>McuPinMap</title>
    <style>
      body {
        box-sizing: border-box;
        margin: 0;
        padding: 16px;
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
        font-family: var(--vscode-font-family);
        font-size: var(--vscode-font-size);
      }

      .container {
        display: flex;
        min-height: calc(100vh - 32px);
        flex-direction: column;
        gap: 12px;
      }

      h1 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      p {
        margin: 0;
        color: var(--vscode-descriptionForeground);
        line-height: 1.45;
      }

      button {
        width: 100%;
        border: 0;
        border-radius: 2px;
        padding: 8px 10px;
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        cursor: pointer;
        font: inherit;
      }

      button:hover {
        background: var(--vscode-button-hoverBackground);
      }
    </style>
  </head>
  <body>
    <main class="container">
      <h1>McuPinMap</h1>
      <p>Open the full Pin Map workspace in the editor area.</p>
      <button type="button" id="openPinMap">Open Pin Map</button>
    </main>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      document.getElementById("openPinMap")?.addEventListener("click", () => {
        vscode.postMessage({ type: "openPinMap" });
      });
    </script>
  </body>
</html>`;

export const getNonce = (): string => {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";

  for (let index = 0; index < 32; index += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
};
