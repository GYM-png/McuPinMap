import { describe, expect, it, vi } from "vitest";
import {
  buildImportedChip,
  findSingleGpioAfCsvFile,
  inferCsvImportMetadataDefaults,
  inferPackageNameFromCsvFilename,
  importLocalCsvFromUris
} from "../../src/extension/csvImport";

const gpioAfHeader = "PinName,AF0,AF1,AF2,AF3,AF4,AF5,AF6,AF7,AF8,AF9,AF10,AF11,AF12,AF13,AF14,AF15";

const metadata = {
  id: "LOCAL_GD32",
  displayName: "Local GD32",
  vendor: "LocalVendor",
  family: "LocalFamily"
};

describe("buildImportedChip", () => {
  it("imports GPIO AF CSV with no package data and includes normalized GPIO input/output functions", () => {
    const chip = buildImportedChip({
      ...metadata,
      gpioAfCsvText: [
        gpioAfHeader,
        "PA0,,TIMER1_CH0,,,,,,,,,,,,,,",
        "PB1,,,,,,,,,,,,,,,,"
      ].join("\n")
    });

    expect(chip).toMatchObject({
      id: "LOCAL_GD32",
      displayName: "Local GD32",
      vendor: "LocalVendor",
      family: "LocalFamily",
      packages: []
    });
    expect(chip.pins.map((pin) => pin.name)).toEqual(["PA0", "PB1"]);
    expect(chip.pins[0]?.functions.map((fn) => fn.raw)).toEqual([
      "GPIO_IN",
      "GPIO_OUT",
      "TIMER1_CH0"
    ]);
    expect(chip.pins[1]?.functions.map((fn) => fn.raw)).toEqual(["GPIO_IN", "GPIO_OUT"]);
  });

  it("imports GPIO AF CSV with LQFP pinout", () => {
    const chip = buildImportedChip({
      ...metadata,
      gpioAfCsvText: [gpioAfHeader, "PA0,,,,,,,,,,,,,,,,"].join("\n"),
      packages: [
        {
          packageName: "LQFP3",
          csvText: ["PadNumber,PinName,PinType", "3,VSS,ground", "1,PA0,gpio", "2,VDD,power"].join("\n")
        }
      ]
    });

    expect(chip.packages).toEqual([
      {
        packageName: "LQFP3",
        packageType: "LQFP",
        totalPads: 3,
        orientation: "pin1-top-left",
        pins: [
          { padNumber: 1, pinName: "PA0", pinType: "gpio" },
          { padNumber: 2, pinName: "VDD", pinType: "power" },
          { padNumber: 3, pinName: "VSS", pinType: "ground" }
        ]
      }
    ]);
  });

  it("imports GPIO AF CSV with BGA pinout", () => {
    const chip = buildImportedChip({
      ...metadata,
      gpioAfCsvText: [gpioAfHeader, "PA0,,,,,,,,,,,,,,,,"].join("\n"),
      packages: [
        {
          packageName: "BGA4",
          csvText: ["BallName,PinName,PinType", "B2,VDD,power", "A2,VSS,ground", "A1,PA0,gpio", "B1,PB1,gpio"].join("\n")
        }
      ]
    });

    expect(chip.packages).toEqual([
      {
        packageName: "BGA4",
        packageType: "BGA",
        totalPads: 4,
        orientation: "a1-top-left",
        pins: [
          { ballName: "A1", row: "A", column: 1, pinName: "PA0", pinType: "gpio" },
          { ballName: "A2", row: "A", column: 2, pinName: "VSS", pinType: "ground" },
          { ballName: "B1", row: "B", column: 1, pinName: "PB1", pinType: "gpio" },
          { ballName: "B2", row: "B", column: 2, pinName: "VDD", pinType: "power" }
        ]
      }
    ]);
  });

  it("builds an imported chip from package pinout CSVs without GPIO AF CSV", () => {
    const chip = buildImportedChip({
      id: "GD32F103",
      displayName: "GD32F103",
      vendor: "GigaDevice",
      family: "GD32F1",
      functionSource: "pinout-csv",
      packages: [
        {
          packageName: "LQFP4",
          csvText: [
            "PadNumber,PinName,PinType,Alternate,Remap",
            "1,PA4,gpio,SPI0_NSS/USART1_CK,SPI2_NSS",
            "2,PA5,gpio,SPI0_SCK,",
            "3,VDD,power,,",
            "4,VSS,ground,,"
          ].join("\n")
        }
      ]
    });

    expect(chip.functionSource).toBe("pinout-csv");
    expect(chip.pins.find((pin) => pin.name === "PA4")?.functions.map((fn) => fn.raw)).toContain("SPI2_NSS");
  });

  it("rejects invalid GPIO AF CSV with a validator message", () => {
    expect(() =>
      buildImportedChip({
        ...metadata,
        gpioAfCsvText: "PinName,AF0\nPA0,TIMER1_CH0"
      })
    ).toThrow("GPIO AF CSV header must be exactly");
  });

  it("rejects unsupported package names", () => {
    expect(() =>
      buildImportedChip({
        ...metadata,
        gpioAfCsvText: [gpioAfHeader, "PA0,,,,,,,,,,,,,,,,"].join("\n"),
        packages: [{ packageName: "QFN48", csvText: "PadNumber,PinName,PinType\n1,PA0,gpio" }]
      })
    ).toThrow("Unsupported package QFN48");
  });

  it("rejects duplicate package names before creating unreachable package choices", () => {
    expect(() =>
      buildImportedChip({
        ...metadata,
        gpioAfCsvText: [gpioAfHeader, "PA0,,,,,,,,,,,,,,,,"].join("\n"),
        packages: [
          {
            packageName: "LQFP3",
            csvText: ["PadNumber,PinName,PinType", "1,PA0,gpio", "2,VDD,power", "3,VSS,ground"].join("\n")
          },
          {
            packageName: "lqfp3",
            csvText: ["PadNumber,PinName,PinType", "1,PA0,gpio", "2,VDD,power", "3,VSS,ground"].join("\n")
          }
        ]
      })
    ).toThrow("Duplicate package LQFP3");
  });

  it("rejects invalid package CSV with package name in the error", () => {
    expect(() =>
      buildImportedChip({
        ...metadata,
        gpioAfCsvText: [gpioAfHeader, "PA0,,,,,,,,,,,,,,,,"].join("\n"),
        packages: [{ packageName: "LQFP2", csvText: "PadNumber,PinName,PinType\n1,PA0,gpio" }]
      })
    ).toThrow("LQFP2");
  });

  it("rejects LQFP pinout files whose pads do not cover the package count", () => {
    expect(() =>
      buildImportedChip({
        ...metadata,
        gpioAfCsvText: [gpioAfHeader, "PA0,,,,,,,,,,,,,,,,"].join("\n"),
        packages: [
          {
            packageName: "LQFP3",
            csvText: ["PadNumber,PinName,PinType", "1,PA0,gpio", "2,VDD,power"].join("\n")
          }
        ]
      })
    ).toThrow("PadNumber must cover every value from 1 to 3");
  });

  it("rejects BGA pinout files whose balls do not match the package count", () => {
    expect(() =>
      buildImportedChip({
        ...metadata,
        gpioAfCsvText: [gpioAfHeader, "PA0,,,,,,,,,,,,,,,,"].join("\n"),
        packages: [
          {
            packageName: "BGA4",
            csvText: ["BallName,PinName,PinType", "A1,PA0,gpio", "A2,VSS,ground"].join("\n")
          }
        ]
      })
    ).toThrow("BGA pinout must contain 4 ball(s).");
  });
});

