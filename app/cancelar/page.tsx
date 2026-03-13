import { CancelForm } from "@/components/cancel/cancel-form";

export const dynamic = "force-dynamic";

export default function CancelPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-8 sm:px-6">
      <CancelForm />
    </main>
  );
}
