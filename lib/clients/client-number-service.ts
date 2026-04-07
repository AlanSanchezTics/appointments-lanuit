import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

const MAX_ASSIGNMENT_RETRIES = 3;

function isUniqueViolationError(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    || (typeof error === "object"
      && error !== null
      && "code" in error
      && (error as { code?: string }).code === "P2002")
  );
}

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

function normalizePreferredClientNumber(value: number | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("CLIENT_NUMBER_INVALID");
  }

  return value;
}

async function getNextClientNumberInTransaction(tx: Prisma.TransactionClient) {
  const summary = await tx.client.aggregate({
    _max: {
      clientNumber: true,
    },
  });

  return (summary._max.clientNumber ?? 0) + 1;
}

export async function getNextClientNumberSuggestion() {
  return getNextClientNumberInTransaction(prisma);
}

export async function resolveClientNumberForCreate(
  tx: Prisma.TransactionClient,
  preferredClientNumber?: number,
) {
  const normalizedPreferred = normalizePreferredClientNumber(preferredClientNumber);
  if (normalizedPreferred !== undefined) {
    return normalizedPreferred;
  }

  return getNextClientNumberInTransaction(tx);
}

export async function createClientWithUniqueClientNumber(
  tx: Prisma.TransactionClient,
  input: {
    name: string;
    phone: string;
    preferredClientNumber?: number;
  },
) {
  const normalizedPreferred = normalizePreferredClientNumber(
    input.preferredClientNumber,
  );
  let attempts = 0;

  while (attempts < MAX_ASSIGNMENT_RETRIES) {
    const clientNumber =
      attempts === 0 && normalizedPreferred !== undefined
        ? normalizedPreferred
        : await getNextClientNumberInTransaction(tx);

    try {
      return await tx.client.create({
        data: {
          name: input.name,
          phone: input.phone,
          clientNumber,
        },
      });
    } catch (error) {
      if (isUniqueViolationError(error)) {
        const target = resolveErrorTarget(error);
        const duplicatedClientNumber = targetIncludes(target, "client_number");
        const duplicatedPhone = targetIncludes(target, "phone");

        if (duplicatedPhone) {
          const existingClient = await tx.client.findUnique({
            where: {
              phone: input.phone,
            },
          });

          if (existingClient && existingClient.name.trim() === input.name.trim()) {
            return existingClient;
          }

          throw new Error(
            existingClient ? "CLIENT_NAME_MISMATCH" : "CLIENT_PHONE_ALREADY_EXISTS",
          );
        }

        if (!duplicatedClientNumber) {
          throw error;
        }
      } else {
        throw error;
      }
    }

    attempts += 1;
  }

  throw new Error("CLIENT_NUMBER_ASSIGNMENT_FAILED");
}
