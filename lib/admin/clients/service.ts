import { prisma } from "@/lib/db/prisma";
import type {
  AdminClientSearchItem,
  SearchAdminClientsInput,
  SearchAdminClientsResponse,
} from "@/lib/admin/clients/types";
import { rankClient } from "@/lib/admin/clients/helpers";

export async function searchAdminClients(
  input: SearchAdminClientsInput,
): Promise<SearchAdminClientsResponse> {
  const normalizedPhoneQuery = input.query.replace(/\D/g, "");
  const hasPhoneQuery = normalizedPhoneQuery.length > 0;

  const rows = await prisma.client.findMany({
    where: {
      OR: [
        {
          name: {
            contains: input.query,
          },
        },
        ...(hasPhoneQuery
          ? [
              {
                phone: {
                  contains: normalizedPhoneQuery,
                },
              },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
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
      name: row.name,
      phone: row.phone,
    } satisfies AdminClientSearchItem));

  return {
    query: input.query,
    total: clients.length,
    clients,
  };
}
