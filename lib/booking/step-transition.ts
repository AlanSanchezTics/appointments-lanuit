import type { BookingStep, StepTransitionDirection } from "@/lib/booking/types";

const STEP_ORDER: Record<BookingStep, number> = {
  details: 0,
  confirm: 1,
  success: 2,
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
