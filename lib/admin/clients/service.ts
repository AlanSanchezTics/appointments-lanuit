import { prisma } from "@/lib/db/prisma";
import type {
  AdminClientSearchItem,
  SearchAdminClientsInput,
  SearchAdminClientsResponse,
} from "@/lib/admin/clients/types";
import { buildClientSearchWhere, rankClient } from "@/lib/admin/clients/helpers";

export async function searchAdminClients(
  input: SearchAdminClientsInput,
): Promise<SearchAdminClientsResponse> {
  const rows = await prisma.client.findMany({
    where: buildClientSearchWhere(input.query),
    select: {
      id: true,
      clientNumber: true,
      name: true,
      alias: true,
      phone: true,
      isLoyal: true,
      updatedAt: true,
    },
    take: input.limit * 3,
    orderBy: {
      updatedAt: "desc",
    },
  });

  const clients = rows
    .sort((left, right) => {
      const rankLeft = rankClient(input.query, left);
      const rankRight = rankClient(input.query, right);

      if (rankLeft !== rankRight) {
        return rankLeft - rankRight;
      }

      return right.updatedAt.getTime() - left.updatedAt.getTime();
    })
    .slice(0, input.limit)
    .map((row) => ({
      clientId: row.id,
      clientNumber: row.clientNumber,
      name: row.name,
      alias: row.alias,
      phone: row.phone,
      isLoyal: row.isLoyal,
    } satisfies AdminClientSearchItem));

  return {
    query: input.query,
    total: clients.length,
    clients,
  };
}
