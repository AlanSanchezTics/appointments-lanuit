import type { ReactNode } from "react";
import { Toaster } from "sileo";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Toaster
        position="top-center"
        options={{
          fill: "var(--foreground)",
          styles: {
            title: "text-white!",
            description: "text-white!",
          },
        }}
      />
      {children}
    </div>
  );
}
