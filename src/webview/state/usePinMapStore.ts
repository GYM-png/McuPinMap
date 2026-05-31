import { create } from "zustand";
import { createSearchIndex, type SearchResult } from "../../shared/data/searchIndex";
import type { Assignment, Chip, ChipSummary, Conflict, Pin } from "../../shared/types";

type PinMapState = {
  chips: ChipSummary[];
  chip?: Chip;
  selectedPinName?: string;
  query: string;
  searchResults: SearchResult[];
  assignments: Assignment[];
  conflicts: Conflict[];
  setChips: (chips: ChipSummary[]) => void;
  setChip: (chip: Chip) => void;
  setAssignments: (assignments: Assignment[], conflicts: Conflict[]) => void;
  selectPin: (pinName?: string) => void;
  setQuery: (query: string) => void;
  selectedPin: () => Pin | undefined;
};

const searchChip = (chip: Chip | undefined, query: string): SearchResult[] =>
  chip ? createSearchIndex(chip).search(query) : [];

export const usePinMapStore = create<PinMapState>((set, get) => ({
  chips: [],
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

      return {
        chip,
        selectedPinName,
        searchResults: searchChip(chip, state.query)
      };
    }),
  setAssignments: (assignments, conflicts) => set({ assignments, conflicts }),
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
