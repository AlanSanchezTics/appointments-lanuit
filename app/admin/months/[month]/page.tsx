import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { Card } from "@/components/admin/ui/Card";
import { formatMonthLabel } from "@/lib/datetime/mexico-city";
import { resolveServerLanguage } from "@/lib/i18n/language";
import { getServerT } from "@/lib/i18n/server";

type AdminMonthPlaceholderPageProps = {
  params: Promise<{
    month: string;
  }>;
};

const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

export default async function AdminMonthPlaceholderPage({
  params,
}: AdminMonthPlaceholderPageProps) {
  const session = await auth();

  if (!session) {
    redirect("/admin/login");
  }

  const { month } = await params;

  if (!MONTH_KEY_PATTERN.test(month)) {
    notFound();
  }

  const language = resolveServerLanguage((await cookies()).toString());
  const t = await getServerT(language);

  return (
    <AdminLayout>
      <main className="mx-auto w-full max-w-[412px] px-3 py-4">
        <Card className="space-y-3">
          <h1 className="text-xl font-bold text-[var(--admin-text-primary)]">
            {formatMonthLabel(month, language)}
          </h1>
          <p className="text-sm text-[var(--admin-text-secondary)]">
            {t("monthsCatalog.placeholder.description", { ns: "admin" })}
          </p>
          <Link
            href="/admin/months"
            className="inline-flex rounded-full bg-[var(--admin-accent)] px-4 py-2 text-sm font-bold text-white"
          >
            {t("monthsCatalog.placeholder.backToCatalog", { ns: "admin" })}
          </Link>
        </Card>
      </main>
    </AdminLayout>
  );
}
