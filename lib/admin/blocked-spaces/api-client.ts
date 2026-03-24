"use client";

import type {
  BlockReason,
  CreateAdminBlockedSlotsPayload,
  CreateAdminBlockedSlotsResponse,
  DeleteAdminBlockedSlotResponse,
  GetAdminBlockableSlotsResponse,
  UpdateAdminBlockedSlotResponse,
} from "@/lib/admin/blocked-spaces/types";

export async function fetchAdminBlockableSlots(
  month: string,
  date?: string | null,
  signal?: AbortSignal,
): Promise<GetAdminBlockableSlotsResponse> {
  const searchParams = new URLSearchParams();

  if (date) {
    searchParams.set("date", date);
  }

  const query = searchParams.toString();
  const response = await fetch(
    `/api/admin/months/${month}/blockable-slots${query ? `?${query}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(payload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<GetAdminBlockableSlotsResponse>;
}

export async function createAdminBlockedSlots(
  payload: CreateAdminBlockedSlotsPayload,
): Promise<CreateAdminBlockedSlotsResponse> {
  const response = await fetch(`/api/admin/months/${payload.month}/blocked-slots`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(errorPayload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<CreateAdminBlockedSlotsResponse>;
}

export async function updateAdminBlockedSlotById(payload: {
  month: string;
  blockedSlotId: number;
  reason: BlockReason;
}): Promise<UpdateAdminBlockedSlotResponse> {
  const response = await fetch(
    `/api/admin/months/${payload.month}/blocked-slots/${payload.blockedSlotId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: payload.reason,
      }),
    },
  );

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(errorPayload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<UpdateAdminBlockedSlotResponse>;
}

export async function deleteAdminBlockedSlotById(payload: {
  month: string;
  blockedSlotId: number;
}): Promise<DeleteAdminBlockedSlotResponse> {
  const response = await fetch(
    `/api/admin/months/${payload.month}/blocked-slots/${payload.blockedSlotId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | { errorCode?: string }
      | null;
    throw new Error(errorPayload?.errorCode ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<DeleteAdminBlockedSlotResponse>;
}
