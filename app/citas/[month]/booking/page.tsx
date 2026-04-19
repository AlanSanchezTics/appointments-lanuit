import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BookingWizardRedirectPageProps = {
  params: Promise<{
    month: string;
  }>;
};

export default async function BookingWizardRedirectPage({
  params,
}: BookingWizardRedirectPageProps) {
  const { month } = await params;
  redirect(`/booking?month=${month}`);
}
