export const VALID_PIN_TYPES = new Set(["gpio", "power", "ground", "reset", "clock", "boot", "nc"]);

export type ParsedBgaBall = {
  ballName: string;
  row: string;
  column: number;
};

export function parseBgaPackageName(packageName: string): number {
  const match = /^BGA(\d+)$/.exec(packageName);
  if (!match) {
    throw new Error(`Unsupported package name ${packageName}. Expected BGA<number>.`);
  }

  return Number(match[1]);
}

export function parseBgaBallName(ballName: string): ParsedBgaBall | undefined {
  const match = /^([A-Z]+)(\d+)$/.exec(ballName.trim().toUpperCase());
  if (!match) {
    return undefined;
  }

  const column = Number(match[2]);
  if (!Number.isInteger(column) || column < 1) {
    return undefined;
  }

  return {
    ballName: `${match[1]}${column}`,
    row: match[1],
    column
  };
}

export function compareBgaBalls(left: Pick<ParsedBgaBall, "row" | "column">, right: Pick<ParsedBgaBall, "row" | "column">): number {
  const rowCompare = compareBgaRows(left.row, right.row);
  return rowCompare === 0 ? left.column - right.column : rowCompare;
}

export function compareBgaRows(left: string, right: string): number {
  return bgaRowToNumber(left) - bgaRowToNumber(right);
}

export function bgaRowToNumber(row: string): number {
  return row
    .toUpperCase()
    .split("")
    .reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
}
