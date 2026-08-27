import { getUserIdFromServer } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getUserIdFromServer();
  
  if (!userId) {
    redirect("/");
  }

  return <>{children}</>;
}
