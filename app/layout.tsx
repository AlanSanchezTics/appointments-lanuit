import type { Metadata } from "next";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import { cookies } from "next/headers";
import { Montserrat } from "next/font/google";

import Favicon from "@/assets/images/favicon.png";
import Logo from "@/assets/images/logo.png";
import AppleIcon from "@/assets/images/apple-icon.png";
import { GlobalLanguageFab } from "@/components/i18n/global-language-fab";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { resolveServerLanguage } from "@/lib/i18n/language";
import { getServerT } from "@/lib/i18n/server";
import "./globals.css";

config.autoAddCss = false;

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const language = resolveServerLanguage((await cookies()).toString());
  const t = await getServerT(language);

  return {
    title: t("metadata.title"),
    description: t("metadata.description"),
    icons: {
      icon: [
        { url: Logo.src, sizes: "any" },
        { url: Favicon.src, sizes: "800x800", type: "image/png" },
      ],
      apple: [{ url: AppleIcon.src, sizes: "180x180", type: "image/png" }],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const language = resolveServerLanguage((await cookies()).toString());

  return (
    <html lang={language}>
      <body
        className={`${montserrat.variable} font-[family-name:var(--font-body)] antialiased overflow-x-hidden`}
      >
        <I18nProvider initialLanguage={language}>
          <GlobalLanguageFab />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
