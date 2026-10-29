"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./provider";
import { browserSupabase } from "@/lib/supabase/browser";
export function AccountButton() {
  const { user, ready, configured } = useAuth();
  return (
    <Link href="/account" className="account-link">
      {!configured
        ? "Локальный режим"
        : !ready
          ? "Аккаунт…"
          : user
            ? "Мой аккаунт"
            : "Войти"}
    </Link>
  );
}
export function Account() {
  const {
    user,
    ready,
    configured,
    error: connectionError,
    signOut,
  } = useAuth();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [mode, setMode] = useState<"login" | "signup">("login"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = browserSupabase();
      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error)
          throw new Error(
            "Не удалось войти. Проверьте адрес, пароль и подтверждение почты.",
          );
        setPassword("");
        router.refresh();
        router.push("/watchlist");
      } else {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth/callback",
          },
        });
        if (error)
          throw new Error(
            "Не удалось зарегистрироваться. Проверьте данные или попробуйте позже.",
          );
        setPassword("");
        setMessage(
          data.session
            ? "Аккаунт создан. Исследования можно сохранять в облаке."
            : "Подтвердите адрес по письму Supabase, затем вернитесь на сайт и войдите.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сервис недоступен");
    } finally {
      setBusy(false);
    }
  }
  if (!configured)
    return (
      <div className="notice">
        Облачная авторизация ещё не настроена. Локальные исследования доступны
        без входа.
      </div>
    );
  if (!ready) return <p role="status">Проверяю сессию…</p>;
  if (user)
    return (
      <div className="panel account-panel">
        <h2>Облачный аккаунт</h2>
        <p>{user.email ?? "Пользователь Supabase"}</p>
        <p>
          Заметки, watchlist и сценарии доступны на других устройствах после
          входа. Локальные записи автоматически не удаляются.
        </p>
        <Link href="/watchlist" className="button">
          Мои исследования
        </Link>
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await signOut();
              setMessage("Вы вышли из аккаунта");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Не удалось выйти");
            } finally {
              setBusy(false);
            }
          }}
        >
          Выйти
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    );
  return (
    <div className="panel account-panel">
      <div className="account-tabs">
        <button
          className={`button ${mode === "login" ? "" : "secondary"}`}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          Вход
        </button>
        <button
          className={`button ${mode === "signup" ? "" : "secondary"}`}
          onClick={() => {
            setMode("signup");
            setError("");
          }}
        >
          Создать аккаунт
        </button>
      </div>
      <p className="footnote">
        В бесплатной конфигурации используется общая служба Supabase Auth с
        Jetuu. Можно войти существующим аккаунтом. Настройки подтверждения почты
        сохраняются.
      </p>
      <form onSubmit={submit}>
        <label>
          Электронная почта
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
          />
        </label>
        <label>
          Пароль
          <input
            required
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={mode === "signup" ? 12 : 8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {mode === "signup" && (
          <p className="footnote">
            Используйте уникальный пароль от 12 символов. Для регистрации может
            потребоваться подтверждение почты.
          </p>
        )}
        <button className="button" disabled={busy} type="submit">
          {busy
            ? "Подождите…"
            : mode === "login"
              ? "Войти и открыть исследования"
              : "Создать аккаунт"}
        </button>
      </form>
      {(error || connectionError) && (
        <p role="alert" className="warning">
          {error || connectionError}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
