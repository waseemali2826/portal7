import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "@/lib/firebase";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FbUser,
} from "firebase/auth";
import { toast } from "@/hooks/use-toast";
import type { RolePermissions } from "@/pages/roles/types";
import { roles as seedRoles } from "@/pages/roles/data";

const OWNER_EMAIL = "waseem38650@gmail.com";
const LIMITED_EMAIL = "waseemscs105@gmail.com";

type User = { email: string; uid: string } | null;

type AuthContextType = {
  user: User;
  role: string | null; // owner | limited
  appRoleId: string | null; // e.g., role-frontdesk
  perms: RolePermissions | null;
  can: (
    module: keyof RolePermissions,
    action?: "view" | "add" | "edit" | "delete",
  ) => boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User>(null);
  const [role, setRole] = useState<string | null>(null);
  const [appRoleId, setAppRoleId] = useState<string | null>(null);
  const [perms, setPerms] = useState<RolePermissions | null>(null);

  // Keep auth state in sync with Firebase
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fb: FbUser | null) => {
      if (fb?.email) setUser({ email: fb.email, uid: fb.uid });
      else setUser(null);
    });
    return () => unsub();
  }, []);

  // Keep custom claims (role) in sync; refresh when token changes
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, async (fb) => {
      if (!fb) {
        setRole(null);
        setAppRoleId(null);
        setPerms(null);
        return;
      }
      try {
        const tr = await fb.getIdTokenResult(true);
        let r = (tr?.claims?.role as string) || null;
        let rid = (tr?.claims as any)?.appRoleId as string | null;
        if (!r && fb.email) {
          if (fb.email === OWNER_EMAIL) r = "owner";
          else if (fb.email === LIMITED_EMAIL) r = "limited";
        }
        if (!rid && fb.email === LIMITED_EMAIL) rid = "role-frontdesk";
        setRole(r);
        setAppRoleId(rid || null);

        // resolve permissions
        let base = null as RolePermissions | null;
        if (rid) {
          const def = seedRoles.find((x) => x.id === rid);
          if (def) base = def.permissions;
        }
        // server overrides if present
        if (rid) {
          try {
            const resp = await fetch(`/api/role-perms/${rid}`);
            if (resp.ok) {
              const data = await resp.json();
              if (data?.permissions) base = data.permissions as RolePermissions;
            }
          } catch {}
        }
        // local overrides if present
        if (rid) {
          const raw = localStorage.getItem(`rolePerms:${rid}`);
          if (raw) {
            try {
              const ov = JSON.parse(raw);
              if (ov && typeof ov === "object") base = ov;
            } catch {}
          }
        }
        setPerms(base);
      } catch {
        const email = fb.email || null;
        const fallbackRole =
          email === OWNER_EMAIL
            ? "owner"
            : email === LIMITED_EMAIL
              ? "limited"
              : null;
        setRole(fallbackRole);
        const fallbackRid = email === LIMITED_EMAIL ? "role-frontdesk" : null;
        setAppRoleId(fallbackRid);
        if (fallbackRid) {
          const def = seedRoles.find((x) => x.id === fallbackRid);
          setPerms(def ? def.permissions : null);
        } else setPerms(null);
      }
    });
    return () => unsub();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        navigate("/dashboard", { replace: true });
      } catch (err: any) {
        if (err?.code === "auth/user-not-found") {
          try {
            await createUserWithEmailAndPassword(auth, email, password);
            navigate("/dashboard", { replace: true });
            return;
          } catch (e: any) {
            toast({
              title: "Sign up failed",
              description: e?.message ?? "Unable to create account",
            });
            throw e;
          }
        }
        toast({
          title: "Sign in failed",
          description: err?.message ?? "Check your email/password",
        });
        throw err;
      }
    },
    [navigate],
  );

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const can: AuthContextType["can"] = useCallback(
    (module, action = "view") => {
      if (role === "owner") return true;
      if (!perms) return false;
      const p = (perms as any)[module];
      return !!p && !!p[action];
    },
    [role, perms],
  );

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      role,
      appRoleId,
      perms,
      can,
      isAuthenticated: !!user,
      login,
      logout,
    }),
    [user, role, appRoleId, perms, can, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
