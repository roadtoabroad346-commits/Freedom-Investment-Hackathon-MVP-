import type { Metadata } from "next";
import { PageHead, ButtonLink } from "@/components/ui";
import { InvestorWorkspace } from "@/components/market/workspace";
export const metadata: Metadata = { title: "Графики и портфель" };
export default function Workspace() {
  return (
    <>
      <PageHead
        eyebrow="INVESTOR WORKSPACE"
        title="Данные, которые можно увидеть"
        description="Личные графики, портфель и Excel в одном рабочем пространстве. Для инвесторов, аналитиков и владельцев бизнеса."
        action={
          <ButtonLink href="/market" secondary>
            Обзор рынка
          </ButtonLink>
        }
      />
      <InvestorWorkspace />
    </>
  );
}
