import NextAuth, { type DefaultSession } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: "ADMIN" | "STAFF" } & DefaultSession["user"];
  }
}

const credentials = z.object({ email: z.email(), password: z.string().min(1) });

/**
 * Admin authentication (Auth.js v5). Only users that already exist in the
 * User table with an ADMIN/STAFF role can sign in — magic links never create
 * new accounts. Create admins with `npm run db:seed` or in Prisma Studio.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db as unknown as Parameters<typeof PrismaAdapter>[0]),
  session: { strategy: "jwt", maxAge: 7 * 24 * 3600 },
  pages: { signIn: "/admin/login", verifyRequest: "/admin/login?sent=1", error: "/admin/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentials.safeParse(raw);
        if (!parsed.success) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
        if (!user?.passwordHash) return null;
        if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    ...(process.env.RESEND_API_KEY
      ? [Resend({ apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM ?? "onboarding@resend.dev" })]
      : []),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const existing = await db.user.findUnique({ where: { email: user.email.toLowerCase() } });
      return !!existing && (existing.role === "ADMIN" || existing.role === "STAFF");
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await db.user.findUnique({ where: { email: user.email.toLowerCase() } });
        if (dbUser) {
          token.uid = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      if (token.role === "ADMIN" || token.role === "STAFF") session.user.role = token.role;
      return session;
    },
  },
});
