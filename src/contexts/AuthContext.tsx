import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { apiJson } from "@/lib/api";
import type { UserRole } from "@/types/firestore";

export interface AuthUser {
  id: string;
  email: string | null;
  fullName?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: { user: AuthUser } | null;
  loading: boolean;
  roleLoading: boolean;
  userRole: UserRole | null;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<{ user: AuthUser } | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  const refreshMe = useCallback(async () => {
    setRoleLoading(true);
    try {
      const data = await apiJson<{ user: { id: string; email: string; role: UserRole; fullName?: string | null } | null }>(
        "/api/auth/me"
      );
      if (!data.user) {
        setUser(null);
        setSession(null);
        setUserRole(null);
        return;
      }
      const u: AuthUser = {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName ?? null,
      };
      setUser(u);
      setSession({ user: u });
      setUserRole(data.user.role);
    } catch {
      setUser(null);
      setSession(null);
      setUserRole(null);
    } finally {
      setRoleLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshMe();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      await apiJson("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, fullName }),
      });
      await refreshMe();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await apiJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refreshMe();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signOut = async () => {
    await apiJson("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    setUser(null);
    setSession(null);
    setUserRole(null);
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    roleLoading,
    userRole,
    signUp,
    signIn,
    signOut,
    isAdmin: userRole === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
