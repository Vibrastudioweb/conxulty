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
    case "SUPERADMIN":
      redirect("/superadmin");
    case "ENTIDAD":
      // Sin Agenda ni "Hoy" — la ficha pública es lo único que tiene una
      // cuenta de clínica/farmacia (changelog punto 90/92), así que es
      // directamente su home.
      redirect("/ficha-entidad");
  }
}
