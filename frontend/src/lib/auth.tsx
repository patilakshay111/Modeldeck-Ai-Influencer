/**
 * Session state.
 *
 * The token lives in `localStorage`; the user record lives in memory and is
 * refreshed from `/api/auth/me` on boot.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  readToken,
  setUnauthorizedHandler,
  writeToken,
  type PublicUser,
} from "./api";

interface AuthValue {
  user: PublicUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
  attestAge: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!readToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: current } = await api.me();
      setUser(current);
    } catch {
      writeToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { token, user: current } = await api.login(email, password);
    writeToken(token);
    setUser(current);
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      const { token, user: current } = await api.register(email, password, name);
      writeToken(token);
      setUser(current);
    },
    [],
  );

  const signOut = useCallback(() => {
    writeToken(null);
    setUser(null);
  }, []);

  const attestAge = useCallback(async () => {
    const { user: current } = await api.attestAge();
    setUser(current);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, loading, signIn, signUp, signOut, refresh, attestAge }),
    [user, loading, signIn, signUp, signOut, refresh, attestAge],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
};
