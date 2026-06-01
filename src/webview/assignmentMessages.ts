import type { WebviewToExtensionMessage } from "../shared/protocol";
import type { Assignment } from "../shared/types";

export const createFunctionAssignmentMessage = (
  assignment: Assignment,
  isAssigned: boolean
): WebviewToExtensionMessage =>
  isAssigned
    ? { type: "removeAssignment", assignmentId: assignment.id }
    : { type: "assignFunction", assignment };
