import { useEffect, useRef, useState } from "react";

import { getTransitionDirection } from "@/lib/booking/step-transition";
import type {
  BookingStep,
  StepTransitionDirection,
} from "@/lib/booking/types";

export const STEP_TRANSITION_MS = 260;

type UseBookingStepTransitionParams = {
  step: BookingStep;
  animationsEnabled: boolean;
};

export function useBookingStepTransition({
  step,
  animationsEnabled,
}: UseBookingStepTransitionParams) {
  const [visibleStep, setVisibleStep] = useState<BookingStep>(step);
  const [leavingStep, setLeavingStep] = useState<BookingStep | null>(null);
  const [isStepTransitioning, setIsStepTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] =
    useState<StepTransitionDirection>("forward");
  const visibleStepRef = useRef<BookingStep>(step);

  useEffect(() => {
    visibleStepRef.current = visibleStep;
  }, [visibleStep]);

  useEffect(() => {
    const currentVisibleStep = visibleStepRef.current;

    if (step === currentVisibleStep) {
      return;
    }

    const direction = getTransitionDirection(currentVisibleStep, step);
    setTransitionDirection(direction);

    if (!animationsEnabled) {
      setLeavingStep(null);
      setVisibleStep(step);
      setIsStepTransitioning(false);
      return;
    }

    setLeavingStep(currentVisibleStep);
    setVisibleStep(step);
    setIsStepTransitioning(true);

    const timer = window.setTimeout(() => {
      setLeavingStep(null);
      setIsStepTransitioning(false);
    }, STEP_TRANSITION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [animationsEnabled, step]);

  return {
    visibleStep,
    leavingStep,
    isStepTransitioning,
    transitionDirection,
  };
}
