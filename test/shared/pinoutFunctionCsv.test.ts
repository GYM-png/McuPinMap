import { describe, expect, it } from "vitest";
import { parsePinoutFunctionCsvText } from "../../src/shared/csv/pinoutFunctionCsv";

describe("parsePinoutFunctionCsvText", () => {
  it("extracts alternate and remap functions from LQFP pinout CSV rows", () => {
    const pins = parsePinoutFunctionCsvText(
      [
        "PadNumber,PinName,PinType,Alternate,Remap",
        "29,PA4,gpio,SPI0_NSS/USART1_CK/ADC01_IN4/DAC0_OUT0,SPI2_NSS/I2S2_WS",
        "30,PA5,gpio,SPI0_SCK/ADC01_IN5/DAC0_OUT1,"
      ].join("\n")
    );

    expect(pins).toEqual([
      {
        name: "PA4",
        port: "A",
        number: 4,
        functions: [
          { af: "ALT", raw: "SPI0_NSS", peripheral: "SPI0", signal: "NSS", aliases: ["SPI0_NSS"] },
          { af: "ALT", raw: "USART1_CK", peripheral: "USART1", signal: "CK", aliases: ["USART1_CK"] },
          { af: "ALT", raw: "ADC01_IN4", peripheral: "ADC01", signal: "IN4", aliases: ["ADC01_IN4"] },
          { af: "ALT", raw: "DAC0_OUT0", peripheral: "DAC0", signal: "OUT0", aliases: ["DAC0_OUT0"] },
          { af: "REMAP", raw: "SPI2_NSS", peripheral: "SPI2", signal: "NSS", aliases: ["SPI2_NSS"] },
          { af: "REMAP", raw: "I2S2_WS", peripheral: "I2S2", signal: "WS", aliases: ["I2S2_WS"] }
        ]
      },
      {
        name: "PA5",
        port: "A",
        number: 5,
        functions: [
          { af: "ALT", raw: "SPI0_SCK", peripheral: "SPI0", signal: "SCK", aliases: ["SPI0_SCK"] },
          { af: "ALT", raw: "ADC01_IN5", peripheral: "ADC01", signal: "IN5", aliases: ["ADC01_IN5"] },
          { af: "ALT", raw: "DAC0_OUT1", peripheral: "DAC0", signal: "OUT1", aliases: ["DAC0_OUT1"] }
        ]
      }
    ]);
  });

  it("ignores non-gpio rows and non-GPIO pin names", () => {
    const pins = parsePinoutFunctionCsvText(
      [
        "PadNumber,PinName,PinType,Alternate,Remap",
        "1,VDD,power,USART1_TX,",
        "2,NRST,reset,SPI0_NSS,",
        "3,PA0-WKUP,gpio,USART1_CTS,"
      ].join("\n")
    );

    expect(pins).toEqual([]);
  });

  it("merges duplicate pin rows and deduplicates functions", () => {
    const pins = parsePinoutFunctionCsvText(
      [
        "BallName,PinName,PinType,Alternate,Remap",
        "A1,PB3,gpio,SPI2_SCK,PB3/SPI0_SCK",
        "B2,PB3,gpio,SPI2_SCK,SPI0_SCK"
      ].join("\n")
    );

    expect(pins).toHaveLength(1);
    expect(pins[0]).toMatchObject({ name: "PB3", port: "B", number: 3 });
    expect(pins[0]?.functions.map((fn) => `${fn.af}:${fn.raw}`)).toEqual([
      "ALT:SPI2_SCK",
      "REMAP:PB3",
      "REMAP:SPI0_SCK"
    ]);
  });
});
