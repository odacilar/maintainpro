import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { unsafePrisma } from "@/lib/tenant/prisma";
import type { Role } from "@/lib/tenant/context";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      factoryId: string | null;
      factoryName: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    factoryId: string | null;
    factoryName: string | null;
  }
}

type AppJwt = {
  id: string;
  role: Role;
  factoryId: string | null;
  factoryName: string | null;
};

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/giris",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await unsafePrisma.user.findUnique({
          where: { email },
          include: { factory: { select: { id: true, name: true } } },
        });

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await unsafePrisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          factoryId: user.factoryId,
          factoryName: user.factory?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        const t = token as typeof token & AppJwt;
        t.id = user.id;
        t.role = user.role;
        t.factoryId = user.factoryId;
        t.factoryName = user.factoryName;
      }
      return token;
    },
    session: async ({ session, token }) => {
      const t = token as typeof token & AppJwt;
      session.user.id = t.id;
      session.user.role = t.role;
      session.user.factoryId = t.factoryId;
      session.user.factoryName = t.factoryName;
      return session;
    },
  },
});
