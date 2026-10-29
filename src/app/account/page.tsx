import { PageHead } from "@/components/ui";
import { Account } from "@/components/auth/account";
export default function AccountPage() {
  return (
    <>
      <PageHead
        eyebrow="ACCOUNT / SUPABASE AUTH"
        title="Ваши исследования — на ваших устройствах"
        description="Просмотр компаний доступен без входа. Аккаунт нужен для личных облачных заметок и моделей."
      />
      <Account />
    </>
  );
}
