# Документация, просмотренная 29.10.2026

- [Next.js App Router installation](https://nextjs.org/docs/app/getting-started/installation): Node>=20.9, Next16, React19, async params/searchParams. Фактически установлен Next16.4.3/React19.3.1 из npm registry.
- [Vercel deployment environments](https://vercel.com/docs/deployments/environments): Preview/Production и особенности первого deployment. Целевой проект проверен до записи. Защита Vercel не отключалась.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): нужны GRANT и RLS; схема-кандидат не применена к чужим приложениям. Попытка прочитать changelog.md не дала содержимого через web tool; изменения Supabase-runtime не внедрялись.
- [React docs](https://react.dev/reference/react): минимальные client boundaries; финансовые вычисления не зависят от React.

Версии dependencies и overrides: package.json/package-lock.json. Реальная совместимость подтверждается typecheck, build, Vitest, Chromium и генерацией/независимым пересчётом файлов, а не только документацией.
