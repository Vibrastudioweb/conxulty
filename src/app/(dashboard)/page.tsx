import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function DashboardRootPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  switch (session.user.rol) {
    case "MEDICO":
      redirect("/hoy");
    case "ADMIN":
      redirect("/admin");
    case "STAFF":
      redirect("/staff");
  }
}
