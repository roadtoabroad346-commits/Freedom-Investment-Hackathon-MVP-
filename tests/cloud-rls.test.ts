import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFile, readdir } from "node:fs/promises";
const A = "00000000-0000-4000-a000-000000000001",
  B = "00000000-0000-4000-a000-000000000002";
let db: PGlite;
async function actor(id: string | null) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id ?? "",
  ]);
  await db.exec(id ? "set role authenticated" : "set role anon");
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  await db.query("insert into auth.users(id) values($1),($2)", [A, B]);
  await db.exec(
    `insert into mirror_x.instruments(ticker,name,sector,payload,score_details) values('TESTA','Test A','Software','{}','{}'),('TESTB','Test B','Software','{}','{}');insert into mirror_x.snapshots(id,payload,published) values('public','{"id":"public"}',true),('private','{"id":"private"}',false);`,
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("Real PostgreSQL RLS and atomic migration", () => {
  it("anonymous reads reference data and only published snapshots", async () => {
    await actor(null);
    expect(
      (await db.query("select ticker from public.mx_instruments")).rows,
    ).toHaveLength(2);
    expect((await db.query("select id from public.mx_snapshots")).rows).toEqual(
      [{ id: "public" }],
    );
  });
  it("anonymous cannot read private research or call write RPC", async () => {
    await actor(null);
    await expect(db.query("select * from public.mx_research")).rejects.toThrow(
      "permission denied",
    );
    await expect(
      db.query("select * from public.mx_write_research('TESTA','watch')"),
    ).rejects.toThrow("permission denied");
  });
  it("owner creates a watch item, note and model without losing previous fields", async () => {
    await actor(A);
    await db.query("select * from public.mx_write_research('TESTA','watch')");
    await db.query(
      "select * from public.mx_write_research('TESTA','note','Owner note')",
    );
    await db.query(
      "select * from public.mx_write_research('TESTA','valuation',null,'{\"currency\":\"USD\"}')",
    );
    const row = (
      await db.query<{
        note: string;
        assumptions: { currency: string };
        revision: number;
      }>("select note,assumptions,revision from public.mx_research")
    ).rows[0];
    expect(row.note).toBe("Owner note");
    expect(row.assumptions.currency).toBe("USD");
    expect(row.revision).toBe(3);
  });
  it("user B cannot read or update user A research", async () => {
    await actor(B);
    expect(
      (await db.query("select * from public.mx_research")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update mirror_x.research set note='forged' where user_id=$1 returning id",
          [A],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from public.mx_research where user_id=$1 returning id",
          [A],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("ownership cannot be forged on insert", async () => {
    await actor(B);
    await expect(
      db.query(
        "insert into mirror_x.research(user_id,ticker,note) values($1,'TESTA','forged')",
        [A],
      ),
    ).rejects.toThrow("row-level security");
  });
  it("owner cannot reassign ownership through UPDATE", async () => {
    await actor(A);
    await expect(
      db.query("update mirror_x.research set user_id=$1 where ticker='TESTA'", [
        B,
      ]),
    ).rejects.toThrow("row-level security");
  });
  it("atomic import does not overwrite existing cloud notes or model", async () => {
    await actor(A);
    await db.query(
      "select * from public.mx_write_research('TESTA','import','old local note','{\"currency\":\"EUR\"}')",
    );
    expect(
      (await db.query<{ note: string }>("select note from public.mx_research"))
        .rows[0].note,
    ).toBe("Owner note");
  });
  it("new import is atomic and retry is idempotent", async () => {
    await actor(B);
    await db.query(
      "select * from public.mx_write_research('TESTB','import','Local note','{\"currency\":\"USD\"}')",
    );
    await db.query(
      "select * from public.mx_write_research('TESTB','import','different','{}')",
    );
    const rows = (
      await db.query<{
        note: string;
        revision: number;
        assumptions: { currency: string };
      }>("select note,revision,assumptions from public.mx_research")
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      note: "Local note",
      revision: 1,
      assumptions: { currency: "USD" },
    });
  });
  it("database bounds reject oversized notes", async () => {
    await actor(B);
    await expect(
      db.query("select * from public.mx_write_research('TESTB','note',$1)", [
        "x".repeat(6001),
      ]),
    ).rejects.toThrow("check constraint");
  });
  it("per-user database limiter rejects writes after 120 requests per minute", async () => {
    await actor(A);
    await db.exec("update mirror_x.write_buckets set hits=120");
    await expect(
      db.query("select * from public.mx_write_research('TESTA','watch')"),
    ).rejects.toThrow("MX_RATE_LIMIT");
    await db.exec("update mirror_x.write_buckets set hits=1");
  });
  it("public views use invoker privileges and functions are not security definer", async () => {
    await db.exec("reset role");
    const rows = await db.query<{ reloptions: string[] }>(
      "select reloptions from pg_class where relname in ('mx_research','mx_snapshots')",
    );
    expect(
      rows.rows.every((r) => r.reloptions.includes("security_invoker=true")),
    ).toBe(true);
    expect(
      (
        await db.query<{ prosecdef: boolean }>(
          "select prosecdef from pg_proc where proname='mx_write_research'",
        )
      ).rows[0].prosecdef,
    ).toBe(false);
  });
  it("own deletion succeeds and does not delete another owner", async () => {
    await actor(A);
    await db.query("delete from public.mx_research where ticker='TESTA'");
    expect(
      (await db.query("select * from public.mx_research")).rows,
    ).toHaveLength(0);
    await actor(B);
    expect(
      (await db.query("select * from public.mx_research")).rows,
    ).toHaveLength(1);
  });
});
