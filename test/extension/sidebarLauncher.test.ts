import { describe, expect, it } from "vitest";
import { renderPinMapLauncherHtml } from "../../src/extension/sidebarLauncher";

describe("renderPinMapLauncherHtml", () => {
  it("renders a lightweight launcher with an Open Pin Map action", () => {
    const html = renderPinMapLauncherHtml("abc123");

    expect(html).toContain("McuPinMap");
    expect(html).toContain("Open Pin Map");
    expect(html).toContain("openPinMap");
    expect(html).toContain("nonce=\"abc123\"");
    expect(html).not.toContain("dist/webview/assets/main.js");
    expect(html).not.toContain("<div id=\"root\"></div>");
  });
});
