# Финансовое ядро `fcff-drivers-v1`

Revenue_t = Revenue_(t−1)*(1+growth). EBIT_t = Revenue_t*margin. NOPAT_t = EBIT_t*(1-tax). D&A и CapEx — доли выручки. ΔNWC_t = (Revenue_t−Revenue_(t−1))*nwcRate.

FCFF_t = NOPAT_t + D&A_t − CapEx_t − ΔNWC_t.

В году 6 выручка растёт с terminalGrowth, и изменение NWC также использует terminalGrowth. TV = FCFF6/(WACC−g). EV = сумма PV(FCFF1…5)+PV(TV). Equity = EV−netDebt. Fair/share = Equity/dilutedShares.

Все денежные входы USD millions, shares millions. Нулевые shares, неподдерживаемая валюта, g>=WACC, неположительные FCFF и неконечные числа отвергаются. Предполагается отсутствие дополнительных senior claims и неоперационных активов, кроме вычитаемых cash + short-term investments; это ограничение предварительной модели, которое требуется проверить.

Net debt = debt−cash−short-term investments. Долг по балансовой стоимости — приближение к рыночному. Операционная аренда остаётся в расходах, её обязательства отдельно не вычитаются. Для PayPal клиентские средства исключены из cash; долгосрочные инвестиции также не добавляются. Нормализация BNPL и доходов на float не завершена.

Прогнозные growth/margin/tax/D&A/CapEx/NWC/WACC/g — допущения аналитика. Источники risk-free / ERP / beta ещё не загружены, поэтому WACC явно сценарный. Для исторической опоры используются Adobe FY2025, PayPal FY2025 и Nike FY2026; оценки не выдаются за финальную стоимость на 02.11.2026.

Target12m = [EV0*(1+WACC)−FCFF1−netDebt]/shares. FCFF1 считается распределённым, net debt и shares постоянны. Fair value и target различаются. Без датированной цены upside=null. Нет прогнозных buybacks/dividends и гарантии re-rating.

Reverse DCF: бисекция по growth от −45% до +50%, фиксированные прочие входы, до 90 итераций. Если цены нет или цена вне достижимого диапазона — null / N/A. Excel содержит отдельную 60-шаговую бисекцию с проверкой диапазона.

Bear: growth−4 п.п., margin−3 п.п., WACC+1 п.п. Bull: growth+4 п.п., margin+3 п.п., WACC−0,5 п.п. Это сценарии, не вероятностный прогноз. Sensitivity: 5×5 WACC/g, каждый элемент пересчитан.

Allocation: 10000 базисных пунктов, распределение остатков центов методом наибольших остатков. Учебный капитал $100000. Оборот и корреляции не выдумываются.

Technicals: SMA50/SMA200 требуют 50/200 наблюдений; support/resistance — минимум/максимум 60 последних close при >=20 записях. Это техническая функция, не готовый технический анализ без OHLCV.
