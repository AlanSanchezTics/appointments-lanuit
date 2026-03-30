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
      name: payload.name,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      updatedAt: true,
    },
  });

  return {
    clientId: updatedClient.id,
    name: updatedClient.name,
    phone: updatedClient.phone,
    updatedAt: updatedClient.updatedAt.toISOString(),
  };
}
