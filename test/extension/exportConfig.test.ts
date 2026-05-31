import { describe, expect, it } from "vitest";
import {
  renderAssignmentsAsJson,
  renderAssignmentsAsMarkdown
} from "../../src/extension/exportConfig";
import type { Assignment } from "../../src/shared/types";

const assignment = (overrides: Partial<Assignment> = {}): Assignment => ({
  id: "gd32f407:PA9:USART0_TX",
  chipId: "gd32f407",
  pinName: "PA9",
  functionRaw: "USART0_TX",
  af: "AF7",
  peripheral: "USART0",
  signal: "TX",
  ...overrides
});

describe("renderAssignmentsAsJson", () => {
  it("renders pretty JSON with an assignments array", () => {
    const assignments = [assignment()];

    const rendered = renderAssignmentsAsJson(assignments);

    expect(rendered).toBe(JSON.stringify({ assignments }, null, 2));
    expect(JSON.parse(rendered)).toEqual({ assignments });
  });
});

describe("renderAssignmentsAsMarkdown", () => {
  it("renders assignment rows", () => {
    const assignments = [assignment()];

    expect(renderAssignmentsAsMarkdown(assignments)).toContain(
      "| PA9 | AF7 | USART0_TX | USART0 | TX |"
    );
  });

  it("escapes markdown table cell separators and line breaks", () => {
    const assignments = [
      assignment({
        functionRaw: "USART0|TX\\ALT\nNEXT",
        signal: "TX|MAIN\\ALT\r\nNEXT"
      })
    ];

    expect(renderAssignmentsAsMarkdown(assignments)).toContain(
      "| PA9 | AF7 | USART0\\|TX\\\\ALT NEXT | USART0 | TX\\|MAIN\\\\ALT NEXT |"
    );
  });

  it("renders table headers for empty assignments", () => {
    expect(renderAssignmentsAsMarkdown([])).toContain(
      "| Pin | AF | Function | Peripheral | Signal |\n|---|---|---|---|---|"
    );
  });
});
