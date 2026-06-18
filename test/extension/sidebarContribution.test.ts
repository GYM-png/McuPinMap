import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

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
      name: "Pin Map"
    });
  });
});
