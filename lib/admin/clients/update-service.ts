import { prisma } from "@/lib/db/prisma";

import type {
  UpdateAdminClientPayload,
  UpdateAdminClientResponse,
} from "@/lib/admin/clients/types";

export async function updateAdminClient(
  clientId: number,
  payload: UpdateAdminClientPayload,
): Promise<UpdateAdminClientResponse> {
  const existingClient = await prisma.client.findUnique({
    where: {
      id: clientId,
    },
    select: {
      id: true,
    },
  });

  if (!existingClient) {
    throw new Error("CLIENT_NOT_FOUND");
  }

  const updatedClient = await prisma.client.update({
    where: {
      id: clientId,
    },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.isLoyal !== undefined ? { isLoyal: payload.isLoyal } : {}),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      isLoyal: true,
      updatedAt: true,
    },
  });

  return {
    clientId: updatedClient.id,
    name: updatedClient.name,
    phone: updatedClient.phone,
    isLoyal: updatedClient.isLoyal,
    updatedAt: updatedClient.updatedAt.toISOString(),
  };
}
