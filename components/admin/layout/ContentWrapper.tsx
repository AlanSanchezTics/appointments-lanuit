import type { ReactNode } from "react";

export function ContentWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[412px] px-6 py-6">{children}</div>
  );
}
