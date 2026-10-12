import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "lead" | "manager" | "associate";
  reportsToId: string | null;
  emailVerifiedAt?: string | null;
  approvedAt?: string | null;
};

export type SignupResult = {
  email: string;
  verificationRequired: boolean;
};

export type VerifyEmailResult = {
  user: User;
  approved: boolean;
  message?: string;
};

export type ResendResult = {
  ok: boolean;
  message?: string;
};

type AuthContextType = {
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
  verifyEmail: (email: string, code: string) => Promise<VerifyEmailResult>;
  resendVerification: (email: string) => Promise<ResendResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthContextType | null>(null);

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
        signup: async (input) => {
          // Self-registration returns verificationRequired and does not issue a session
          const res = await api<SignupResult>("/api/auth/register", {
            method: "POST",
            body: JSON.stringify(input),
          });
          return res;
        },
        verifyEmail: async (email, code) => {
          const res = await api<VerifyEmailResult>("/api/auth/verify-email", {
            method: "POST",
            body: JSON.stringify({ email, code }),
          });
          if (res.approved && res.user) {
            setUser(res.user);
          }
          return res;
        },
        resendVerification: async (email) => {
          return await api<ResendResult>("/api/auth/resend-verification", {
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
  if (!v) throw new Error("useAuth must be used within an AuthProvider");
  return v;
}
