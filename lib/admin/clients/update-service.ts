import { Prisma } from "@prisma/client";

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

  let updatedClient: {
    id: number;
    name: string;
    phone: string;
    isLoyal: boolean;
    updatedAt: Date;
  };

  try {
    updatedClient = await prisma.client.update({
      where: {
        id: clientId,
      },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
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
  } catch (error) {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      || (typeof error === "object"
        && error !== null
        && "code" in error
        && (error as { code?: string }).code === "P2002")
    ) {
      throw new Error("CLIENT_PHONE_ALREADY_EXISTS");
    }

    throw error;
  }

  return {
    clientId: updatedClient.id,
    name: updatedClient.name,
    phone: updatedClient.phone,
    isLoyal: updatedClient.isLoyal,
    updatedAt: updatedClient.updatedAt.toISOString(),
  };
}
