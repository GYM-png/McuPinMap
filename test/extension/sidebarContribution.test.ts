import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

describe("VS Code sidebar contribution", () => {
  test("contributes an activity bar container for McuPinFunc", () => {
    expect(packageJson.activationEvents).toContain("onView:mcupinfunc.pinMapView");
    expect(packageJson.contributes.viewsContainers.activitybar).toContainEqual({
      id: "mcupinfunc",
      title: "McuPinFunc",
      icon: "resources/icon.svg"
    });
  });

  test("contributes a Pin Map view in the McuPinFunc container", () => {
    expect(packageJson.contributes.views.mcupinfunc).toContainEqual({
      id: "mcupinfunc.pinMapView",
      name: "Pin Map"
    });
  });
});
