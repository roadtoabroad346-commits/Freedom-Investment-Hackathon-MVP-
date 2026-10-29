import { PageHead, Notice, Badge } from "@/components/ui";
import { Watchlist } from "@/components/watch";
export default function Watch() {
  return (
    <>
      <PageHead
        eyebrow="WATCHLIST / RESEARCH"
        title="Мои исследования"
        description="Сохраняйте компании, формулируйте тезис и возвращайтесь к проверке."
        action={<Badge tone="neutral">Только в этом браузере</Badge>}
      />
      <Notice>
        Список, заметки и модели хранятся в localStorage. Синхронизация между
        устройствами и командный доступ не подключены. Экспортируйте резервную
        копию перед очисткой браузера.
      </Notice>
      <Watchlist />
    </>
  );
}
