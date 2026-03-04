import { CancelForm } from "@/components/cancel/cancel-form";

export const dynamic = "force-dynamic";

export default function CancelPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <CancelForm />
    </main>
  );
}
