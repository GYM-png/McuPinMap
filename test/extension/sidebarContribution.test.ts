import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
const webviewPanelSource = readFileSync(
  join(process.cwd(), "src", "extension", "webviewPanel.ts"),
  "utf8"
);
const appSource = readFileSync(join(process.cwd(), "src", "webview", "App.tsx"), "utf8");

describe("VS Code sidebar contribution", () => {
  test("contributes an activity bar container for McuPinMap", () => {
    expect(packageJson.activationEvents).toContain("onStartupFinished");
    expect(packageJson.activationEvents).toContain("onView:mcupinmap.pinMapView");
    expect(packageJson.contributes.viewsContainers.activitybar).toContainEqual({
      id: "mcupinmap",
      title: "McuPinMap",
      icon: "resources/icon.svg"
    });
  });

  test("contributes a Pin Map view in the McuPinMap container", () => {
    expect(packageJson.contributes.views.mcupinmap).toContainEqual({
      id: "mcupinmap.pinMapView",
      name: "Pin Map",
      type: "webview"
    });
  });

  test("keeps the contributed view id aligned with activation and provider registration", () => {
    expect(webviewPanelSource).toContain('viewType = "mcupinmap.pinMapView"');
    expect(packageJson.activationEvents).toContain("onView:mcupinmap.pinMapView");
    expect(packageJson.contributes.views.mcupinmap).toContainEqual({
      id: "mcupinmap.pinMapView",
      name: "Pin Map",
      type: "webview"
    });
  });

  test("routes project map rename requests through extension-host input boxes", () => {
    expect(appSource).toContain('type: "requestRenameProjectMap"');
    expect(appSource).not.toContain('window.prompt("Rename project map"');
    expect(webviewPanelSource).toContain('type: "requestRenameProjectMap"');
    expect(webviewPanelSource).toContain("showInputBox");
    expect(webviewPanelSource).toContain("renameMap");
  });
});
