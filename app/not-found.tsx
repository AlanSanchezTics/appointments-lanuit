import Link from "next/link";
import { cookies } from "next/headers";

import { resolveServerLanguage } from "@/lib/i18n/language";
import { getServerT } from "@/lib/i18n/server";

export default async function NotFound() {
  const language = resolveServerLanguage((await cookies()).toString());
  const t = await getServerT(language);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">404</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl">{t("notFound.invalidRoute")}</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">{t("notFound.allowedMonthsOnly")}</p>
        <Link className="mt-6 inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white" href="/">
          {t("notFound.backHome")}
        </Link>
      </section>
    </main>
  );
}
