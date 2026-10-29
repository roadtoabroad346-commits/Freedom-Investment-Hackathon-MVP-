export function normalizeHandle(value: unknown): string {
  if (typeof value !== "string") throw new Error("Укажите логин");
  const handle = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,29}$/.test(handle))
    throw new Error(
      "Логин: 3–30 латинских букв, цифр или _, первая буква — латинская",
    );
  return handle;
}
export function handleEmail(value: unknown) {
  return `mirrorx-handle-${normalizeHandle(value)}@accounts.invalid`;
}
export function handleFromEmail(email?: string | null) {
  const m = email?.match(
    /^mirrorx-handle-([a-z][a-z0-9_]{2,29})@accounts\.invalid$/,
  );
  return m?.[1] ?? null;
}
export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}
export function validRecovery(value: unknown): value is string {
  return typeof value === "string" && /^mxr_[a-f0-9]{64}$/.test(value);
}
