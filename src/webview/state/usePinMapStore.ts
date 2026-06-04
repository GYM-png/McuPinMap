import { create } from "zustand";
import type { RemoteChipSummary } from "../../shared/data/remoteChipIndex";
import { createSearchIndex, type SearchResult } from "../../shared/data/searchIndex";
import type { Assignment, Chip, ChipSummary, Conflict, Pin } from "../../shared/types";

export type MapView = "logical" | "package";
export type RemoteSearchStatus = "idle" | "loading" | "ready";

type PinMapState = {
  chips: ChipSummary[];
  chip?: Chip;
  selectedChipId?: string;
  remoteQuery: string;
  remoteChips: RemoteChipSummary[];
  remoteSearchStatus: RemoteSearchStatus;
  downloadingChipId?: string;
  importingCsv: boolean;
  selectedPinName?: string;
  mapView: MapView;
  selectedPackageName?: string;
  query: string;
  searchResults: SearchResult[];
  assignments: Assignment[];
  conflicts: Conflict[];
  setChips: (chips: ChipSummary[], selectedChipId?: string) => void;
  setChip: (chip: Chip) => void;
  setRemoteQuery: (query: string) => void;
  setRemoteSearchLoading: () => void;
  setRemoteSearchResults: (query: string, chips: RemoteChipSummary[]) => void;
  finishRemoteSearch: () => void;
  setDownloadingChipId: (chipId?: string) => void;
  setImportingCsv: (importingCsv: boolean) => void;
  finishDownload: () => void;
  finishImport: () => void;
  finishChipDataActions: () => void;
  setAssignments: (assignments: Assignment[], conflicts: Conflict[]) => void;
  setMapView: (mapView: MapView) => void;
  setSelectedPackageName: (packageName: string) => void;
  selectPin: (pinName?: string) => void;
  setQuery: (query: string) => void;
  selectedPin: () => Pin | undefined;
};

const searchChip = (chip: Chip | undefined, query: string): SearchResult[] =>
  chip ? createSearchIndex(chip).search(query) : [];

export const usePinMapStore = create<PinMapState>((set, get) => ({
  chips: [],
  remoteQuery: "",
  remoteChips: [],
  remoteSearchStatus: "idle",
  importingCsv: false,
  mapView: "package",
  query: "",
  searchResults: [],
  assignments: [],
  conflicts: [],
  setChips: (chips, selectedChipId) =>
    set((state) => {
      const nextSelectedChipId = selectedChipId ?? chips[0]?.id;
      const hasSelectedChip = nextSelectedChipId
        ? chips.some((chip) => chip.id === nextSelectedChipId)
        : false;

      return {
        chips,
        selectedChipId: hasSelectedChip ? nextSelectedChipId : undefined,
        chip: hasSelectedChip && state.chip?.id === nextSelectedChipId ? state.chip : undefined,
        selectedPinName:
          hasSelectedChip && state.chip?.id === nextSelectedChipId
            ? state.selectedPinName
            : undefined,
        searchResults:
          hasSelectedChip && state.chip?.id === nextSelectedChipId ? state.searchResults : [],
        assignments:
          hasSelectedChip && state.chip?.id === nextSelectedChipId ? state.assignments : [],
        conflicts: hasSelectedChip && state.chip?.id === nextSelectedChipId ? state.conflicts : []
      };
    }),
  setChip: (chip) =>
    set((state) => {
      const selectedPinName = chip.pins.some((pin) => pin.name === state.selectedPinName)
        ? state.selectedPinName
        : chip.pins[0]?.name;
      const hasPackages = chip.packages.length > 0;
      const selectedPackageName = chip.packages.some(
        (layout) => layout.packageName === state.selectedPackageName
      )
        ? state.selectedPackageName
        : chip.packages[0]?.packageName;

      return {
        chip,
        selectedChipId: chip.id,
        selectedPinName,
        selectedPackageName,
        mapView: hasPackages ? state.mapView : "logical",
        searchResults: searchChip(chip, state.query)
      };
    }),
  setRemoteQuery: (remoteQuery) => set({ remoteQuery }),
  setRemoteSearchLoading: () => set({ remoteSearchStatus: "loading" }),
  setRemoteSearchResults: (query, remoteChips) =>
    set((state) =>
      query === state.remoteQuery
        ? { remoteChips, remoteSearchStatus: "ready" }
        : {}
    ),
  finishRemoteSearch: () =>
    set((state) => ({
      remoteSearchStatus: state.remoteSearchStatus === "loading" ? "idle" : state.remoteSearchStatus
    })),
  setDownloadingChipId: (downloadingChipId) => set({ downloadingChipId }),
  setImportingCsv: (importingCsv) => set({ importingCsv }),
  finishDownload: () => set({ downloadingChipId: undefined }),
  finishImport: () => set({ importingCsv: false }),
  finishChipDataActions: () => set({ downloadingChipId: undefined, importingCsv: false }),
  setAssignments: (assignments, conflicts) => set({ assignments, conflicts }),
  setMapView: (mapView) =>
    set((state) => ({
      mapView: mapView === "package" && (state.chip?.packages.length ?? 0) === 0 ? "logical" : mapView
    })),
  setSelectedPackageName: (selectedPackageName) => set({ selectedPackageName }),
  selectPin: (pinName) => set({ selectedPinName: pinName }),
  setQuery: (query) =>
    set((state) => ({
      query,
      searchResults: searchChip(state.chip, query)
    })),
  selectedPin: () => {
    const { chip, selectedPinName } = get();

    return chip?.pins.find((pin) => pin.name === selectedPinName);
  }
}));
