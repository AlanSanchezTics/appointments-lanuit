import { notFound } from "next/navigation";

import { BookingWizard } from "@/components/booking/booking-wizard";
import { getMonthAvailability } from "@/lib/availability/service";
import { listHomeAvailableMonths } from "@/lib/home/service";

type BookingPageProps = {
  searchParams: Promise<{
    month?: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const params = await searchParams;
  const availableMonths = await listHomeAvailableMonths();

  if (availableMonths.length === 0) {
    notFound();
  }

  const requestedMonth = params.month;
  const month =
    requestedMonth && availableMonths.includes(requestedMonth)
      ? requestedMonth
      : (availableMonths[0] ?? "");

  try {
    const days = await getMonthAvailability(month);

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-[412px] items-center justify-center">
        <BookingWizard
          month={month}
          days={days}
          availableMonths={availableMonths}
        />
      </main>
    );
  } catch {
    notFound();
  }
}
