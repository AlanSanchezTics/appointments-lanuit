import { getMonthAvailability } from "@/lib/availability/service";
import { listBookableMonths } from "@/lib/active-months/service";

export async function listHomeAvailableMonths(now = new Date()) {
  const bookableMonths = await listBookableMonths(now);
  const monthAvailability = await Promise.all(
    bookableMonths.map(async (month) => {
      try {
        const days = await getMonthAvailability(month, now);
        return {
          month,
          hasAvailability: days.length > 0,
        };
      } catch {
        return {
          month,
          hasAvailability: false,
        };
      }
    }),
  );

  return monthAvailability
    .filter((entry) => entry.hasAvailability)
    .map((entry) => entry.month);
}
