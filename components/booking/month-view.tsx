"use client";

import { BookingWizard } from "@/components/booking/booking-wizard";
import type { DayAvailability } from "@/lib/availability/service";

type MonthViewProps = {
  month: string;
  days: DayAvailability[];
};

export function MonthView({ month, days }: MonthViewProps) {
  return <BookingWizard days={days} month={month} />;
}
