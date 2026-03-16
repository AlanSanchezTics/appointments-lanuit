import type { Metadata } from "next";
import { cookies } from "next/headers";

import { I18nProvider } from "@/components/i18n/i18n-provider";
import { LanguageSelector } from "@/components/i18n/language-selector";
import { resolveServerLanguage } from "@/lib/i18n/language";
import { getServerT } from "@/lib/i18n/server";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const language = resolveServerLanguage((await cookies()).toString());
  const t = await getServerT(language);

  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const language = resolveServerLanguage((await cookies()).toString());

  return (
    <html lang={language}>
      <body className="font-[family-name:var(--font-body)] antialiased">
        <I18nProvider initialLanguage={language}>
          <div className="fixed bottom-5 right-5 z-50">
            <LanguageSelector />
          </div>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
