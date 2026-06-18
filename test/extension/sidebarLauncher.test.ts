import { describe, expect, it } from "vitest";
import { renderPinMapLauncherHtml } from "../../src/extension/sidebarLauncher";

describe("renderPinMapLauncherHtml", () => {
  it("renders the no-workspace state without webview app assets", () => {
    const html = renderPinMapLauncherHtml("abc123", { kind: "no-workspace" });

    expect(html).toContain("McuPinMap");
    expect(html).toContain("Open a workspace folder");
    expect(html).toContain("nonce=\"abc123\"");
    expect(html).not.toContain("dist/webview/assets/main.js");
    expect(html).not.toContain("<div id=\"root\"></div>");
  });

  it("renders an empty-state action to create the default map", () => {
    const html = renderPinMapLauncherHtml("abc123", { kind: "empty" });

    expect(html).toContain("Create Default Map");
    expect(html).toContain("createDefaultMap");
  });

  it("renders project maps with open and new map actions", () => {
    const html = renderPinMapLauncherHtml("abc123", {
      kind: "ready",
      activeMapId: "main-map",
      maps: [
        {
          id: "main-map",
          name: "Main Board",
          chipId: "gd32f407",
          assignmentCount: 3,
          updatedAt: "2026-06-18T10:20:30.000Z"
        }
      ]
    });

    expect(html).toContain("Main Board");
    expect(html).toContain("gd32f407");
    expect(html).toContain("openProjectMap");
    expect(html).toContain("main-map");
    expect(html).toContain("New Map");
  });

  it("escapes dynamic map content and error messages", () => {
    const mapHtml = renderPinMapLauncherHtml("abc123", {
      kind: "ready",
      maps: [
        {
          id: "bad-map",
          name: "<script>",
          chipId: "<bad>",
          assignmentCount: 0,
          updatedAt: "2026-06-18T10:20:30.000Z"
        }
      ]
    });
    const errorHtml = renderPinMapLauncherHtml("abc123", {
      kind: "error",
      message: "Failed <bad>"
    });

    expect(mapHtml).toContain("&lt;script&gt;");
    expect(mapHtml).toContain("&lt;bad&gt;");
    expect(mapHtml).not.toContain("<script>");
    expect(errorHtml).toContain("Failed &lt;bad&gt;");
    expect(errorHtml).not.toContain("Failed <bad>");
  });
});
