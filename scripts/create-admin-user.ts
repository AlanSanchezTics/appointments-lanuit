import { createHash, randomBytes } from "crypto";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { PrismaClient } from "@prisma/client";

type AdminStatus = "active" | "inactive";

function parseArg(name: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function normalizeStatus(value: string | null): AdminStatus | null {
  if (!value) {
    return null;
  }

  const lowered = value.toLowerCase();
  if (lowered === "active" || lowered === "inactive") {
    return lowered;
  }

  throw new Error("INVALID_STATUS");
}

function assertPassword(password: string) {
  if (password.length < 8 || password.length > 128) {
    throw new Error("INVALID_ADMIN_PASSWORD_LENGTH");
  }
}

function createPasswordHash(password: string) {
  assertPassword(password);
  const pepper = process.env.ADMIN_AUTH_PEPPER ?? "";
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(`${salt}${password}${pepper}`)
    .digest("hex");

  return { hash, salt };
}

async function promptMissingFields() {
  const rl = createInterface({ input, output });
  try {
    const username = parseArg("username") ?? (await rl.question("Username: "));
    const name = parseArg("name") ?? (await rl.question("Name: "));
    const password = parseArg("password") ?? (await rl.question("Password: "));
    const statusArg = parseArg("status") ?? (await rl.question("Status (active/inactive, default active): "));

    return {
      username: username.trim().toLowerCase(),
      name: name.trim(),
      password: password.trim(),
      status: normalizeStatus(statusArg.trim()) ?? "active",
    };
  } finally {
    rl.close();
  }
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const payload = await promptMissingFields();

    if (!payload.username || !payload.name || !payload.password) {
      throw new Error("FORM_INCOMPLETE");
    }

    const { hash, salt } = createPasswordHash(payload.password);

    const adminUser = await prisma.adminUser.upsert({
      where: {
        username: payload.username,
      },
      update: {
        name: payload.name,
        passwordHash: hash,
        passwordSalt: salt,
        status: payload.status,
      },
      create: {
        username: payload.username,
        name: payload.name,
        passwordHash: hash,
        passwordSalt: salt,
        status: payload.status,
      },
      select: {
        id: true,
        username: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(
      JSON.stringify(
        {
          created: true,
          adminUser,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
