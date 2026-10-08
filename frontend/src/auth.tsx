import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "lead" | "manager" | "associate";
  reportsToId: string | null;
  deactivatedAt?: string | null;
  emailVerifiedAt: string | null;
};

type SignupResult = {
  email: string;
  verificationRequired: boolean;
};

const Ctx = createContext<{
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    name: string;
    email: string;
    password: string;
    role: "lead" | "manager" | "associate";
    turnstileToken?: string;
  }) => Promise<SignupResult>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await api<User>("/api/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
        refresh,
        login: async (email, password) => {
          const me = await api<User>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
          setUser(me);
        },
        signup: async (input) =>
          api<SignupResult>("/api/auth/register", {
            method: "POST",
            body: JSON.stringify(input),
          }),
        verifyEmail: async (email, code) => {
          const me = await api<User>("/api/auth/verify-email", {
            method: "POST",
            body: JSON.stringify({ email, code }),
          });
          setUser(me);
        },
        resendVerification: async (email) => {
          await api("/api/auth/resend-verification", {
            method: "POST",
            body: JSON.stringify({ email }),
          });
        },
        logout: async () => {
          await api("/api/auth/logout", { method: "POST" });
          setUser(null);
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("auth");
  return v;
}
