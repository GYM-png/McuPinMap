import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGpioAfCsvText } from "../../src/shared/csv/parseGpioAfCsv";

describe("parseGpioAfCsvText", () => {
  it("splits slash-separated functions into separate PinFunction records", () => {
    const csv = readFileSync("test/fixtures/gpio-af-small.csv", "utf8");
    const pins = parseGpioAfCsvText(csv);
    const pa9 = pins.find((pin) => pin.name === "PA9");

    expect(pa9?.functions).toContainEqual({
      af: "AF5",
      raw: "SPI1_SCK",
      peripheral: "SPI1",
      signal: "SCK",
      aliases: ["SPI1_SCK"]
    });
    expect(pa9?.functions).toContainEqual({
      af: "AF5",
      raw: "I2S1_CK",
      peripheral: "I2S1",
      signal: "CK",
      aliases: ["I2S1_CK"]
    });
  });

  it("parses pin port and number", () => {
    const csv = readFileSync("test/fixtures/gpio-af-small.csv", "utf8");
    const pins = parseGpioAfCsvText(csv);

    expect(pins[0]).toMatchObject({ name: "PA9", port: "A", number: 9 });
  });
});
