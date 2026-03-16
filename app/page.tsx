import Link from "next/link";
import { cookies } from "next/headers";

import {
  formatMonthLabel,
  getCurrentMonthKey,
} from "@/lib/datetime/mexico-city";
import { resolveServerLanguage } from "@/lib/i18n/language";
import { getServerT } from "@/lib/i18n/server";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Logo from "@/assets/images/logo.png";

export default async function HomePage() {
  const language = resolveServerLanguage((await cookies()).toString());
  const t = await getServerT(language);
  const month = getCurrentMonthKey();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 px-6 py-16">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6 rounded-[2.5rem] border border-[var(--border)] bg-white p-8 shadow-[0_30px_80px_rgba(31,26,23,0.08)]">
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
          <p className="text-sm text-[var(--muted)]">{t("home.languageHint")}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="py-4 text-[1.02rem] font-semibold"
              variant="primary"
            >
              <Link href={`/citas/${month}`} className="w-full">
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
}
