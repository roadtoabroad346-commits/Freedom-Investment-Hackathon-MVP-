"use client";
import { useState } from "react";
import { PageHead, Notice } from "@/components/ui";
export default function Teams() {
  const [text, setText] = useState(""),
    [saved, setSaved] = useState(false);
  function download() {
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob(
          [
            `MIRROR X — запрос пилота\n${text}\n\nКонтакт команды продукта должен добавить владелец проекта.`,
          ],
          { type: "text/plain;charset=utf-8" },
        ),
      );
    a.href = url;
    a.download = "MIRROR_X_pilot_request.txt";
    a.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  }
  return (
    <>
      <PageHead
        eyebrow="FOR TEAMS / PILOT"
        title="Меньше поиска. Больше проверки."
        description="Для инвестиционных клубов, самостоятельных исследователей и небольших аналитических команд."
      />
      <div className="prose">
        <p>
          Гипотеза ценности: сократить время первичного отбора и сделать
          проверку расчётов воспроизводимой. Подтверждённых клиентов, выручки и
          измеренной экономии времени пока нет.
        </p>
        <Notice>
          Форма готовит локальный файл заявки. Сервис отправки и контакт
          владельца не подключены: мы не делаем вид, что заявка уже отправлена.
        </Notice>
        <div className="panel">
          <label>
            Что ваша команда хочет проверить?
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={6000}
              placeholder="Размер команды, текущий процесс, главный источник потерь времени…"
            />
          </label>
          <button className="button" disabled={!text.trim()} onClick={download}>
            Подготовить запрос пилота
          </button>
          {saved && (
            <p role="status">
              Файл подготовлен для скачивания. Отправьте его владельцу проекта
              по согласованному каналу.
            </p>
          )}
        </div>
        <h2>Как оценить пилот</h2>
        <ol>
          <li>
            Выбрать одинаковый набор компаний для ручного и платформенного
            анализа.
          </li>
          <li>Сравнить время отбора, число ошибок и качество ссылок.</li>
          <li>
            Проверить готовность команды пользоваться продуктом повторно и
            платить за него.
          </li>
        </ol>
      </div>
    </>
  );
}
