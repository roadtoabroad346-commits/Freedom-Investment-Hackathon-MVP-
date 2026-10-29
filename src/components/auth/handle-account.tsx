"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Download, Copy, KeyRound } from "lucide-react";
import { useAuth } from "./provider";
import { browserSupabase } from "@/lib/supabase/browser";
import {
  normalizeHandle,
  handleEmail,
  validPassword,
  validRecovery,
} from "@/lib/handle-auth";
async function accountRequest(body: Record<string, unknown>) {
  const r = await fetch("/api/handle-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Не удалось выполнить запрос");
  return j as { handle: string; recoveryCode: string };
}
function RecoveryCard({
  handle,
  code,
  onDone,
  doneLabel,
}: {
  handle: string;
  code: string;
  onDone: () => void;
  doneLabel: string;
}) {
  const [saved, setSaved] = useState(false),
    [message, setMessage] = useState("");
  function download() {
    const url = URL.createObjectURL(
      new Blob(
        [
          `MIRROR X — резервный ключ\nЛогин: ${handle}\nКлюч: ${code}\nХраните отдельно от пароля. Ключ позволяет сменить пароль и становится недействительным после использования.\nВход: https://mirror-x-three.vercel.app/account\n`,
        ],
        { type: "text/plain;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `MIRROR_X_${handle}_recovery.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return (
    <section className="panel recovery-card">
      <KeyRound size={25} aria-hidden="true" />
      <h2>Сохраните резервный ключ</h2>
      <p>
        Логин: <b>{handle}</b>. Этот ключ показывается один раз и заменяет
        восстановление по почте. Кто знает ключ, сможет изменить ваш пароль.
      </p>
      <code className="recovery-code">{code}</code>
      <div className="toolbar">
        <button className="button secondary" onClick={download}>
          <Download size={16} aria-hidden="true" />
          Скачать ключ
        </button>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setMessage("Ключ скопирован");
            } catch {
              setMessage(
                "Не удалось скопировать. Скачайте файл или скопируйте текст вручную.",
              );
            }
          }}
        >
          <Copy size={16} aria-hidden="true" />
          Скопировать
        </button>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={saved}
          onChange={(e) => setSaved(e.target.checked)}
        />
        Я сохранил ключ в надёжном месте
      </label>
      <button className="button" disabled={!saved} onClick={onDone}>
        {doneLabel}
      </button>
      {message && <p role="status">{message}</p>}
      <small>
        Без пароля, действующей сессии и резервного ключа восстановить доступ не
        получится. Старый резервный ключ перестаёт действовать после замены.
      </small>
    </section>
  );
}
export function HandleAccount() {
  const router = useRouter(),
    { configured, ready } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | "recover">(
      "register",
    ),
    [handle, setHandle] = useState(""),
    [password, setPassword] = useState(""),
    [recovery, setRecovery] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [created, setCreated] = useState<{
      handle: string;
      recoveryCode: string;
    } | null>(null);
  async function login() {
    const { error } = await browserSupabase().auth.signInWithPassword({
      email: handleEmail(handle),
      password,
    });
    if (error)
      throw new Error(
        "Логин или пароль не подошёл. Проверьте их или используйте резервный ключ.",
      );
    setPassword("");
    setRecovery("");
    setCreated(null);
    router.refresh();
    router.push("/workspace");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const normalized = normalizeHandle(handle);
      if (mode === "login") {
        await login();
        return;
      }
      if (!validPassword(password))
        throw new Error("Пароль должен содержать 12–128 символов");
      if (mode === "recover" && !validRecovery(recovery.trim()))
        throw new Error("Введите резервный ключ полностью, начиная с mxr_");
      const result = await accountRequest({
        action: mode,
        handle: normalized,
        password,
        ...(mode === "recover" ? { recoveryCode: recovery.trim() } : {}),
      });
      setHandle(result.handle);
      setRecovery("");
      setCreated(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Сервис временно недоступен");
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p role="status">Проверяю сессию…</p>;
  if (created)
    return (
      <>
        <RecoveryCard
          handle={created.handle}
          code={created.recoveryCode}
          doneLabel={busy ? "Вхожу…" : "Ключ сохранён — войти"}
          onDone={() => {
            if (busy) return;
            setBusy(true);
            setError("");
            void login()
              .catch((e) => setError(e.message))
              .finally(() => setBusy(false));
          }}
        />
        {error && <p role="alert">{error}</p>}
      </>
    );
  return (
    <section className="panel account-panel">
      <div className="account-tabs">
        {[
          ["register", "Создать аккаунт"],
          ["login", "Войти"],
          ["recover", "Восстановить доступ"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`button ${mode === id ? "" : "secondary"}`}
            aria-pressed={mode === id}
            disabled={busy}
            onClick={() => {
              setMode(id as typeof mode);
              setError("");
              setPassword("");
              setRecovery("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <h2>
        {mode === "register"
          ? "Личный аккаунт без почты"
          : mode === "recover"
            ? "Восстановление резервным ключом"
            : "С возвращением"}
      </h2>
      <p>
        Только логин и пароль. Без писем, номера телефона и регистрации Vercel.
        После входа ваши исследования и портфель доступны на других устройствах.
      </p>
      <form onSubmit={submit}>
        <label>
          Логин
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z][a-zA-Z0-9_]{2,29}"
            placeholder="Например, investor_2026"
          />
        </label>
        <small>
          3–30 латинских букв, цифр или _. Регистр не важен; логин начинается с
          буквы.
        </small>
        {mode === "recover" && (
          <label>
            Резервный ключ
            <input
              type="password"
              value={recovery}
              onChange={(e) => setRecovery(e.target.value)}
              autoComplete="off"
              required
              maxLength={68}
              placeholder="mxr_…"
            />
          </label>
        )}
        <label>
          {mode === "recover" ? "Новый пароль" : "Пароль"}
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={mode === "login" ? 1 : 12}
            maxLength={128}
            required
          />
        </label>
        <button
          className="password-toggle"
          type="button"
          aria-pressed={show}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
          {show ? "Скрыть пароль" : "Показать пароль"}
        </button>
        {mode !== "login" && (
          <small>
            Не менее 12 символов. При{" "}
            {mode === "recover" ? "восстановлении" : "регистрации"} получите{" "}
            {mode === "recover" ? "новый " : ""}резервный ключ — сохраните его
            отдельно от пароля.
          </small>
        )}
        <button className="button" disabled={busy || !configured}>
          {busy
            ? "Подождите…"
            : mode === "register"
              ? "Зарегистрироваться"
              : mode === "recover"
                ? "Обновить пароль"
                : "Войти в рабочее пространство"}
        </button>
      </form>
      {!configured && (
        <p>
          Облачная регистрация недоступна в локальном режиме. Загрузки Excel и
          локальные графики доступны без входа.
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
export function HandleRecovery() {
  const [result, setResult] = useState<{
      handle: string;
      recoveryCode: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      {result ? (
        <RecoveryCard
          handle={result.handle}
          code={result.recoveryCode}
          doneLabel="Ключ сохранён"
          onDone={() => setResult(null)}
        />
      ) : (
        <section className="panel account-panel">
          <h2>Резервный ключ восстановления</h2>
          <p>
            Если прежний ключ потерян или раскрыт, создайте новый. Предыдущий
            сразу перестанет действовать.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                setResult(await accountRequest({ action: "rotate" }));
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Не удалось заменить ключ",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Заменить резервный ключ
          </button>
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </>
  );
}
