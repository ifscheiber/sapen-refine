import AppShell from "./AppShell";

export default function AppPage() {
  return <AppShell />;
}






/* import { redirect } from "next/navigation";
import { getUserFromSessionCookie } from "@/server/auth/session";
import { LogoutButton } from "@/components/logout-button";


export default async function AppHome() {
  const user = await getUserFromSessionCookie();
  if (!user) redirect("/login");

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">SaPen Refine</h1>
      <p className="mt-2 opacity-70">Logged in as {user.email}</p>
      <div className="mt-6">
        <LogoutButton />
      </div>

      <form
        className="mt-6"
        action={async () => {
          "use server";
          // simplest: call API via fetch is possible too, but we can do server action later.
        }}
      />
    </main>
  );
}
 */