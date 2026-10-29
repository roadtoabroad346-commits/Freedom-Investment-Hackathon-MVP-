import { PageHead } from "@/components/ui";
import { Account } from "@/components/auth/account";
export default function AccountPage() {
  return (
    <>
      <PageHead
        eyebrow="ЛИЧНЫЙ КАБИНЕТ"
        title="Ваши исследования — на ваших устройствах"
        description="Просмотр компаний доступен без входа. Аккаунт MIRROR X нужен для сохранения между устройствами. Регистрация в Vercel не требуется."
      />
      <Account />
    </>
  );
}
