import { describe, expect, it } from "vitest";
import type { Assignment } from "../../src/shared/types";
import { createFunctionAssignmentMessage } from "../../src/webview/assignmentMessages";

const assignment: Assignment = {
  id: "gd32f407:PA15:SPI0_NSS",
  chipId: "gd32f407",
  pinName: "PA15",
  functionRaw: "SPI0_NSS",
  af: "AF5",
  peripheral: "SPI0",
  signal: "NSS"
};

describe("createFunctionAssignmentMessage", () => {
  it("assigns an unassigned function", () => {
    expect(createFunctionAssignmentMessage(assignment, false)).toEqual({
      type: "assignFunction",
      assignment
    });
  });

  it("removes an assigned function", () => {
    expect(createFunctionAssignmentMessage(assignment, true)).toEqual({
      type: "removeAssignment",
      assignmentId: assignment.id
    });
  });
});
