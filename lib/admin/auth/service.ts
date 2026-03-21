import { createHash, randomBytes, timingSafeEqual } from "crypto";

import { prisma } from "@/lib/db/prisma";
import { parseAdminLoginPayload } from "@/lib/admin/auth/validation";

const SALT_BYTES = 16;

function getAuthPepper() {
  return process.env.ADMIN_AUTH_PEPPER ?? "";
}

function assertPassword(password: string) {
  if (password.length < 8 || password.length > 128) {
    throw new Error("FORM_INCOMPLETE");
  }
}

function derivePasswordHash(password: string, salt: string) {
  return createHash("sha256")
    .update(`${salt}${password}${getAuthPepper()}`)
    .digest("hex");
}

export function createPasswordHash(password: string) {
  assertPassword(password);
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = derivePasswordHash(password, salt);

  return {
    hash,
    salt,
  };
}

export function verifyPasswordHash(params: {
  password: string;
  passwordSalt: string;
  passwordHash: string;
}) {
  const candidateHash = derivePasswordHash(params.password, params.passwordSalt);
  const expectedBuffer = Buffer.from(params.passwordHash, "hex");
  const candidateBuffer = Buffer.from(candidateHash, "hex");

  if (expectedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, candidateBuffer);
}

export async function authenticateAdminCredentials(rawPayload: unknown) {
  let payload: { username: string; password: string };

  try {
    payload = parseAdminLoginPayload(rawPayload);
  } catch {
    throw new Error("FORM_INCOMPLETE");
  }

  if (!payload.username || !payload.password) {
    throw new Error("FORM_INCOMPLETE");
  }

  const username = payload.username.toLowerCase();
  const user = await prisma.adminUser.findUnique({
    where: {
      username,
    },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      passwordSalt: true,
      status: true,
    },
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const isPasswordValid = verifyPasswordHash({
    password: payload.password,
    passwordSalt: user.passwordSalt,
    passwordHash: user.passwordHash,
  });

  if (!isPasswordValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (user.status !== "active") {
    throw new Error("ADMIN_USER_INACTIVE");
  }

  await prisma.adminUser.update({
    where: {
      id: user.id,
    },
    data: {
      lastLoginAt: new Date(),
    },
  });

  return {
    id: user.id,
    username: user.username,
  };
}

export async function createOrUpdateAdminUser(params: {
  username: string;
  name: string;
  password: string;
  status?: "active" | "inactive";
}) {
  const username = params.username.trim().toLowerCase();
  const name = params.name.trim();

  if (!username || !name) {
    throw new Error("FORM_INCOMPLETE");
  }

  const { hash, salt } = createPasswordHash(params.password);

  return prisma.adminUser.upsert({
    where: { username },
    update: {
      name,
      passwordHash: hash,
      passwordSalt: salt,
      status: params.status ?? "active",
    },
    create: {
      username,
      name,
      passwordHash: hash,
      passwordSalt: salt,
      status: params.status ?? "active",
    },
    select: {
      id: true,
      username: true,
      name: true,
      status: true,
    },
  });
}
