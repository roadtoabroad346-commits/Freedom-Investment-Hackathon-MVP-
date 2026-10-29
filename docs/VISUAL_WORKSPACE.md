# MIRROR X: visual investor workspace

This release extends the existing research product. It does not change the contest snapshot, turn undated reference values into current quotes, or execute trades.

## User flows

- `/market`: industry structure, search and industry filtering, largest companies, P/E versus EBITDA/market-cap scatter with explicit editable axis-range filters (default P/E <=100 and absolute EBITDA/cap <=40%, with visible included/eligible counts), median positive P/E, accessible source tables and research links. The underlying source has 127 industry groups rather than 11 broad GICS sectors. Cards and industry chart show the largest 12; the filter/table cover all groups. Block dimensions are indicative; numeric values and the share meter are authoritative. All reference metrics retain **UNDATED** status.
- `/workspace`: import a personal XLSX/CSV → inspect validation/preview → explicitly add without overwriting or replace → interact with history, portfolio and business charts → export or explicitly save to the owner's cloud workspace.
- `Графики`: price line or OHLC candles, volume, SMA20/SMA50, 30/90/365-day/all ranges, brush, normalized comparison on common dates, drawdowns and nonannualized sample volatility. Missing dates are not filled. Candles show at most the last 180 selected observations; the line/export retain the full bounded history. Comparison uses up to the first five sorted tickers and the entire loaded history, rebased on the first common date. Price return excludes dividends/fees; the user's stated adjustment basis remains visible.
- `Портфель`: long positions only, last uploaded close for each ticker, per-position P/L, allocation, industry concentration and full table. Unpriced positions are excluded from valuation totals/weight denominators and counted visibly. Mixed quote dates are explicitly disclosed. Cash balances, closed transactions, FX, taxes and dividends are not performance-accounted.
- `Мой бизнес`: user-supplied period revenue, operating income, operating margin, cash and debt. User must supply comparable period lengths/accounting bases. All amounts are USD; financial periods are not silently converted into dated market quotes.
- Company pages, comparison and valuation now include interactive fundamentals/FCFF/scenario charts. Forecasts remain assumptions.

## Spreadsheet contract

Download the empty template at `/api/spreadsheets/template`. Headers are on the first row. Sheet names are arbitrary; headers identify the data type. Russian header aliases are supported. XLSX and UTF-8 CSV (comma or semicolon) are accepted.

| Type | Columns |
| --- | --- |
| Prices | `ticker,date,open,high,low,close,volume` |
| Positions | `ticker,quantity,averageCost,sector` |
| Financials | `ticker,periodEnd,revenue,operatingIncome,cash,debt,source` |

`date` and `periodEnd` are YYYY-MM-DD or typed Excel dates. Prices require ticker/date/close; open/high/low must be supplied together or omitted. Volume is optional. Business amounts are absolute USD, not USD millions. An explicit non-USD currency column is rejected. Without that column, the user is responsible for supplying USD as declared by the workspace.

Limits: 4 MB compressed/upload bytes; 5,000 price rows, 30 history tickers, 200 positions, 200 financial periods; at most 40 columns and 5,001 rows per worksheet; at most 200 ZIP entries, 12 MB per expanded entry and 24 MB expanded total. Macros/embedded executables/external-link parts are rejected. File bytes are processed in memory and not persisted. Formula/hyperlink objects in required fields are rejected; formulas are never executed. Invalid dates, future data, nonfinite/negative invalid values, bad OHLC and duplicate keys fail the whole import. No partial import occurs. Explicit merges reject duplicates and mismatched quote sources/bases.

POST `/api/spreadsheets/import` uses a bounded raw request, same-site Origin/Host verification and private no-store responses. The browser stages the result until the user applies it. The raw file and its name are not automatically saved to the database.

POST `/api/spreadsheets/export?format=xlsx` creates Guide, Prices, Positions, Financials, Summary and Analytics sheets: frozen headers, filters, number formats, conditional loss formatting, cached P/L formulas, and an editable native Excel chart of the first price series (or first business revenue series if price history is insufficient). CSV exports price rows, quotes cells and guards formula prefixes. Excel export restores through the same importer. GET `/api/spreadsheets/export` creates the separate UNDATED public reference workbook with all instruments, industry aggregates, provenance and a native industry-cap chart. These are independent of the contest FINAL gate.

## Persistence and security

Local data use a versioned, account-scoped localStorage key. Account transitions hide the prior workspace until the new scope is loaded; stale asynchronous import/cloud responses are ignored. Local storage is not encrypted and remains accessible to the device user. Local clearing is reversible during the page session. A failed local write does not report success.

Supabase uses the authorized `mirror_x` schema in Jetuu. This release adds `market_workspaces` (one JSON payload per owner, <=2 MB), RLS, an invoker public view and an invoker compare-and-swap save RPC. The revision prevents stale saves overwriting cloud data. Loading cloud data is staged; applying it is explicit. Delete cloud leaves the local copy intact.

The owner predicate uses auth.uid(), never editable metadata. Request-scoped SSR clients call getUser() before private API access. Personal responses are private/no-store. Publishable keys only; no service-role key is used. Existing Jetuu tables/Auth settings and plan are not modified.

AI quotas use a separate private `ai_usage` table with no client grants and explicit deny policy. A narrow private SECURITY DEFINER function checks auth.uid(), has an empty search_path, and atomically grants at most 10 attempts per user/day UTC. The public wrapper is SECURITY INVOKER. This intentional elevation prevents a client resetting its counter. Failed provider calls consume an attempt. Quotas are not a global provider-spend cap.

## Gemini activation

AI is implemented but intentionally disabled until the owner configures BOTH server-only Vercel variables:

- `GEMINI_API_KEY`: the owner's Google Gemini key; never NEXT_PUBLIC and never committed.
- `GEMINI_MODEL`: an available Google model ID, verified against that key's models endpoint. There is no guessed/hardcoded model ID.

Redeploy after adding the variables. The UI checks `/api/assistant` and displays connection state. Actual provider generation cannot be verified without a key/model; no claim of successful Gemini generation is made in this release.

The assistant requires sign-in, same-origin requests, bounded validated input and a persistent quota. AI SDK 7.0.156 and Google provider 4.0.107 APIs were checked against installed version-matched docs. Each call has no automatic retries, a 45-second timeout and 2,200 output-token limit. User question and optional aggregate context go to Google only on explicit send. With opt-in, context contains up to 20 positions, 10 price-history summaries and 12 financial periods; the source workbook/file name is not sent. AI has no trade/file/database tools and cannot change portfolio records. Output is rendered as plain text. It receives no live feed and is instructed to distinguish facts from assumptions and missing data.

## Verification and limits

Meaningful tests cover known-answer financial calculations, date alignment, missing-price denominators, malformed/formula/macro/oversized imports, cross-request isolation, XLSX/CSV round trips, business statements, duplicate merges, RLS ownership/concurrency and immutable AI quota. Browser tests cover actual upload/preview/apply/candles/portfolio/business/export/reload and mobile/desktop layouts. An independent openpyxl parser verifies native chart relations and formula cells. Remote role verification is reproducible with `scripts/verify-visual-rls.sql` and rolls all fixture changes back.

No paid upgrade, additional Supabase project, brokerage connection, live market feed, automatic statement extraction from arbitrary report layouts, or unrestricted large-file warehouse is introduced. The documented input contract is required. Real-time licensed feed integration and production Gemini generation remain separate from the completed visual/Excel workflows.

Rollback application: redeploy the preceding Vercel deployment. The additive database objects can remain unused, preserving personal records. Do not drop schemas or change Jetuu Auth to roll back UI code.
