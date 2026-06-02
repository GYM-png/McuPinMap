import { describe, expect, it } from "vitest";
import { detectConflicts } from "../../src/shared/config/conflictEngine";
import type { Assignment } from "../../src/shared/types";

const assignment = (
  id: string,
  pinName: string,
  functionRaw: string,
  peripheral: string,
  signal: string
): Assignment => ({
  id,
  chipId: "gd32f407",
  pinName,
  functionRaw,
  af: "AF7",
  peripheral,
  signal
});

describe("detectConflicts", () => {
  it("detects two functions assigned to the same pin", () => {
    const assignments = [
      assignment("gd32f407:PA9:USART0_TX", "PA9", "USART0_TX", "USART0", "TX"),
      assignment("gd32f407:PA9:SDIO_D2", "PA9", "SDIO_D2", "SDIO", "D2")
    ];

    expect(detectConflicts(assignments)).toEqual([
      {
        id: "pin-overlap:PA9",
        kind: "pin-overlap",
        message: "PA9 has 2 assigned functions.",
        assignmentIds: ["gd32f407:PA9:USART0_TX", "gd32f407:PA9:SDIO_D2"]
      }
    ]);
  });

  it("detects duplicate peripheral signal assignments", () => {
    const assignments = [
      assignment("gd32f407:PA9:USART0_TX", "PA9", "USART0_TX", "USART0", "TX"),
      assignment("gd32f407:PB6:USART0_TX", "PB6", "USART0_TX", "USART0", "TX")
    ];

    expect(detectConflicts(assignments)[0]).toMatchObject({
      id: "signal-duplicate:USART0:TX",
      kind: "signal-duplicate"
    });
  });

  it("allows GPIO input or output to be assigned on multiple pins", () => {
    const assignments = [
      assignment("gd32f407:PA0:GPIO_OUT", "PA0", "GPIO_OUT", "GPIO", "OUT"),
      assignment("gd32f407:PB1:GPIO_OUT", "PB1", "GPIO_OUT", "GPIO", "OUT"),
      assignment("gd32f407:PC2:GPIO_IN", "PC2", "GPIO_IN", "GPIO", "IN"),
      assignment("gd32f407:PD3:GPIO_IN", "PD3", "GPIO_IN", "GPIO", "IN")
    ];

    expect(detectConflicts(assignments)).toEqual([]);
  });
});
