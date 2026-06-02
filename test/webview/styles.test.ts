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

  it("defines compact LQFP package map state styles", () => {
    expect(styles).toMatch(/\.package-map/);
    expect(styles).toMatch(/\.lqfp-pad/);
    expect(styles).toMatch(/\.lqfp-pad\.is-search-match/);
    expect(styles).toMatch(/\.lqfp-pad\.is-assigned/);
    expect(styles).toMatch(/\.lqfp-pad\.is-conflict/);
    expect(styles).toMatch(/\.lqfp-pad\.is-unmapped/);
  });

  it("constrains LQFP side rails to the package body size", () => {
    expect(styles).toMatch(/--lqfp-body-size:/);
    expect(styles).toMatch(/grid-template-columns:[^;]*var\(--lqfp-side-rail\)[^;]*var\(--lqfp-body-size\)[^;]*var\(--lqfp-side-rail\)/s);
    expect(styles).toMatch(/grid-template-rows:[^;]*var\(--lqfp-side-rail\)[^;]*var\(--lqfp-body-size\)[^;]*var\(--lqfp-side-rail\)/s);
    expect(styles).toMatch(/\.lqfp-side-left\s*{[^}]*height:\s*var\(--lqfp-body-size\);/s);
    expect(styles).toMatch(/\.lqfp-side-top\s*{[^}]*width:\s*var\(--lqfp-body-size\);/s);
  });

  it("shows pin names by default and rotates labels on top and bottom sides", () => {
    expect(styles).toMatch(/\.lqfp-pad \.pad-number\s*{[^}]*display:\s*none;/s);
    expect(styles).toMatch(/\.lqfp-pad \.pad-label\s*{[^}]*font-size:\s*0\.62rem;/s);
    expect(styles).toMatch(/\.lqfp-side-top \.pad-label,\s*\.lqfp-side-bottom \.pad-label\s*{[^}]*writing-mode:\s*vertical-rl;/s);
  });
});
