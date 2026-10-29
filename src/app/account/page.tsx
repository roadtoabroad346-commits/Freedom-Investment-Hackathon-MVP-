import { PageHead } from "@/components/ui";
import { Account } from "@/components/auth/account";
export default function AccountPage() {
  return (
    <>
      <PageHead
        eyebrow="ЛИЧНЫЙ КАБИНЕТ"
        title="Ваши исследования — на ваших устройствах"
        description="Просмотр компаний доступен без входа. Зарегистрируйтесь по логину и паролю — без почты и Vercel. Сохраняйте портфель и исследования между устройствами."
      />
      <Account />
    </>
  );
}
