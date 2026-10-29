"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { browserSupabase } from "@/lib/supabase/browser";
import { cloudConfigured } from "@/lib/supabase/config";
type State = {
  user: User | null;
  ready: boolean;
  configured: boolean;
  error: string;
  signOut: () => Promise<void>;
};
const AuthContext = createContext<State>({
  user: null,
  ready: false,
  configured: false,
  error: "",
  signOut: async () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const configured = cloudConfigured();
  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    let active = true;
    const client = browserSupabase();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
        setReady(true);
      }
    });
    void client.auth
      .getUser()
      .then(({ data, error }) => {
        if (active) {
          setUser(data.user);
          if (error && error.name !== "AuthSessionMissingError")
            setError(
              "Не удалось проверить вход. Повторите на странице аккаунта.",
            );
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          setError("Сервис авторизации временно недоступен");
          setReady(true);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured]);
  async function signOut() {
    if (!configured) return;
    const { error } = await browserSupabase().auth.signOut();
    if (error) throw new Error("Не удалось выйти");
    setUser(null);
  }
  return (
    <AuthContext.Provider value={{ user, ready, configured, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
