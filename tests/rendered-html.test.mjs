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
  assert.match(html, /APSA/);
  assert.match(html, /id="today"/);
  assert.match(html, /出發前快查/);
  assert.match(html, /預約與票券/);
  assert.doesNotMatch(html, /Your site is taking shape/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});

test("serves key navigation and accessibility affordances", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /href="#workspace-content"/);
  assert.match(html, /跳到主要內容/);
  assert.match(html, /aria-label="切換深色模式"/);
  assert.match(html, /aria-label="主要導覽"/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /今天/);
  assert.match(html, /行程/);
  assert.match(html, /預約/);
  assert.match(html, /共同/);
  assert.match(html, /更多/);
  assert.match(html, /下一站/);
  assert.match(html, /共同區/);
});
