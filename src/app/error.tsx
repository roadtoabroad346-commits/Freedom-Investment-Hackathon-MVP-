"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h1>Не удалось открыть исследование</h1>
      <p>
        Повторите загрузку. Сохранённые в браузере заметки остаются доступны
        после восстановления страницы.
      </p>
      <button className="button" onClick={reset}>
        Попробовать ещё раз
      </button>
    </div>
  );
}
