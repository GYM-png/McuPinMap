import { describe, expect, it } from "vitest";
import {
  clampWorkspaceLayout,
  defaultWorkspaceLayout,
  getDraggedWorkspaceLayout,
  getWorkspaceLayoutFromState,
  setWorkspaceLayoutInState,
  resetWorkspaceLayout
} from "../../src/webview/workspaceLayoutModel";

describe("workspace layout model", () => {
  it("provides the current fixed sidebar and detail widths as defaults", () => {
    expect(defaultWorkspaceLayout).toEqual({
      sidebarWidth: 280,
      detailWidth: 360
    });
  });

  it("resizes the sidebar from the left divider while preserving the detail width", () => {
    expect(
      getDraggedWorkspaceLayout({
        divider: "sidebar",
        startClientX: 300,
        currentClientX: 360,
        startLayout: defaultWorkspaceLayout,
        viewportWidth: 1200
      })
    ).toEqual({
      sidebarWidth: 340,
      detailWidth: 360
    });
  });

  it("resizes the detail column from the right divider in the opposite drag direction", () => {
    expect(
      getDraggedWorkspaceLayout({
        divider: "detail",
        startClientX: 900,
        currentClientX: 850,
        startLayout: defaultWorkspaceLayout,
        viewportWidth: 1200
      })
    ).toEqual({
      sidebarWidth: 280,
      detailWidth: 410
    });
  });

  it("clamps side columns so the center map keeps enough usable width", () => {
    expect(
      clampWorkspaceLayout(
        {
          sidebarWidth: 600,
          detailWidth: 500
        },
        1200
      )
    ).toEqual({
      sidebarWidth: 384,
      detailWidth: 420
    });
  });

  it("resets resized panels to the default layout", () => {
    expect(resetWorkspaceLayout()).toEqual(defaultWorkspaceLayout);
  });

  it("restores a persisted workspace layout from webview state", () => {
    expect(
      getWorkspaceLayoutFromState(
        {
          workspaceLayout: {
            sidebarWidth: 330,
            detailWidth: 390
          }
        },
        1200
      )
    ).toEqual({
      sidebarWidth: 330,
      detailWidth: 390
    });
  });

  it("ignores invalid persisted workspace layout values", () => {
    expect(
      getWorkspaceLayoutFromState(
        {
          workspaceLayout: {
            sidebarWidth: "wide",
            detailWidth: Number.NaN
          }
        },
        1200
      )
    ).toEqual(defaultWorkspaceLayout);
  });

  it("stores workspace layout while preserving unrelated webview state", () => {
    expect(
      setWorkspaceLayoutInState(
        {
          selectedChipId: "gd32f407"
        },
        {
          sidebarWidth: 340,
          detailWidth: 400
        }
      )
    ).toEqual({
      selectedChipId: "gd32f407",
      workspaceLayout: {
        sidebarWidth: 340,
        detailWidth: 400
      }
    });
  });
});
