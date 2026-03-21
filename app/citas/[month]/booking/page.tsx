import { notFound } from "next/navigation";

import { MonthView } from "@/components/booking/month-view";
import { getMonthAvailability } from "@/lib/availability/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BookingWizardPageProps = {
  params: Promise<{
    month: string;
  }>;
};

export default async function BookingWizardPage({
  params,
}: BookingWizardPageProps) {
  const { month } = await params;

  try {
    const days = await getMonthAvailability(month);

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center">
        <MonthView month={month} days={days} />
      </main>
    );
  } catch {
    notFound();
  }
}
