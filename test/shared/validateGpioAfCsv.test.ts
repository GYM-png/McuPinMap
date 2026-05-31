import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateGpioAfCsvText } from "../../src/shared/csv/validateGpioAfCsv";

describe("validateGpioAfCsvText", () => {
  it("accepts PinName and AF0 through AF15 headers", () => {
    const csv = readFileSync("test/fixtures/gpio-af-small.csv", "utf8");
    const result = validateGpioAfCsvText(csv);

    expect(result.errors).toEqual([]);
  });

  it("rejects a missing PinName column", () => {
    const csv = readFileSync("test/fixtures/invalid-missing-pinname.csv", "utf8");
    const result = validateGpioAfCsvText(csv);

    expect(result.errors).toContain("GPIO AF CSV header must start with PinName.");
  });
});
