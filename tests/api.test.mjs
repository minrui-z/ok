import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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
  const migrationDirectory = fileURLToPath(new URL("../drizzle/", import.meta.url));
  const migrationFiles = (await readdir(migrationDirectory)).filter((file) => /^\d+.*\.sql$/.test(file)).sort();
  const migration = (await Promise.all(migrationFiles.map((file) => readFile(new URL(`../drizzle/${file}`, import.meta.url), "utf8")))).join("\n");
  const bindings = {
    DB: new TestD1(migration),
    COLLAB_PIN_HASH: pinHash("2468"),
    COLLAB_SIGNING_SECRET: "api-test-signing-secret-with-enough-entropy",
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
  globalThis.__COLLAB_TEST_ENV = bindings;
  const context = { waitUntil() {}, passThroughOnException() {} };
  const request = async (path, { method = "GET", body, cookie, ip = "203.0.113.10", origin = "https://trip.test" } = {}) => {
    const headers = new Headers({ "cf-connecting-ip": ip });
    if (origin) headers.set("origin", origin);
    if (body !== undefined) headers.set("content-type", "application/json");
    if (cookie) headers.set("cookie", cookie);
    return worker.fetch(new Request(`https://trip.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), bindings, context);
  };

  await t.test("locked visitors cannot read", async () => {
    assert.equal((await request("/api/collab/notes")).status, 401);
  });

  let itineraryVersion = 1;
  await t.test("the latest itinerary is public but its history and writes are locked", async () => {
    const response = await request("/api/itinerary");
    assert.equal(response.status, 200);
    const itinerary = await response.json();
    assert.equal(itinerary.version, 1);
    assert.equal(itinerary.schemaVersion, 1);
    assert.ok(itinerary.days.length >= 10);
    assert.equal("authorId" in itinerary, false);
    assert.equal("authorName" in itinerary, false);
    assert.equal((await request("/api/collab/itinerary/history")).status, 401);
    assert.equal((await request("/api/collab/itinerary", {
      method: "PATCH",
      body: { baseVersion: 1, operation: { type: "day.update", dayId: "sep-03", changes: { title: "不可修改" } } },
    })).status, 401);
  });

  await t.test("unsupported PBKDF2 iteration counts fail closed", async () => {
    const supportedHash = bindings.COLLAB_PIN_HASH;
    bindings.COLLAB_PIN_HASH = supportedHash.replace("pbkdf2$100000$", "pbkdf2$210000$");
    assert.equal((await request("/api/collab/session", { method: "POST", body: { pin: "2468", nickname: "Min" }, ip: "203.0.113.11" })).status, 401);
    bindings.COLLAB_PIN_HASH = supportedHash;
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

  let sharedActivityId;
  await t.test("itinerary operations reject caller-supplied IDs and unsupported photo sources", async () => {
    const invalid = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: ownerCookie,
      body: {
        baseVersion: itineraryVersion,
        operation: {
          type: "activity.create",
          dayId: "sep-02",
          activity: {
            id: "caller-controlled",
            timeLabel: "20:30",
            timezone: "America/New_York",
            title: "無效活動",
            detail: "呼叫端不可指定 ID。",
            icon: "food",
            category: "food",
            priority: "optional",
            durationMin: 30,
            photo: { src: "https://example.com/photo.jpg", alt: "photo", credit: "credit", source: "https://example.com/" },
          },
        },
      },
    });
    assert.equal(invalid.status, 400);
    const invalidPhoto = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: ownerCookie,
      body: {
        baseVersion: itineraryVersion,
        operation: {
          type: "activity.create",
          dayId: "sep-02",
          activity: {
            timeLabel: "20:30",
            timezone: "America/New_York",
            title: "無效照片",
            detail: "目前不支援外部照片。",
            icon: "food",
            category: "food",
            priority: "optional",
            durationMin: 30,
            photo: { src: "https://example.com/photo.jpg", alt: "photo", credit: "credit", source: "https://example.com/" },
          },
        },
      },
    });
    assert.equal(invalidPhoto.status, 400);
    assert.equal((await (await request("/api/itinerary")).json()).version, itineraryVersion);
  });

  await t.test("all unlocked travelers can create, edit, move and update itinerary days", async () => {
    const create = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: ownerCookie,
      body: {
        baseVersion: itineraryVersion,
        operation: {
          type: "activity.create",
          dayId: "sep-02",
          activity: {
            timeLabel: "20:30",
            start: "2026-09-02T20:30:00-04:00",
            timezone: "America/New_York",
            title: "同行者晚餐",
            detail: "測試共同編輯的新增活動。",
            icon: "food",
            category: "food",
            priority: "optional",
            durationMin: 60,
            coordinates: [42.35, -71.08],
            place: "Back Bay",
          },
        },
      },
    });
    assert.equal(create.status, 200);
    let data = await create.json();
    itineraryVersion = data.version;
    sharedActivityId = data.change.targetId;
    assert.equal(itineraryVersion, 2);
    assert.match(sharedActivityId, /^[0-9a-f-]{36}$/);

    const update = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: friendCookie,
      ip: "203.0.113.30",
      body: {
        baseVersion: itineraryVersion,
        operation: { type: "activity.update", activityId: sharedActivityId, changes: { title: "一起吃晚餐", durationMin: 75 } },
      },
    });
    assert.equal(update.status, 200);
    data = await update.json();
    itineraryVersion = data.version;
    assert.equal(itineraryVersion, 3);
    assert.equal(data.days.flatMap((day) => day.activities).find((activity) => activity.id === sharedActivityId).title, "一起吃晚餐");

    const move = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: ownerCookie,
      body: {
        baseVersion: itineraryVersion,
        operation: { type: "activity.move", activityId: sharedActivityId, toDayId: "sep-03", toIndex: 0 },
      },
    });
    assert.equal(move.status, 200);
    data = await move.json();
    itineraryVersion = data.version;
    assert.equal(itineraryVersion, 4);
    assert.equal(data.days.find((day) => day.id === "sep-03").activities[0].id, sharedActivityId);

    const updateDay = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: friendCookie,
      ip: "203.0.113.30",
      body: {
        baseVersion: itineraryVersion,
        operation: { type: "day.update", dayId: "sep-03", changes: { note: "同行者共同確認過的安排。" } },
      },
    });
    assert.equal(updateDay.status, 200);
    data = await updateDay.json();
    itineraryVersion = data.version;
    assert.equal(itineraryVersion, 5);
    assert.equal(data.days.find((day) => day.id === "sep-03").note, "同行者共同確認過的安排。");
  });

  await t.test("important deletion requires confirmation and version restore appends a new snapshot", async () => {
    const rejected = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: ownerCookie,
      body: { baseVersion: itineraryVersion, operation: { type: "activity.delete", activityId: "sep01-tpe" } },
    });
    assert.equal(rejected.status, 428);
    assert.equal((await (await request("/api/itinerary")).json()).version, itineraryVersion);

    const remove = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: ownerCookie,
      body: { baseVersion: itineraryVersion, operation: { type: "activity.delete", activityId: "sep01-tpe", confirmImportant: true } },
    });
    assert.equal(remove.status, 200);
    itineraryVersion = (await remove.json()).version;
    assert.equal(itineraryVersion, 6);

    const restore = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: friendCookie,
      ip: "203.0.113.30",
      body: { baseVersion: itineraryVersion, operation: { type: "version.restore", version: 5 } },
    });
    assert.equal(restore.status, 200);
    const restored = await restore.json();
    itineraryVersion = restored.version;
    assert.equal(itineraryVersion, 7);
    assert.equal(restored.change.sourceVersion, 5);
    assert.ok(restored.days.flatMap((day) => day.activities).some((activity) => activity.id === "sep01-tpe"));
  });

  await t.test("ordinary deletion, same-origin checks and optimistic version conflicts are enforced", async () => {
    const wrongOrigin = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: ownerCookie,
      origin: "https://evil.test",
      body: { baseVersion: itineraryVersion, operation: { type: "activity.delete", activityId: sharedActivityId } },
    });
    assert.equal(wrongOrigin.status, 403);

    const remove = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: ownerCookie,
      body: { baseVersion: itineraryVersion, operation: { type: "activity.delete", activityId: sharedActivityId } },
    });
    assert.equal(remove.status, 200);
    itineraryVersion = (await remove.json()).version;
    assert.equal(itineraryVersion, 8);

    const stale = await request("/api/collab/itinerary", {
      method: "PATCH",
      cookie: friendCookie,
      ip: "203.0.113.30",
      body: { baseVersion: 7, operation: { type: "day.update", dayId: "sep-03", changes: { title: "過期修改" } } },
    });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).currentVersion, 8);
    assert.equal((await (await request("/api/itinerary")).json()).version, 8);
  });

  await t.test("history is append-only, attributed and never exposed by the public endpoint", async () => {
    const historyResponse = await request("/api/collab/itinerary/history?limit=20", { cookie: ownerCookie });
    assert.equal(historyResponse.status, 200);
    const { history } = await historyResponse.json();
    assert.deepEqual(history.map((item) => item.version), [8, 7, 6, 5, 4, 3, 2, 1]);
    assert.equal(history.find((item) => item.version === 3).authorName, "Friend");
    assert.equal(history.find((item) => item.version === 7).action, "version.restore");
    assert.equal(history.find((item) => item.version === 7).sourceVersion, 5);

    const publicItinerary = await (await request("/api/itinerary")).json();
    assert.equal(publicItinerary.version, 8);
    assert.equal("history" in publicItinerary, false);
    assert.equal("authorName" in publicItinerary, false);
    assert.equal("authorId" in publicItinerary, false);
  });

  let expenseId;
  await t.test("shared expenses support records, splits and edits", async () => {
    const create = await request("/api/collab/expenses", { method: "POST", cookie: ownerCookie, body: { dayId: "sep-08", description: "租車", category: "rental", amount: 240.5, currency: "USD", paidBy: "Min", participants: ["Min", "Friend"] } });
    assert.equal(create.status, 201);
    expenseId = (await create.json()).id;
    let list = await (await request("/api/collab/expenses", { cookie: ownerCookie })).json();
    assert.equal(list.expenses[0].amountCents, 24050);
    assert.deepEqual(list.expenses[0].participants, ["Min", "Friend"]);
    assert.equal((await request(`/api/collab/expenses/${expenseId}`, { method: "PATCH", cookie: ownerCookie, body: { dayId: "sep-08", description: "租車與 ETC", category: "rental", amount: 255.75, currency: "USD", paidBy: "Min", participants: ["Min", "Friend", "Alex"] } })).status, 200);
    list = await (await request("/api/collab/expenses", { cookie: ownerCookie })).json();
    assert.equal(list.expenses[0].amountCents, 25575);
    assert.equal(list.expenses[0].participants.length, 3);
    assert.equal((await request("/api/collab/expenses", { method: "POST", cookie: ownerCookie, body: { description: "錯誤金額", category: "food", amount: 0, currency: "USD", paidBy: "Min", participants: [] } })).status, 400);
  });

  await t.test("expense authors retain ownership", async () => {
    assert.equal((await request(`/api/collab/expenses/${expenseId}`, { method: "DELETE", cookie: friendCookie, body: null, ip: "203.0.113.30" })).status, 403);
    assert.equal((await request(`/api/collab/expenses/${expenseId}`, { method: "DELETE", cookie: ownerCookie, body: null })).status, 200);
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
