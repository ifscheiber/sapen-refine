import { redirect } from "next/navigation";
import { getUserFromSessionCookie } from "@/server/auth/session";

export default async function Home() {
  const user = await getUserFromSessionCookie();
  redirect(user ? "/app" : "/login?next=/app");
}
