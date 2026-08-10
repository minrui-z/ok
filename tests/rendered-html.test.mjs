import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Boston trip planner", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-Hant-TW"/i);
  assert.match(html, /<title>Boston 2026｜APSA 行程手冊<\/title>/i);
  assert.match(html, /Boston Field Notes/);
  assert.match(html, /Copley Place/);
  assert.match(html, /New Balance 世界總部/);
  assert.match(html, /new-balance-hq\.jpg/);
  assert.match(html, /NB Development Group/);
  assert.match(html, /APSA/);
  assert.match(html, /class="travel-leg"/);
  assert.match(html, /Logan Express→Prudential/);
  assert.doesNotMatch(html, /Your site is taking shape/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("serves key navigation and accessibility affordances", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /href="#main-content"/);
  assert.match(html, /跳到主要內容/);
  assert.match(html, /aria-label="切換深色模式"/);
  assert.match(html, /href="#itinerary"/);
  assert.match(html, /href="#drive"/);
  assert.match(html, /href="#collaboration"/);
  assert.match(html, /href="#essentials"/);
  assert.match(html, /全行程地圖|地圖/);
  assert.match(html, /下一站/);
  assert.match(html, /共同筆記與投票/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /aria-current="date"/);
});
