import { notFound } from "next/navigation";

import { MonthView } from "@/components/booking/month-view";
import { getMonthAvailability } from "@/lib/availability/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BookingPageProps = {
  params: Promise<{
    month: string;
  }>;
};

export default async function BookingPage({ params }: BookingPageProps) {
  const { month } = await params;

  try {
    const days = await getMonthAvailability(month);

    if (days.length === 0) {
      return (
        <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
          <section className="w-full rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <h1 className="font-[family-name:var(--font-display)] text-4xl">Sin horarios disponibles</h1>
            <p className="mt-3 text-sm text-[var(--muted)]">No quedan espacios para el mes activo.</p>
          </section>
        </main>
      );
    }

    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-16">
        <MonthView month={month} days={days} />
      </main>
    );
  } catch {
    notFound();
  }
}
