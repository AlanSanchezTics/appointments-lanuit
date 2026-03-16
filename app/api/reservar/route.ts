import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      errorCode: "ENDPOINT_DEPRECATED_USE_CHECK_LOCK_CONFIRM",
      error: "ENDPOINT_DEPRECATED_USE_CHECK_LOCK_CONFIRM",
    },
    { status: 410 },
  );
}
