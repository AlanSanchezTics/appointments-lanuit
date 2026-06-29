import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      errorCode: "ENDPOINT_DEPRECATED_USE_MY_APPOINTMENTS",
      error: "ENDPOINT_DEPRECATED_USE_MY_APPOINTMENTS",
    },
    { status: 410 },
  );
}
