import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Redirects to the admin login unless an ADMIN/STAFF user is signed in. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) redirect("/admin/login");
  return session.user;
}

/** For server actions / route handlers: throws instead of redirecting. */
export async function assertAdmin() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) throw new Error("Unauthorized");
  return session.user;
}
