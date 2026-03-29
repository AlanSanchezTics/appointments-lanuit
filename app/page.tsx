import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Image from "next/image";

import { buttonVariants } from "@/components/ui/public/button";
import Logo from "@/assets/images/logo.png";
import { listBookableMonths } from "@/lib/active-months/service";
import { resolveServerLanguage } from "@/lib/i18n/language";
import { getServerT } from "@/lib/i18n/server";
import {
  buildWhatsappUrlFromMessage,
  getWhatsappPhone,
} from "@/lib/whatsapp/message";

export default async function HomePage() {
  const bookableMonths = await listBookableMonths();
  const firstBookableMonth = bookableMonths.at(0);

  if (firstBookableMonth) {
    redirect(`/citas/${firstBookableMonth}`);
  }

  const language = resolveServerLanguage((await cookies()).toString());
  const t = await getServerT(language);
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
        <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl">
          {t("home.unavailableMessage")}
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {t("home.unavailableHint")}
        </p>
        {whatsappUrl ? (
          <a
            className={buttonVariants({
              className:
                "mt-6 min-h-12 px-6 text-base font-semibold text-white!",
            })}
            href={whatsappUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t("home.contactWhatsapp")}
          </a>
        ) : (
          <p className="mt-6 text-sm text-[var(--muted)]">
            {t("home.whatsappUnavailable")}
          </p>
        )}
      </section>
    </main>
  );
}
