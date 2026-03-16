import { NextResponse } from "next/server";

import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
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
    const errorCode = normalizeErrorCode(error);
    return NextResponse.json(
      buildErrorPayload(errorCode),
      { status: 422 },
    );
  }
}
