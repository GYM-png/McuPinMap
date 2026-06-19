import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Shell", () => {
  it("keeps resizable content panels without the removed workspace header or reset action", () => {
    const source = readFileSync(
      join(process.cwd(), "src/webview/components/Shell.tsx"),
      "utf8"
    );

    expect(source).not.toContain("Pin Map Workspace");
    expect(source).not.toContain("workspace-reset-button");
    expect(source).not.toContain("Reset layout");

    expect(source).toContain("workspace-grid");
    expect(source).toContain("workspace-resizer");
    expect(source).toContain("{sidebar}");
    expect(source).toContain("{children}");
    expect(source).toContain("{detail}");
  });
});
