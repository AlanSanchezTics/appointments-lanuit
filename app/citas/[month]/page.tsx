import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MonthEntryPageProps = {
  params: Promise<{
    month: string;
  }>;
};

export default async function MonthEntryPage({ params }: MonthEntryPageProps) {
  const { month } = await params;
  redirect(`/booking?month=${month}`);
}
