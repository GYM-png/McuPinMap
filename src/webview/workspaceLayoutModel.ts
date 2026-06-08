export type WorkspaceLayout = {
  sidebarWidth: number;
  detailWidth: number;
};

export type WorkspaceDivider = "sidebar" | "detail";

export type WorkspaceLayoutDragInput = {
  divider: WorkspaceDivider;
  startClientX: number;
  currentClientX: number;
  startLayout: WorkspaceLayout;
  viewportWidth: number;
};

export type PersistedWorkspaceState = Record<string, unknown> & {
  workspaceLayout?: unknown;
};

const sidebarMinWidth = 220;
const sidebarMaxWidth = 420;
const detailMinWidth = 280;
const detailMaxWidth = 420;
const centerMinWidth = 360;
const workspaceGapWidth = 18;
const workspaceColumnGapCount = 2;

export const defaultWorkspaceLayout: WorkspaceLayout = {
  sidebarWidth: 280,
  detailWidth: 360
};

const roundLayout = (layout: WorkspaceLayout): WorkspaceLayout => ({
  sidebarWidth: Math.round(layout.sidebarWidth),
  detailWidth: Math.round(layout.detailWidth)
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clampWorkspaceLayout = (
  layout: WorkspaceLayout,
  viewportWidth: number
): WorkspaceLayout => {
  const availableSideWidth =
    viewportWidth - centerMinWidth - workspaceGapWidth * workspaceColumnGapCount;
  const detailWidth = clamp(
    layout.detailWidth,
    detailMinWidth,
    Math.min(detailMaxWidth, availableSideWidth - sidebarMinWidth)
  );
  const sidebarWidth = clamp(
    layout.sidebarWidth,
    sidebarMinWidth,
    Math.min(sidebarMaxWidth, availableSideWidth - detailWidth)
  );

  return roundLayout({
    sidebarWidth,
    detailWidth
  });
};

export const getDraggedWorkspaceLayout = ({
  divider,
  startClientX,
  currentClientX,
  startLayout,
  viewportWidth
}: WorkspaceLayoutDragInput): WorkspaceLayout => {
  const deltaX = currentClientX - startClientX;

  return clampWorkspaceLayout(
    divider === "sidebar"
      ? {
          ...startLayout,
          sidebarWidth: startLayout.sidebarWidth + deltaX
        }
      : {
          ...startLayout,
          detailWidth: startLayout.detailWidth - deltaX
        },
    viewportWidth
  );
};

export const resetWorkspaceLayout = (): WorkspaceLayout => defaultWorkspaceLayout;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export const getWorkspaceLayoutFromState = (
  state: unknown,
  viewportWidth: number
): WorkspaceLayout => {
  const layout =
    state && typeof state === "object"
      ? (state as PersistedWorkspaceState).workspaceLayout
      : undefined;

  if (!layout || typeof layout !== "object") {
    return defaultWorkspaceLayout;
  }

  const { sidebarWidth, detailWidth } = layout as Partial<WorkspaceLayout>;

  if (!isFiniteNumber(sidebarWidth) || !isFiniteNumber(detailWidth)) {
    return defaultWorkspaceLayout;
  }

  return clampWorkspaceLayout({ sidebarWidth, detailWidth }, viewportWidth);
};

export const setWorkspaceLayoutInState = (
  state: unknown,
  layout: WorkspaceLayout
): PersistedWorkspaceState => ({
  ...(state && typeof state === "object" ? (state as Record<string, unknown>) : {}),
  workspaceLayout: roundLayout(layout)
});
