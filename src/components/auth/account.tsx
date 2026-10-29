"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
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
    [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false),
    [cooldown, setCooldown] = useState(false),
    [recovery, setRecovery] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setRecovery(p.get("recovery") === "1");
    if (p.get("confirmation") === "failed")
      setError(
        "Ссылка недействительна или открыта в другом браузере. Подтвердите почту и войдите либо запросите новое письмо.",
      );
  }, []);
  async function resend() {
    setBusy(true);
    setError("");
    try {
      const { error } = await browserSupabase().auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/auth/callback" },
      });
      if (error) throw error;
      setMessage(
        "Если адрес ожидает подтверждения, новое письмо будет отправлено. Проверьте также папку «Спам».",
      );
      setCooldown(true);
      setTimeout(() => setCooldown(false), 60000);
    } catch {
      setError("Не удалось отправить письмо. Подождите минуту и повторите.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const client = browserSupabase();
      if (recovery && user) {
        const { error } = await client.auth.updateUser({ password });
        if (error)
          throw new Error(
            "Не удалось изменить пароль. Запросите новую ссылку восстановления.",
          );
        setPassword("");
        setRecovery(false);
        setMessage("Пароль обновлён");
        router.replace("/account");
        return;
      }
      if (mode === "reset") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/auth/callback?recovery=1",
        });
        if (error)
          throw new Error(
            "Не удалось отправить письмо восстановления. Повторите позже.",
          );
        setMessage(
          "Если аккаунт существует, придёт письмо со ссылкой для восстановления. Откройте её в этом браузере.",
        );
        return;
      }
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
        router.push("/workspace");
      } else {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth/callback",
          },
        });
        if (error && /email address not authorized|smtp/i.test(error.message))
          throw new Error(
            "Регистрация по почте временно недоступна. Вы можете продолжить работу с Excel и портфелем без аккаунта.",
          );
        if (error)
          throw new Error(
            "Не удалось зарегистрироваться. Проверьте данные или попробуйте позже.",
          );
        setPassword("");
        if (data.session) {
          router.refresh();
          router.push("/workspace");
        }
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
  if (user && recovery)
    return (
      <div className="panel account-panel">
        <h2>Новый пароль</h2>
        <form onSubmit={submit}>
          <label>
            Новый пароль
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button" disabled={busy || password.length < 12}>
            Сохранить новый пароль
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
      </div>
    );
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
        <Link href="/workspace" className="button secondary">
          Мой портфель и Excel
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
        {message && <p role="status">{message}</p>}
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
        Регистрация проходит здесь, в MIRROR X. Аккаунт Vercel не нужен. Без
        входа можно изучать рынок, загружать Excel и работать с локальным
        портфелем.
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
        {mode !== "reset" && (
          <label>
            Пароль
            <input
              required
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "signup" ? 12 : 1}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        {mode !== "reset" && (
          <button
            className="password-toggle"
            type="button"
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
            {showPassword ? "Скрыть пароль" : "Показать пароль"}
          </button>
        )}
        {mode === "signup" && (
          <p className="footnote">
            Используйте уникальный пароль от 12 символов. Для регистрации может
            потребоваться подтверждение почты.
          </p>
        )}
        <button className="button" disabled={busy} type="submit">
          {busy
            ? "Подождите…"
            : mode === "reset"
              ? "Отправить ссылку восстановления"
              : mode === "login"
                ? "Войти и открыть исследования"
                : "Создать аккаунт"}
        </button>
      </form>
      <div className="toolbar">
        <button
          className="password-toggle"
          type="button"
          disabled={busy}
          onClick={() => {
            setMode(mode === "reset" ? "login" : "reset");
            setError("");
            setMessage("");
          }}
        >
          {mode === "reset" ? "Вернуться ко входу" : "Забыли пароль?"}
        </button>
        {mode === "signup" && (
          <button
            className="password-toggle"
            type="button"
            disabled={busy || cooldown || !email.includes("@")}
            onClick={resend}
          >
            Отправить подтверждение повторно
          </button>
        )}
      </div>
      <Link href="/workspace" className="text-link">
        Продолжить без регистрации →
      </Link>
      {(error || connectionError) && (
        <p role="alert" className="warning">
          {error || connectionError}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
