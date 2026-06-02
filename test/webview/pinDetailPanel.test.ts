import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src", "webview", "components", "PinDetailPanel.tsx"),
  "utf8"
);

describe("PinDetailPanel search highlight wiring", () => {
  it("uses the active query to mark matching function cards", () => {
    expect(source).toContain("matchesFunctionSearchQuery");
    expect(source).toMatch(/const query = usePinMapStore\(\(state\) => state\.query\);/);
    expect(source).toMatch(/const isSearchMatch = matchesFunctionSearchQuery\(fn, query\);/);
    expect(source).toContain('isSearchMatch ? " is-search-match" : ""');
  });
});
