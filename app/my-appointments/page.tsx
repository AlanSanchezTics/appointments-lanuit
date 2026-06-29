import { MyAppointmentsFlow } from "@/components/my-appointments/my-appointments-flow";
import { listBookableMonths } from "@/lib/active-months/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyAppointmentsPage() {
  const availableMonths = await listBookableMonths();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center">
      <MyAppointmentsFlow availableMonths={availableMonths} />
    </main>
  );
}
