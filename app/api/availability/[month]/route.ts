import { NextResponse } from "next/server";

import { getMonthAvailability } from "@/lib/availability/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AvailabilityRouteProps = {
  params: Promise<{
    month: string;
  }>;
};

export async function GET(_request: Request, { params }: AvailabilityRouteProps) {
  const { month } = await params;

  try {
    const days = await getMonthAvailability(month);

    return NextResponse.json({
      month,
      days,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      },
      { status: 422 },
    );
  }
}
