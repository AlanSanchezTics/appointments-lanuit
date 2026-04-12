import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

import type {
  UpdateAdminClientPayload,
  UpdateAdminClientResponse,
} from "@/lib/admin/clients/types";

function resolveErrorTarget(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError
    || (typeof error === "object" && error !== null && "meta" in error)
  ) {
    return (error as { meta?: { target?: string[] | string } }).meta?.target;
  }

  return undefined;
}

function targetIncludes(target: string[] | string | undefined, value: string) {
  if (Array.isArray(target)) {
    return target.includes(value);
  }

  if (typeof target === "string") {
    return target.includes(value);
  }

  return false;
}

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
    clientNumber: number;
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
        ...(payload.clientNumber !== undefined
          ? { clientNumber: payload.clientNumber }
          : {}),
        ...(payload.isLoyal !== undefined ? { isLoyal: payload.isLoyal } : {}),
      },
      select: {
        id: true,
        clientNumber: true,
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
      const target = resolveErrorTarget(error);

      if (targetIncludes(target, "client_number")) {
        throw new Error("CLIENT_NUMBER_ALREADY_EXISTS");
      }

      if (targetIncludes(target, "phone")) {
        throw new Error("CLIENT_PHONE_ALREADY_EXISTS");
      }

      throw new Error("VALIDATION_ERROR");
    }

    throw error;
  }

  return {
    clientId: updatedClient.id,
    clientNumber: updatedClient.clientNumber,
    name: updatedClient.name,
    phone: updatedClient.phone,
    isLoyal: updatedClient.isLoyal,
    updatedAt: updatedClient.updatedAt.toISOString(),
  };
}
