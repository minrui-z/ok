import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

class TestStatement {
  constructor(database, sql, values = []) { this.database = database; this.sql = sql; this.values = values; }
  bind(...values) { return new TestStatement(this.database, this.sql, values); }
  async first() { return this.database.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return { success: true, results: this.database.prepare(this.sql).all(...this.values), meta: {} }; }
  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, results: [], meta: { changes: Number(result.changes) } };
  }
}

class TestD1 {
  constructor(schema) {
    this.database = new DatabaseSync(":memory:");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec(schema.replaceAll("--> statement-breakpoint", ""));
  }
  prepare(sql) { return new TestStatement(this.database, sql); }
  async batch(statements) {
    this.database.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function pinHash(pin) {
  const salt = Buffer.from("boston-api-tests");
  return `pbkdf2$100000$${salt.toString("base64url")}$${pbkdf2Sync(pin, salt, 100000, 32, "sha256").toString("base64url")}`;
}

test("collaboration API enforces unlock, ownership, limits and poll rules", async (t) => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("api-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const migration = await readFile(new URL("../drizzle/0000_calm_malice.sql", import.meta.url), "utf8");
  const bindings = {
    DB: new TestD1(migration),
    COLLAB_PIN_HASH: pinHash("2468"),
    COLLAB_SIGNING_SECRET: "api-test-signing-secret-with-enough-entropy",
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  globalThis.__COLLAB_TEST_ENV = bindings;
  const context = { waitUntil() {}, passThroughOnException() {} };
  const request = async (path, { method = "GET", body, cookie, ip = "203.0.113.10" } = {}) => {
    const headers = new Headers({ origin: "https://trip.test", "cf-connecting-ip": ip });
    if (body !== undefined) headers.set("content-type", "application/json");
    if (cookie) headers.set("cookie", cookie);
    return worker.fetch(new Request(`https://trip.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), bindings, context);
  };

  await t.test("locked visitors cannot read", async () => {
    assert.equal((await request("/api/collab/notes")).status, 401);
  });

  await t.test("five wrong PINs lock one source", async () => {
    for (let index = 0; index < 4; index += 1) {
      assert.equal((await request("/api/collab/session", { method: "POST", body: { pin: "1111", nickname: "Wrong" }, ip: "203.0.113.20" })).status, 401);
    }
    assert.equal((await request("/api/collab/session", { method: "POST", body: { pin: "1111", nickname: "Wrong" }, ip: "203.0.113.20" })).status, 429);
    assert.equal((await request("/api/collab/session", { method: "POST", body: { pin: "2468", nickname: "Wrong" }, ip: "203.0.113.20" })).status, 429);
  });

  const unlock = await request("/api/collab/session", { method: "POST", body: { pin: "2468", nickname: "Min" } });
  assert.equal(unlock.status, 200);
  const setCookie = unlock.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const ownerCookie = setCookie.split(";")[0];

  let noteId;
  await t.test("notes support CRUD, scopes and length limits", async () => {
    const create = await request("/api/collab/notes", { method: "POST", cookie: ownerCookie, body: { scope: "day", dayId: "sep-04", content: "投影片已備份。" } });
    assert.equal(create.status, 201);
    noteId = (await create.json()).id;
    assert.equal((await request(`/api/collab/notes/${noteId}`, { method: "PATCH", cookie: ownerCookie, body: { content: "投影片與轉接器已備妥。" } })).status, 200);
    assert.equal((await request("/api/collab/notes", { method: "POST", cookie: ownerCookie, body: { scope: "trip", content: "x".repeat(1001) } })).status, 400);
    const list = await (await request("/api/collab/notes", { cookie: ownerCookie })).json();
    assert.equal(list.notes[0].content, "投影片與轉接器已備妥。");
  });

  const secondUnlock = await request("/api/collab/session", { method: "POST", body: { pin: "2468", nickname: "Friend" }, ip: "203.0.113.30" });
  const friendCookie = (secondUnlock.headers.get("set-cookie") ?? "").split(";")[0];
  await t.test("authors control their own notes", async () => {
    assert.equal((await request(`/api/collab/notes/${noteId}`, { method: "DELETE", cookie: friendCookie, body: null, ip: "203.0.113.30" })).status, 403);
  });

  await t.test("single-choice votes can be changed", async () => {
    const create = await request("/api/collab/polls", { method: "POST", cookie: ownerCookie, body: { question: "晚餐吃哪間？", type: "single", scope: "day", dayId: "sep-05", options: ["Krasi", "Atlantic Fish"] } });
    assert.equal(create.status, 201);
    const pollId = (await create.json()).id;
    let list = await (await request("/api/collab/polls", { cookie: ownerCookie })).json();
    const options = list.polls.find((item) => item.id === pollId).options;
    assert.equal((await request(`/api/collab/polls/${pollId}/votes`, { method: "PUT", cookie: ownerCookie, body: { optionIds: [options[0].id] } })).status, 200);
    assert.equal((await request(`/api/collab/polls/${pollId}/votes`, { method: "PUT", cookie: ownerCookie, body: { optionIds: [options[1].id] } })).status, 200);
    list = await (await request("/api/collab/polls", { cookie: ownerCookie })).json();
    assert.deepEqual(list.polls.find((item) => item.id === pollId).myOptionIds, [options[1].id]);
  });

  await t.test("multiple-choice voting, closing and deletion work", async () => {
    const create = await request("/api/collab/polls", { method: "POST", cookie: ownerCookie, body: { question: "雨天想去哪？", type: "multiple", scope: "trip", options: ["BPL", "MFA", "PEM"] } });
    const pollId = (await create.json()).id;
    const list = await (await request("/api/collab/polls", { cookie: ownerCookie })).json();
    const poll = list.polls.find((item) => item.id === pollId);
    assert.equal((await request(`/api/collab/polls/${pollId}/votes`, { method: "PUT", cookie: ownerCookie, body: { optionIds: [poll.options[0].id, poll.options[1].id] } })).status, 200);
    assert.equal((await request(`/api/collab/polls/${pollId}`, { method: "PATCH", cookie: ownerCookie, body: { status: "closed" } })).status, 200);
    assert.equal((await request(`/api/collab/polls/${pollId}/votes`, { method: "PUT", cookie: ownerCookie, body: { optionIds: [poll.options[2].id] } })).status, 409);
    assert.equal((await request(`/api/collab/polls/${pollId}`, { method: "DELETE", cookie: ownerCookie, body: null })).status, 200);
  });
});
