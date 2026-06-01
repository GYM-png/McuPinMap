import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(
  join(process.cwd(), "src", "webview", "styles.css"),
  "utf8"
);

describe("webview styles", () => {
  it("uses the assigned green as the assigned pin background", () => {
    expect(styles).toMatch(/--assigned:\s*#455847;/);
    expect(styles).toMatch(
      /\.pin-button\.is-assigned\s*{[^}]*background:\s*var\(--assigned\);/s
    );
  });
});
