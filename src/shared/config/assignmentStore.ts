import type { Assignment } from "../types";

export const createAssignmentId = (
  chipId: string,
  pinName: string,
  functionRaw: string
): string => `${chipId}:${pinName}:${functionRaw}`;

export const upsertAssignment = (
  assignments: Assignment[],
  next: Assignment
): Assignment[] => {
  const index = assignments.findIndex((assignment) => assignment.id === next.id);

  if (index === -1) {
    return [...assignments, next];
  }

  return assignments.map((assignment, assignmentIndex) =>
    assignmentIndex === index ? next : assignment
  );
};

export const removeAssignment = (
  assignments: Assignment[],
  assignmentId: string
): Assignment[] =>
  assignments.filter((assignment) => assignment.id !== assignmentId);
