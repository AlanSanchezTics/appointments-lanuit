import type { BookingStep, StepTransitionDirection } from "@/lib/booking/types";

const STEP_ORDER: Record<BookingStep, number> = {
  schedule: 0,
  identity: 1,
  confirm: 2,
  success: 3,
};

export function getTransitionDirection(
  fromStep: BookingStep,
  toStep: BookingStep,
): StepTransitionDirection {
  if (STEP_ORDER[toStep] > STEP_ORDER[fromStep]) {
    return "forward";
  }

  return "backward";
}
