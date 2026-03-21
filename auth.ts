import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authenticateAdminCredentials } from "@/lib/admin/auth/service";

class FormIncompleteSigninError extends CredentialsSignin {
  code = "FORM_INCOMPLETE";
}

class InvalidCredentialsSigninError extends CredentialsSignin {
  code = "INVALID_CREDENTIALS";
}

class InactiveAdminSigninError extends CredentialsSignin {
  code = "ADMIN_USER_INACTIVE";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    Credentials({
      name: "Admin Credentials",
      credentials: {
        username: {
          label: "Usuario",
          type: "text",
        },
        password: {
          label: "Contraseña",
          type: "password",
        },
      },
      async authorize(credentials) {
        try {
          const admin = await authenticateAdminCredentials(credentials);

          return {
            id: String(admin.id),
            name: admin.username,
          };
        } catch (error) {
          if (!(error instanceof Error)) {
            throw new InvalidCredentialsSigninError();
          }

          if (error.message === "FORM_INCOMPLETE") {
            throw new FormIncompleteSigninError();
          }

          if (error.message === "ADMIN_USER_INACTIVE") {
            throw new InactiveAdminSigninError();
          }

          throw new InvalidCredentialsSigninError();
        }
      },
    }),
  ],
});
