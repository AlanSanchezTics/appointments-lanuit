import { notFound } from "next/navigation";
import { cookies } from "next/headers";

import { MonthView } from "@/components/booking/month-view";
import { getMonthAvailability } from "@/lib/availability/service";
import { resolveServerLanguage } from "@/lib/i18n/language";
import { getServerT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BookingPageProps = {
  params: Promise<{
    month: string;
  }>;
};

export default async function BookingPage({ params }: BookingPageProps) {
  const { month } = await params;
  const language = resolveServerLanguage((await cookies()).toString());
  const t = await getServerT(language);

  try {
    const days = await getMonthAvailability(month);

    if (days.length === 0) {
      return (
        <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10 sm:px-6">
          <section className="w-full max-w-md rounded-[2.5rem] border border-white/70 bg-[var(--surface)] p-8 text-center shadow-[0_30px_80px_rgba(52,37,31,0.15)]">
            <h1 className="font-[family-name:var(--font-display)] text-4xl">{t("bookingPage.noSlotsTitle")}</h1>
            <p className="mt-3 text-sm text-[var(--muted)]">{t("bookingPage.noSlotsDescription")}</p>
          </section>
        </main>
      );
    }

    return (
      <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
        <MonthView month={month} days={days} />
      </main>
    );
  } catch {
    notFound();
  }
}
