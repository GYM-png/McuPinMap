export type PinType = "gpio" | "power" | "ground" | "reset" | "clock" | "boot" | "nc";

export type PinFunction = {
  af: string;
  raw: string;
  peripheral: string;
  signal: string;
  aliases: string[];
};

export type Pin = {
  name: string;
  port: string;
  number: number;
  functions: PinFunction[];
};

export type PackagePin = {
  padNumber: number;
  pinName: string;
  pinType?: PinType;
};

export type PackageLayout = {
  packageName: string;
  packageType: "LQFP";
  totalPads: number;
  orientation?: "pin1-top-left";
  pins: PackagePin[];
};

export type Chip = {
  id: string;
  displayName: string;
  vendor: string;
  family: string;
  pins: Pin[];
  packages: PackageLayout[];
};

export type ChipManifestEntry = {
  id: string;
  vendor: string;
  family: string;
  displayName: string;
  gpioAfCsv: string;
  packages: Array<{
    name: string;
    pinoutCsv: string;
  }>;
  source: string;
  status: "draft" | "stable";
};

export type ChipManifest = {
  schemaVersion: 1;
  dataVersion: string;
  chips: ChipManifestEntry[];
};

export type Assignment = {
  id: string;
  chipId: string;
  pinName: string;
  functionRaw: string;
  af: string;
  peripheral: string;
  signal: string;
};

export type Conflict = {
  id: string;
  kind: "pin-overlap" | "signal-duplicate";
  message: string;
  assignmentIds: string[];
};

export type ChipSummary = {
  id: string;
  displayName: string;
  vendor: string;
  family: string;
};