describe("CSV import dialog helpers", () => {
  it("identifies exactly one GPIO AF CSV by filename suffix", () => {
    expect(
      findSingleGpioAfCsvFile([
        { filename: "GD32F407_LQFP100_PINOUT.csv", csvText: "pinout" },
        { filename: "GD32F407_GPIO_AF.csv", csvText: "gpio" }
      ])
    ).toEqual({ filename: "GD32F407_GPIO_AF.csv", csvText: "gpio" });
  });

  it("allows missing GPIO AF CSV files and rejects duplicates", () => {
    expect(findSingleGpioAfCsvFile([{ filename: "GD32F407_LQFP100_PINOUT.csv", csvText: "pinout" }])).toBeUndefined();

    expect(() =>
      findSingleGpioAfCsvFile([
        { filename: "GD32F407_GPIO_AF.csv", csvText: "gpio" },
        { filename: "GD32H759_GPIO_AF.csv", csvText: "gpio" }
      ])
    ).toThrow("Select at most one GPIO AF CSV");
  });

  it("infers metadata defaults from the GPIO AF filename stem", () => {
    expect(inferCsvImportMetadataDefaults("GD32F407_GPIO_AF.csv")).toEqual({
      id: "GD32F407",
      displayName: "GD32F407",
      vendor: "local",
      family: "local"
    });
  });

  it("infers metadata defaults from the package pinout filename stem", () => {
    expect(inferCsvImportMetadataDefaults("GD32F103_LQFP100_PINOUT.csv")).toEqual({
      id: "GD32F103",
      displayName: "GD32F103",
      vendor: "local",
      family: "local"
    });
  });

  it("infers package names from LQFP and BGA pinout filenames", () => {
    expect(inferPackageNameFromCsvFilename("GD32F407_LQFP100_PINOUT.csv")).toBe("LQFP100");
    expect(inferPackageNameFromCsvFilename("GD32F470_BGA176_PINOUT.csv")).toBe("BGA176");
    expect(inferPackageNameFromCsvFilename("notes.csv")).toBeUndefined();
  });

  it("imports selected package pinout CSVs without a GPIO AF CSV", async () => {
    const pinoutCsvText = [
      "PadNumber,PinName,PinType,Alternate,Remap",
      "1,PA4,gpio,SPI0_NSS,SPI2_NSS",
      "2,PA5,gpio,SPI0_SCK,",
      "3,VDD,power,,",
      "4,VSS,ground,,"
    ].join("\n");
    const inputValues = ["GD32F103", "GD32F103", "GigaDevice", "GD32F1", "LQFP4"];
    const vscode = {
      workspace: {
        fs: {
          readFile: vi.fn(async () => Buffer.from(pinoutCsvText, "utf8"))
        }
      },
      window: {
        showInputBox: vi.fn(async () => inputValues.shift())
      }
    };

    const chip = await importLocalCsvFromUris(vscode as never, [
      { fsPath: "D:\\imports\\GD32F103_LQFP4_PINOUT.csv" }
    ] as never);

    expect(chip?.functionSource).toBe("pinout-csv");
    expect(chip?.id).toBe("GD32F103");
    expect(chip?.packages[0]?.packageName).toBe("LQFP4");
    expect(chip?.pins.find((pin) => pin.name === "PA4")?.functions.map((fn) => fn.raw)).toContain("SPI2_NSS");
    expect(vscode.window.showInputBox).toHaveBeenLastCalledWith(
      expect.objectContaining({
        prompt: "Package name for GD32F103_LQFP4_PINOUT.csv",
        value: "LQFP4"
      })
    );
  });
});
