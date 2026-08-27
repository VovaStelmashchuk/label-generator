import { getUserFromServer, deleteSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";

async function logoutAction() {
  "use server";
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (token) {
    await deleteSession(token);
  }
  cookieStore.delete("auth_token");
  redirect("/");
}

export default async function ProfilePage() {
  const user = await getUserFromServer();

  if (!user) {
    redirect("/");
  }

  const initials = user.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:py-14">
      <header className="mb-10 border-b-2 border-accent-primary pb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="lucide:user" className="size-6" />
          <h1 className="text-2xl font-semibold tracking-tight">User Profile</h1>
        </div>
      </header>

      <div className="rounded-md border border-separator-secondary bg-surface p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="w-24 h-24 rounded-full bg-accent-primary flex items-center justify-center text-white text-3xl font-bold shadow-md">
            {initials}
          </div>

          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold">{user.name || "User Account"}</h2>
            <p className="text-label-secondary text-lg mt-1">{user.email}</p>
            <div className="mt-4 flex flex-col sm:flex-row justify-center md:justify-start gap-4">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                {user.roles.map(role => (
                  <Tag key={role} variant="primary">Roles: {role}</Tag>
                ))}
              </div>

              <form action={logoutAction}>
                <Button
                  type="submit"
                  variant="ghost"
                  icon="lucide:log-out"
                >
                  Logout
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
