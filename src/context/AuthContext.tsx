import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "student" | "owner" | null;

export interface AuthUser {
  phone: string;
  studentId?: string;
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  role: Role;
  isLoading: boolean;
  login: (user: AuthUser, role: Exclude<Role, null>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "kaaizens.auth";

interface StoredAuth {
  user: AuthUser;
  role: Exclude<Role, null>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as StoredAuth;
        setUser(parsed.user);
        setRole(parsed.role);
      }
    } catch {
      // ignore
    }
    setIsLoading(false);
  }, []);

  const login: AuthContextValue["login"] = (nextUser, nextRole) => {
    setUser(nextUser);
    setRole(nextRole);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: nextUser, role: nextRole }));
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, role, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
