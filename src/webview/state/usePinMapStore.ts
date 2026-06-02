import { create } from "zustand";
import { createSearchIndex, type SearchResult } from "../../shared/data/searchIndex";
import type { Assignment, Chip, ChipSummary, Conflict, Pin } from "../../shared/types";

export type MapView = "logical" | "package";

type PinMapState = {
  chips: ChipSummary[];
  chip?: Chip;
  selectedPinName?: string;
  mapView: MapView;
  selectedPackageName?: string;
  query: string;
  searchResults: SearchResult[];
  assignments: Assignment[];
  conflicts: Conflict[];
  setChips: (chips: ChipSummary[]) => void;
  setChip: (chip: Chip) => void;
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
  mapView: "package",
  query: "",
  searchResults: [],
  assignments: [],
  conflicts: [],
  setChips: (chips) => set({ chips }),
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
        selectedPinName,
        selectedPackageName,
        mapView: hasPackages ? state.mapView : "logical",
        searchResults: searchChip(chip, state.query)
      };
    }),
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
