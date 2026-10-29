import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { universe, annualFacts } from "../src/lib/data";
import { snapshot } from "../src/lib/snapshot";
import { scoreCompany } from "../src/lib/screening";
const quote = (x: unknown) =>
  "'" + JSON.stringify(x).replace(/'/g, "''") + "'::jsonb";
const queries: string[] = [];
for (let i = 0; i < universe.length; i += 25) {
  const rows = universe.slice(i, i + 25).map((c) => ({
    ticker: c.ticker,
    name: c.name,
    sector: c.sector,
    payload: c,
    price: c.price,
    price_asof: c.priceAsOf,
    market_cap: c.marketCap,
    pe: c.pe,
    ebitda: c.ebitda,
    score: scoreCompany(c, universe).score,
    score_details: scoreCompany(c, universe),
  }));
  queries.push(
    `insert into mirror_x.instruments(ticker,name,sector,payload,price,price_asof,market_cap,pe,ebitda,score,score_details) select ticker,name,sector,payload,price,price_asof,market_cap,pe,ebitda,score,score_details from jsonb_to_recordset(${quote(rows)}) as r(ticker text,name text,sector text,payload jsonb,price numeric,price_asof date,market_cap numeric,pe numeric,ebitda numeric,score integer,score_details jsonb) on conflict(ticker) do update set name=excluded.name,sector=excluded.sector,payload=excluded.payload,price=excluded.price,price_asof=excluded.price_asof,market_cap=excluded.market_cap,pe=excluded.pe,ebitda=excluded.ebitda,score=excluded.score,score_details=excluded.score_details,updated_at=now();`,
  );
}
const facts = Object.entries(annualFacts).map(([ticker, payload]) => ({
  ticker,
  payload,
  period_end: payload.periodEnd,
  filed_at: payload.filedAt,
}));
queries.push(
  `insert into mirror_x.annual_facts(ticker,payload,period_end,filed_at) select ticker,payload,period_end,filed_at from jsonb_to_recordset(${quote(facts)}) as r(ticker text,payload jsonb,period_end date,filed_at date) on conflict(ticker) do update set payload=excluded.payload,period_end=excluded.period_end,filed_at=excluded.filed_at;`,
);
queries.push(
  `do $$ begin if exists(select 1 from mirror_x.snapshots where id='${snapshot.id}' and payload<>${quote(snapshot)}) then raise exception 'Snapshot ID conflict: immutable content differs'; end if;end $$;insert into mirror_x.snapshots(id,payload,published) values('${snapshot.id}',${quote(snapshot)},true) on conflict(id) do nothing;`,
);
const path = process.argv[2] ?? "work/mirror-x-seed.json";
await mkdir(dirname(path), { recursive: true });
await writeFile(
  path,
  JSON.stringify({
    queries,
    expectedCount: universe.length,
    snapshotId: snapshot.id,
  }),
);
console.log(
  `Prepared ${queries.length} idempotent seed batches for ${universe.length} companies. No user records affected.`,
);
