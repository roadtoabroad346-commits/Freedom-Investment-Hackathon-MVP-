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
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
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

describe("Visual workspace ownership, concurrency and AI quota", () => {
  it("anonymous cannot read workspace or claim quota", async () => {
    await actor(null);
    await expect(
      db.query("select * from public.mx_market_workspaces"),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query("select public.mx_claim_ai_request()"),
    ).rejects.toThrow("permission denied");
  });
  it("owner saves, restores and updates the payload with compare-and-swap", async () => {
    await actor(A);
    const first = await db.query<{ revision: number }>(
      "select * from public.mx_save_market_workspace('{\"version\":1}',0)",
    );
    expect(first.rows[0].revision).toBe(1);
    await expect(
      db.query("select * from public.mx_save_market_workspace('{}',0)"),
    ).rejects.toThrow("MX_CONFLICT");
    await expect(
      db.query("select * from public.mx_save_market_workspace('{}',5)"),
    ).rejects.toThrow("MX_CONFLICT");
    const next = await db.query<{ revision: number }>(
      'select * from public.mx_save_market_workspace(\'{"version":1,"name":"updated"}\',1)',
    );
    expect(next.rows[0].revision).toBe(2);
  });
  it("another user cannot see, remove or forge ownership", async () => {
    await actor(B);
    expect(
      (await db.query("select * from public.mx_market_workspaces")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from public.mx_market_workspaces where user_id=$1 returning user_id",
          [A],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into mirror_x.market_workspaces(user_id,payload) values($1,'{}')",
        [A],
      ),
    ).rejects.toThrow("row-level security");
  });
  it("AI quota is persistent, owner-scoped and cannot be reset by the client", async () => {
    await actor(A);
    for (let i = 0; i < 10; i++)
      expect(
        (
          await db.query<{ ok: boolean }>(
            "select public.mx_claim_ai_request() as ok",
          )
        ).rows[0].ok,
      ).toBe(true);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select public.mx_claim_ai_request() as ok",
        )
      ).rows[0].ok,
    ).toBe(false);
    await expect(db.exec("delete from mirror_x.ai_usage")).rejects.toThrow(
      "permission denied",
    );
    await actor(B);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select public.mx_claim_ai_request() as ok",
        )
      ).rows[0].ok,
    ).toBe(true);
  });
});

describe("Server-only handle registration and single-use recovery", () => {
  it("anonymous and authenticated clients cannot inspect hashes or initialize identities", async () => {
    for (const id of [null, A]) {
      await actor(id);
      await expect(
        db.exec("select * from mirror_x.handle_accounts"),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query("select public.mx_initialize_handle('forged',$1,$2)", [
          B,
          "a".repeat(64),
        ]),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query("select public.mx_exchange_handle_recovery('someone',$1,$2)", [
          "a".repeat(64),
          "b".repeat(64),
        ]),
      ).rejects.toThrow("permission denied");
      await expect(
        db.query("select public.mx_handle_budget($1)", ["a".repeat(64)]),
      ).rejects.toThrow("permission denied");
    }
  });
  it("backend creates a handle mapping and recovery claims are atomic and single-use", async () => {
    await db.exec("reset role;set role service_role");
    await db.query(
      "select public.mx_initialize_handle('investor_test',$1,$2)",
      [A, "a".repeat(64)],
    );
    expect(
      (
        await db.query<{ id: string | null }>(
          "select public.mx_exchange_handle_recovery('investor_test',$1,$2) as id",
          ["c".repeat(64), "b".repeat(64)],
        )
      ).rows[0].id,
    ).toBeNull();
    expect(
      (
        await db.query<{ id: string }>(
          "select public.mx_exchange_handle_recovery('investor_test',$1,$2) as id",
          ["a".repeat(64), "b".repeat(64)],
        )
      ).rows[0].id,
    ).toBe(A);
    expect(
      (
        await db.query<{ id: string | null }>(
          "select public.mx_exchange_handle_recovery('investor_test',$1,$2) as id",
          ["a".repeat(64), "c".repeat(64)],
        )
      ).rows[0].id,
    ).toBeNull();
  });
  it("authenticated users cannot reset another identity or rotate its key", async () => {
    await actor(B);
    await expect(
      db.query("select public.mx_rotate_handle_recovery($1,$2)", [
        A,
        "c".repeat(64),
      ]),
    ).rejects.toThrow("permission denied");
    await expect(
      db.query(
        "update mirror_x.handle_accounts set recovery_hash=$1 where user_id=$2",
        ["c".repeat(64), A],
      ),
    ).rejects.toThrow("permission denied");
  });
  it("trusted backend rotates the recovery hash without changing ownership", async () => {
    await db.exec("reset role;set role service_role");
    expect(
      (
        await db.query<{ handle: string }>(
          "select public.mx_rotate_handle_recovery($1,$2) as handle",
          [A, "d".repeat(64)],
        )
      ).rows[0].handle,
    ).toBe("investor_test");
    expect(
      (
        await db.query<{ id: string | null }>(
          "select public.mx_exchange_handle_recovery('investor_test',$1,$2) as id",
          ["b".repeat(64), "c".repeat(64)],
        )
      ).rows[0].id,
    ).toBeNull();
  });
  it("backend enforces persistent request budgets and rejects invalid fingerprints", async () => {
    await db.exec("reset role;set role service_role");
    await expect(
      db.query("select public.mx_handle_budget('bad')"),
    ).rejects.toThrow("MX_INVALID_FINGERPRINT");
    for (let i = 0; i < 10; i++)
      expect(
        (
          await db.query<{ ok: boolean }>(
            "select public.mx_handle_budget($1) as ok",
            ["f".repeat(64)],
          )
        ).rows[0].ok,
      ).toBe(true);
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select public.mx_handle_budget($1) as ok",
          ["f".repeat(64)],
        )
      ).rows[0].ok,
    ).toBe(false);
  });
});
