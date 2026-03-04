import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "La Nuit | Citas",
  description: "Reserva y cancela citas dentro del mes actual.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="font-[family-name:var(--font-body)] antialiased">{children}</body>
    </html>
  );
}
