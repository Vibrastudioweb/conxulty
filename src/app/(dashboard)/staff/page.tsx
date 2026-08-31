import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.rol !== "STAFF") {
    redirect("/");
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
      <PageHeader title="Staff" />

      <p className="mt-4 text-sm text-text-secondary">
        Sesión de staff iniciada correctamente.
      </p>
    </main>
  );
}
