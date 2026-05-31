import { describe, expect, it } from "vitest";
import { renderAssignmentsAsMarkdown } from "../../src/extension/exportConfig";
import type { Assignment } from "../../src/shared/types";

describe("renderAssignmentsAsMarkdown", () => {
  it("renders assignment rows", () => {
    const assignments: Assignment[] = [
      {
        id: "gd32f407:PA9:USART0_TX",
        chipId: "gd32f407",
        pinName: "PA9",
        functionRaw: "USART0_TX",
        af: "AF7",
        peripheral: "USART0",
        signal: "TX"
      }
    ];

    expect(renderAssignmentsAsMarkdown(assignments)).toContain(
      "| PA9 | AF7 | USART0_TX | USART0 | TX |"
    );
  });
});
