import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "student" | "owner" | null;

export interface AuthUser {
  id: string;
  phone: string;
  studentId?: string;
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  role: Role;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadRoleAndProfile(session: Session): Promise<{
  role: Role;
  studentId?: string;
  name?: string;
}> {
  const userId = session.user.id;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const isOwner = (roles ?? []).some((r) => r.role === "owner");
  if (isOwner) return { role: "owner" };

  const { data: student } = await supabase
    .from("students")
    .select("id,name")
    .eq("user_id", userId)
    .maybeSingle();

  return { role: "student", studentId: student?.id, name: student?.name ?? undefined };
}

function toUser(user: User, extra: { studentId?: string; name?: string }): AuthUser {
  const phone = user.phone ? (user.phone.startsWith("+") ? user.phone : `+${user.phone}`) : "";
  return { id: user.id, phone, studentId: extra.studentId, name: extra.name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrate = async (session: Session | null) => {
    if (!session) {
      setUser(null);
      setRole(null);
      return;
    }
    try {
      const { role: r, studentId, name } = await loadRoleAndProfile(session);
      setRole(r);
      setUser(toUser(session.user, { studentId, name }));
    } catch (e) {
      console.error("auth hydrate failed", e);
      setUser(toUser(session.user, {}));
      setRole(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Don't block the callback with async work
      void (async () => {
        if (!mounted) return;
        await hydrate(session);
        setIsLoading(false);
      })();
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      await hydrate(data.session);
      setIsLoading(false);
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refresh = async () => {
    const { data } = await supabase.auth.getSession();
    await hydrate(data.session);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, isLoading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
