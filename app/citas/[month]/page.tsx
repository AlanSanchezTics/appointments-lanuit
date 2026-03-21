import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";

import { getMonthAvailability } from "@/lib/availability/service";
import { formatMonthLabel } from "@/lib/datetime/mexico-city";
import { resolveServerLanguage } from "@/lib/i18n/language";
import { getServerT } from "@/lib/i18n/server";
import Image from "next/image";
import Logo from "@/assets/images/logo.png";
import { Button } from "@/components/ui/public/button";

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
    const hasSlots = days.length > 0;

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center">
        <section className="booking-mobile-shell p-8 md:p-6 min-h-screen flex items-center justify-center">
          <div className="space-y-6 w-full">
            <Image
              src={Logo}
              alt="La Nuit Nail Studio"
              className="mx-auto h-48 w-auto"
            />
            <h1 className="font-[family-name:var(--font-display)] text-4xl leading-none md:text-7xl">
              {t("home.title", { month: formatMonthLabel(month, language) })}
            </h1>
            <p className="max-w-xl text-base text-[var(--muted)]">
              {t("home.subtitle")}
            </p>
            {!hasSlots ? (
              <p className="mt-9 w-full rounded-[1rem] border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--accent-dark)]">
                {t("bookingPage.noSlotsDescription")}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                className="py-4 text-[1.02rem] font-semibold"
                variant="primary"
              >
                <Link href={`/citas/${month}/booking`} className="w-full">
                  {t("home.bookNow")}
                </Link>
              </Button>
              <Button
                className="py-4 text-[1.02rem] font-semibold"
                variant="secondary"
              >
                <Link href="/cancelar" className="w-full">
                  {t("home.cancel")}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    );
  } catch {
    notFound();
  }
}
