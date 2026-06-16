import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Chip data panel actions", () => {
  it("exposes local import, remote search, download, refresh, and remove actions", () => {
    const source = readFileSync(
      join(process.cwd(), "src/webview/components/ChipDataPanel.tsx"),
      "utf8"
    );

    expect(source).toContain('vscode.postMessage({ type: "importLocalCsv" })');
    expect(source).toContain('type: "searchRemoteChips"');
    expect(source).toContain('type: "downloadRemoteChip"');
    expect(source).toContain('type: "refreshInstalledChips"');
    expect(source).toContain('type: "removeInstalledChip"');
    expect(source).toContain('className="remote-chip-actions"');
    expect(source).not.toContain('className="installed-chip-list"');
    expect(source).toContain("useState(false)");
    expect(source).toContain("aria-expanded={!isCollapsed}");
    expect(source).toContain('id="chip-data-body"');
  });
});
