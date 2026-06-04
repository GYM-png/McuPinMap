import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ChipSelector actions", () => {
  it("exposes a local CSV import action", () => {
    const source = readFileSync(
      join(process.cwd(), "src/webview/components/ChipSelector.tsx"),
      "utf8"
    );

    expect(source).toContain('vscode.postMessage({ type: "importLocalCsv" })');
  });
});
