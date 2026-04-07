import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/public/button";
import Logo from "@/assets/images/logo.png";
import { formatMonthLabel } from "@/lib/datetime/mexico-city";
import { listHomeAvailableMonths } from "@/lib/home/service";
import { resolveServerLanguage } from "@/lib/i18n/language";
import { getServerT } from "@/lib/i18n/server";
import {
  buildWhatsappUrlFromMessage,
  getWhatsappPhone,
} from "@/lib/whatsapp/message";

export default async function HomePage() {
  const language = resolveServerLanguage((await cookies()).toString());
  const t = await getServerT(language);
  const availableMonths = await listHomeAvailableMonths();
  const hasAvailableMonths = availableMonths.length > 0;
  const whatsappPhone = getWhatsappPhone();
  const whatsappUrl = whatsappPhone
    ? buildWhatsappUrlFromMessage({
        phone: whatsappPhone,
        message: t("home.unavailableWhatsappMessage") as string,
      })
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <Image
          src={Logo}
          alt="La Nuit Nail Studio"
          className="mx-auto mb-5 h-40 w-auto"
        />
        {hasAvailableMonths ? (
          <div className="mb-[1.5rem]">
            <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">
              {t("home.welcome")}
            </h1>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-2xl md:text-3xl">
              {t("home.title")}
            </h2>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {t("home.subtitle")}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)] mb-[1rem]">
            {t("home.unavailableMessage")}
          </p>
        )}
        <div className="flex flex-col gap-3">
          {availableMonths.map((month) => (
            <Link
              key={month}
              href={`/citas/${month}/booking`}
              className={buttonVariants({
                className: "min-h-12 px-6 text-base font-semibold text-white!",
              })}
            >
              {formatMonthLabel(month, language)}
            </Link>
          ))}
          {!hasAvailableMonths ? (
            <>
              <p className="w-full rounded-[1rem] border border-[var(--warning-soft)] bg-[var(--warning-surface)] px-4 py-3 text-sm text-[var(--accent-dark)] mb-[1rem]">
                {t("home.unavailableHint")}
              </p>
              {whatsappUrl ? (
                <Link
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({
                    className:
                      "min-h-12 px-6 text-base font-semibold text-white!",
                  })}
                >
                  {t("home.whatsapp")}
                </Link>
              ) : null}
            </>
          ) : null}
          <p className="py-1 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
            {t("home.orSeparator")}
          </p>
          <Link
            href="/citas/cancelar"
            className={buttonVariants({
              variant: "secondary",
              className: "min-h-12 px-6 text-base font-semibold",
            })}
          >
            {t("home.cancel")}
          </Link>
        </div>
      </section>
    </main>
  );
}
