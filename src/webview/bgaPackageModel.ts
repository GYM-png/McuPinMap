import type { Assignment, Conflict, PackagePin, Pin } from "../shared/types";
import type { SearchResult } from "../shared/data/searchIndex";
import { compareBgaRows } from "../shared/csv/bgaPinout";
import { classifyPackagePin, type PackagePinViewModel } from "./lqfpPackageModel";

export type BgaGridCell = {
  row: string;
  column: number;
  packagePin?: PackagePin;
  viewModel?: PackagePinViewModel;
};

export type BgaGridModel = {
  rows: string[];
  columns: number[];
  cells: BgaGridCell[][];
};

export type BgaGridInput = {
  packagePins: PackagePin[];
  pinsByName: Map<string, Pin>;
  selectedPinName?: string;
  searchResults: SearchResult[];
  assignments: Assignment[];
  conflicts: Conflict[];
};

export function buildBgaGridModel({
  packagePins,
  pinsByName,
  selectedPinName,
  searchResults,
  assignments,
  conflicts
}: BgaGridInput): BgaGridModel {
  const rows = [...new Set(packagePins.map((pin) => pin.row).filter((row): row is string => Boolean(row)))]
    .sort(compareBgaRows);
  const columns = [...new Set(packagePins.map((pin) => pin.column).filter((column): column is number => Number.isInteger(column)))]
    .sort((left, right) => left - right);
  const pinsByBall = new Map(
    packagePins
      .filter((pin) => pin.row && pin.column)
      .map((pin): [string, PackagePin] => [`${pin.row}:${pin.column}`, pin])
  );

  return {
    rows,
    columns,
    cells: rows.map((row) =>
      columns.map((column) => {
        const packagePin = pinsByBall.get(`${row}:${column}`);
        return {
          row,
          column,
          packagePin,
          viewModel: packagePin
            ? classifyPackagePin({
                packagePin,
                pinsByName,
                selectedPinName,
                searchResults,
                assignments,
                conflicts
              })
            : undefined
        };
      })
    )
  };
}
