import { PageHead, Notice, Badge } from "@/components/ui";
import { Watchlist } from "@/components/watch";
export default function Watch() {
  return (
    <>
      <PageHead
        eyebrow="WATCHLIST / RESEARCH"
        title="Мои исследования"
        description="Сохраняйте компании, формулируйте тезис и возвращайтесь к проверке."
        action={<Badge tone="neutral">Локально или в облаке</Badge>}
      />
      <Notice>
        Без входа записи сохраняются в этом браузере. После входа — в личном
        облачном аккаунте Supabase. Перенос локальных заметок выполняется
        отдельной кнопкой; оригиналы не удаляются.
      </Notice>
      <Watchlist />
    </>
  );
}
