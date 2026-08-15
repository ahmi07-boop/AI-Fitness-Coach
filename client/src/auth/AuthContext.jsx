import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getApiMessage, setAuthSessionClearer } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthSessionClearer(clearSession);
    api.get("/api/auth/me")
      .then(({ data }) => setUser(data.data.user))
      .catch(() => clearSession())
      .finally(() => setLoading(false));

    return () => setAuthSessionClearer(null);
  }, [clearSession]);

  const persistSession = useCallback((nextUser) => {
    setUser(nextUser);
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      persistSession(data.data.user);
      return data.data.user;
    } catch (error) {
      throw new Error(getApiMessage(error, "Unable to sign in."), { cause: error });
    }
  }, [persistSession]);

  const register = useCallback(async ({ name, email, password }) => {
    try {
      const { data } = await api.post("/api/auth/register", { name, email, password });
      if (data.data?.user) {
        persistSession(data.data.user);
        return data.data.user;
      }
      return login(email, password);
    } catch (error) {
      throw new Error(getApiMessage(error, "Unable to create your account."), { cause: error });
    }
  }, [login, persistSession]);

  const updateProfile = useCallback(async (profile, account = {}) => {
    const { data } = await api.patch("/api/auth/me/profile", { profile, ...account });
    const nextUser = data.data.user;
    setUser(nextUser);
    return nextUser;
  }, []);

  const uploadProfilePicture = useCallback(async (file) => {
    const formData = new FormData();
    formData.append("avatar", file);
    const { data } = await api.post("/api/auth/me/avatar", formData);
    const nextUser = data.data.user;
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post("/api/auth/logout"); } finally { clearSession(); }
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, loading, login, register, updateProfile, uploadProfilePicture, logout }),
    [user, loading, login, register, updateProfile, uploadProfilePicture, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
