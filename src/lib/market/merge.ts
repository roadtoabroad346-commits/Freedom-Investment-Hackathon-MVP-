import { validateWorkspace, type Workspace } from "./schema";
export function mergeWorkspaces(current: Workspace, incoming: Workspace) {
  if (
    current.bars.length &&
    incoming.bars.length &&
    (current.source !== incoming.source ||
      current.priceBasis !== incoming.priceBasis)
  )
    throw new Error(
      "Для объединения котировок источник и тип корректировки должны совпадать. Используйте одинаковую подпись источника или замените набор.",
    );
  return validateWorkspace({
    ...current,
    source: incoming.bars.length ? incoming.source : current.source,
    priceBasis: incoming.bars.length ? incoming.priceBasis : current.priceBasis,
    bars: [...current.bars, ...incoming.bars],
    positions: [...current.positions, ...incoming.positions],
    financials: [...current.financials, ...incoming.financials],
  });
}
