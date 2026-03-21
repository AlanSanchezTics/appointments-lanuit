import { redirect } from "next/navigation";

import { getCurrentMonthKey } from "@/lib/datetime/mexico-city";

export default async function HomePage() {
  const month = getCurrentMonthKey();

  redirect(`/citas/${month}`);
}
