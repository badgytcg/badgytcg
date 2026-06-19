import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  session: { strategy: "database" },
  pages: {
    signIn: "/account",
  },
  callbacks: {
    // Surface isAdmin on the session so the UI can show/hide admin links.
    // The actual security boundary is still isAdminEmail() re-checked in
    // every /api/admin/* route — this is just for navigation, not auth.
    session({ session, user }) {
      session.user.isAdmin = isAdminEmail(user.email);
      return session;
    },
  },
});
