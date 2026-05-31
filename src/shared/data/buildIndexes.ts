import type { Chip, PinFunction } from "../types";

export type ChipIndexes = {
  functionsByPin: Map<string, PinFunction[]>;
  pinsByFunction: Map<string, string[]>;
  pinsByPeripheral: Map<string, string[]>;
};

export function buildChipIndexes(chip: Chip): ChipIndexes {
  const functionsByPin = new Map<string, PinFunction[]>();
  const pinsByFunction = new Map<string, string[]>();
  const pinsByPeripheral = new Map<string, string[]>();

  for (const pin of chip.pins) {
    functionsByPin.set(pin.name, pin.functions);

    for (const fn of pin.functions) {
      addUniquePinName(pinsByFunction, fn.raw, pin.name);
      addUniquePinName(pinsByPeripheral, fn.peripheral, pin.name);
    }
  }

  return { functionsByPin, pinsByFunction, pinsByPeripheral };
}

function addUniquePinName(
  index: Map<string, string[]>,
  key: string,
  pinName: string
): void {
  const pinNames = index.get(key);

  if (!pinNames) {
    index.set(key, [pinName]);
    return;
  }

  if (!pinNames.includes(pinName)) {
    pinNames.push(pinName);
  }
}
