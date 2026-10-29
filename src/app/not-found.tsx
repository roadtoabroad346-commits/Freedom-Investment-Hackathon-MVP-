import { Empty } from "@/components/ui";
export default function NotFound() {
  return (
    <Empty title="Компания или страница не найдена">
      Проверьте тикер в общем Explorer. Неподдерживаемой компании не
      подставляется фиктивное исследование.
    </Empty>
  );
}
