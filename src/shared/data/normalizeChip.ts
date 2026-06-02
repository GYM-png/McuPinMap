import type { Chip, ChipManifestEntry, PackageLayout, Pin, PinFunction } from "../types";

export function normalizeChip(entry: ChipManifestEntry, pins: Pin[], packages: PackageLayout[] = []): Chip {
  return {
    id: entry.id,
    displayName: entry.displayName,
    vendor: entry.vendor,
    family: entry.family,
    pins: pins.map(withGpioInputOutputFunctions).sort(comparePins),
    packages
  };
}

function withGpioInputOutputFunctions(pin: Pin): Pin {
  const functions = [...pin.functions];

  for (const gpioFunction of createGpioInputOutputFunctions(pin.name)) {
    if (!functions.some((fn) => fn.raw === gpioFunction.raw)) {
      functions.unshift(gpioFunction);
    }
  }

  return {
    ...pin,
    functions
  };
}

function createGpioInputOutputFunctions(pinName: string): PinFunction[] {
  return [
    {
      af: "GPIO",
      raw: "GPIO_OUT",
      peripheral: "GPIO",
      signal: "OUT",
      aliases: [`${pinName}_OUT`, `${pinName}_GPIO_OUT`]
    },
    {
      af: "GPIO",
      raw: "GPIO_IN",
      peripheral: "GPIO",
      signal: "IN",
      aliases: [`${pinName}_IN`, `${pinName}_GPIO_IN`]
    }
  ];
}

function comparePins(left: Pin, right: Pin): number {
  if (left.port !== right.port) {
    return left.port.localeCompare(right.port);
  }
  return left.number - right.number;
}
