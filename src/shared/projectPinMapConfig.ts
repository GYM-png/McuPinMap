import type { Assignment } from "./types";

export type ProjectPinMapSummary = {
  id: string;
  name: string;
  chipId?: string;
  updatedAt: string;
};

export type ProjectPinMapIndex = {
  schemaVersion: 1;
  activeMapId?: string;
  maps: ProjectPinMapSummary[];
};

export type ProjectPinMapDocument = {
  schemaVersion: 1;
  id: string;
  name: string;
  chipId?: string;
  selectedPackageName?: string;
  mapView: "logical" | "package";
  assignments: Assignment[];
  updatedAt: string;
};

const windowsReservedBasenames = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9"
]);

export const createNextProjectPinMapId = (name: string, existingIds: Set<string>): string => {
  const baseId = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safeBaseId = baseId.length === 0 ? "pin-map" : baseId;
  const candidateBaseId = windowsReservedBasenames.has(safeBaseId)
    ? `pin-map-${safeBaseId}`
    : safeBaseId;

  if (!existingIds.has(candidateBaseId)) {
    return candidateBaseId;
  }

  let suffix = 2;
  let candidate = `${candidateBaseId}-${suffix}`;
  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${candidateBaseId}-${suffix}`;
  }

  return candidate;
};

export const summarizeProjectPinMap = (map: ProjectPinMapDocument): ProjectPinMapSummary => {
  const summary: ProjectPinMapSummary = {
    id: map.id,
    name: map.name,
    updatedAt: map.updatedAt
  };

  if (map.chipId !== undefined) {
    summary.chipId = map.chipId;
  }

  return summary;
};

export const createProjectPinMapDocument = (
  id: string,
  name: string,
  now: string
): ProjectPinMapDocument => ({
  schemaVersion: 1,
  id,
  name,
  mapView: "package",
  assignments: [],
  updatedAt: now
});

export const createDefaultProjectPinMap = (
  now: string
): { index: ProjectPinMapIndex; map: ProjectPinMapDocument } => {
  const map = createProjectPinMapDocument("default", "Default", now);

  return {
    index: {
      schemaVersion: 1,
      activeMapId: map.id,
      maps: [summarizeProjectPinMap(map)]
    },
    map
  };
};

export const parseProjectPinMapIndex = (value: unknown): ProjectPinMapIndex => {
  const record = expectRecord(value, "Project pin map index must be an object.");

  if (record.schemaVersion !== 1) {
    throw new Error("Project pin map index schemaVersion must be 1.");
  }

  if (record.activeMapId !== undefined && !isNonEmptyString(record.activeMapId)) {
    throw new Error("Project pin map index activeMapId must be a non-empty string.");
  }

  if (!Array.isArray(record.maps)) {
    throw new Error("Project pin map index maps must be an array.");
  }

  const mapIds = new Set<string>();
  const maps = record.maps.map((map, index) =>
    readSummary(map, `Project pin map index maps[${index}]`)
  );

  maps.forEach((map) => {
    if (mapIds.has(map.id)) {
      throw new Error(`Project pin map index contains duplicate map id ${map.id}.`);
    }

    mapIds.add(map.id);
  });

  if (record.activeMapId !== undefined && !mapIds.has(record.activeMapId)) {
    throw new Error("Project pin map index activeMapId must reference an existing map.");
  }

  return {
    schemaVersion: 1,
    ...(record.activeMapId === undefined ? {} : { activeMapId: record.activeMapId }),
    maps
  };
};

export const parseProjectPinMapDocument = (value: unknown): ProjectPinMapDocument => {
  const record = expectRecord(value, "Project pin map document must be an object.");

  if (record.schemaVersion !== 1) {
    throw new Error("Project pin map document schemaVersion must be 1.");
  }

  const id = readNonEmptyString(record.id, "Project pin map document id must be a non-empty string.");
  const name = readNonEmptyString(
    record.name,
    "Project pin map document name must be a non-empty string."
  );
  const updatedAt = readNonEmptyString(
    record.updatedAt,
    "Project pin map document updatedAt must be a non-empty string."
  );

  if (record.chipId !== undefined && !isNonEmptyString(record.chipId)) {
    throw new Error("Project pin map document chipId must be a non-empty string.");
  }

  if (
    record.selectedPackageName !== undefined &&
    !isNonEmptyString(record.selectedPackageName)
  ) {
    throw new Error("Project pin map document selectedPackageName must be a non-empty string.");
  }

  if (record.mapView !== "logical" && record.mapView !== "package") {
    throw new Error("Project pin map document mapView must be logical or package.");
  }

  if (!Array.isArray(record.assignments)) {
    throw new Error("Project pin map document assignments must be an array.");
  }

  const assignments = record.assignments.map(readAssignment);

  return {
    schemaVersion: 1,
    id,
    name,
    ...(record.chipId === undefined ? {} : { chipId: record.chipId }),
    ...(record.selectedPackageName === undefined
      ? {}
      : { selectedPackageName: record.selectedPackageName }),
    mapView: record.mapView,
    assignments,
    updatedAt
  };
};

const readSummary = (value: unknown, label: string): ProjectPinMapSummary => {
  const record = expectRecord(value, `${label} must be an object.`);

  const id = readNonEmptyString(record.id, `${label}.id must be a non-empty string.`);
  const name = readNonEmptyString(record.name, `${label}.name must be a non-empty string.`);
  const updatedAt = readNonEmptyString(
    record.updatedAt,
    `${label}.updatedAt must be a non-empty string.`
  );

  if (record.chipId !== undefined && !isNonEmptyString(record.chipId)) {
    throw new Error(`${label}.chipId must be a non-empty string.`);
  }

  return {
    id,
    name,
    ...(record.chipId === undefined ? {} : { chipId: record.chipId }),
    updatedAt
  };
};

const readAssignment = (value: unknown): Assignment => {
  const record = expectRecord(value, "Project pin map assignment must be an object.");

  return {
    id: readNonEmptyString(record.id, "Project pin map assignment id must be a non-empty string."),
    chipId: readNonEmptyString(
      record.chipId,
      "Project pin map assignment chipId must be a non-empty string."
    ),
    pinName: readNonEmptyString(
      record.pinName,
      "Project pin map assignment pinName must be a non-empty string."
    ),
    functionRaw: readNonEmptyString(
      record.functionRaw,
      "Project pin map assignment functionRaw must be a non-empty string."
    ),
    af: readNonEmptyString(record.af, "Project pin map assignment af must be a non-empty string."),
    peripheral: readNonEmptyString(
      record.peripheral,
      "Project pin map assignment peripheral must be a non-empty string."
    ),
    signal: readNonEmptyString(
      record.signal,
      "Project pin map assignment signal must be a non-empty string."
    )
  };
};

const expectRecord = (value: unknown, message: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(message);
  }

  return value as Record<string, unknown>;
};

const readNonEmptyString = (value: unknown, message: string): string => {
  if (!isNonEmptyString(value)) {
    throw new Error(message);
  }

  return value;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
