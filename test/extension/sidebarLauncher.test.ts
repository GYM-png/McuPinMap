import { describe, expect, it } from "vitest";
import { renderPinMapLauncherHtml } from "../../src/extension/sidebarLauncher";

describe("renderPinMapLauncherHtml", () => {
  it("renders the no-workspace state without webview app assets", () => {
    const html = renderPinMapLauncherHtml("abc123", { kind: "no-workspace" });

    expect(html).toContain("McuPinMap");
    expect(html).toContain("ACTIONS");
    expect(html).toContain("PIN MAPS");
    expect(html).toContain("Open a workspace folder");
    expect(html).toContain("nonce=\"abc123\"");
    expect(html).not.toContain("dist/webview/assets/main.js");
    expect(html).not.toContain("<div id=\"root\"></div>");
  });

  it("renders create default map in the actions section for empty workspaces", () => {
    const html = renderPinMapLauncherHtml("abc123", { kind: "empty" });

    expect(html).toContain("ACTIONS");
    expect(html).toContain("PIN MAPS");
    expect(html).toContain("launcher-section-actions");
    expect(html).toContain("launcher-section-pin-maps");
    expect(html).toContain('<span class="launcher-row-icon">+</span>');
    expect(html).toContain("Create Default Map");
    expect(html).toContain("data-action=\"createDefaultMap\"");
    expect(html).toContain("No local pin maps yet.");
    expect(html).not.toContain("New Map");
    expect(html).not.toContain("data-action=\"newProjectMap\"");
  });

  it("renders project maps in the lower section without lower-section management actions", () => {
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
        },
        {
          id: "motor-control",
          name: "Motor Control",
          assignmentCount: 0,
          updatedAt: "2026-06-18T11:22:33.000Z"
        }
      ]
    });

    expect(html).toContain("ACTIONS");
    expect(html).toContain("PIN MAPS");
    expect(html).toContain("Create Default Map");
    expect(html).toContain("data-action=\"createDefaultMap\"");
    expect(html).toContain("Main Board");
    expect(html).toContain("Motor Control");
    expect(html).toContain("gd32f407");
    expect(html).toContain("No chip selected");
    expect(html).toContain("2026-06-18T10:20:30.000Z");
    expect(html).toContain("openProjectMap");
    expect(html).toContain("data-map-id=\"main-map\"");
    expect(html).toContain("map-row active");
    expect(html).not.toContain("New Map");
    expect(html).not.toContain("data-action=\"newProjectMap\"");
  });

  it("escapes dynamic map content and error messages", () => {
    const mapHtml = renderPinMapLauncherHtml("abc123", {
      kind: "ready",
      activeMapId: "bad-map",
      maps: [
        {
          id: "bad-map\" onclick=\"alert(1)",
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
    expect(mapHtml).toContain("bad-map&quot; onclick=&quot;alert(1)");
    expect(mapHtml).not.toContain("<script>");
    expect(mapHtml).not.toContain("onclick=\"alert(1)\"");
    expect(errorHtml).toContain("ACTIONS");
    expect(errorHtml).toContain("PIN MAPS");
    expect(errorHtml).toContain("Failed &lt;bad&gt;");
    expect(errorHtml).not.toContain("Failed <bad>");
  });
});
