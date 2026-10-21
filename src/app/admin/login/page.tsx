import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/auth";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

async function passwordLogin(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/admin",
    });
  } catch (e) {
    if (e instanceof AuthError) redirect("/admin/login?error=1");
    throw e; // NEXT_REDIRECT on success
  }
}

async function magicLogin(formData: FormData) {
  "use server";
  try {
    await signIn("resend", { email: String(formData.get("email") ?? ""), redirectTo: "/admin" });
  } catch (e) {
    if (e instanceof AuthError) redirect("/admin/login?error=1");
    throw e;
  }
}

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="court-lines flex min-h-dvh items-center justify-center bg-court p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl sm:p-8">
        <div className="flex items-center gap-2">
          <LogoMark />
          <h1 className="font-display text-2xl font-extrabold uppercase">Admin</h1>
        </div>
        <Suspense>
          <Messages searchParams={searchParams} />
        </Suspense>
        <form action={passwordLogin} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <Button type="submit" className="w-full" size="lg">
            Sign in
          </Button>
        </form>
        {process.env.RESEND_API_KEY && (
          <form action={magicLogin} className="mt-6 space-y-3 border-t pt-6">
            <Label htmlFor="magic-email">Or get a sign-in link</Label>
            <Input id="magic-email" name="email" type="email" required />
            <Button type="submit" variant="outline" className="w-full">
              Email me a link
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

async function Messages({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const sp = await searchParams;
  if (sp.error) return <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">Wrong email or password, or this account isn&apos;t an admin.</p>;
  if (sp.sent) return <p className="mt-4 rounded-md bg-success/10 p-3 text-sm" role="status">Check your email for a sign-in link.</p>;
  return null;
}
