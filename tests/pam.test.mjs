import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
const catalog = stripTypeScriptTypes(await fs.readFile(new URL("../src/lib/catalog.ts", import.meta.url), "utf8"), { mode: "transform" });
const catalogUrl = "data:text/javascript;base64," + Buffer.from(catalog).toString("base64");
const source = (await fs.readFile(new URL("../src/lib/pam.ts", import.meta.url), "utf8")).replace('import "server-only";', "").replace('"./catalog"', JSON.stringify(catalogUrl)).replace('"./pam-transport.mjs"', JSON.stringify(new URL("../src/lib/pam-transport.mjs", import.meta.url).href));
let index = 0;
function moduleUnderTest() {
  const compiled = stripTypeScriptTypes(source, { mode: "transform" });
  return import("data:text/javascript;base64," + Buffer.from(compiled + "\n// " + index++).toString("base64"));
}
function configure() {
  process.env.PAM_BASE_URL = "https://pam.test";
  process.env.PAM_CLIENT_ID = "test-client";
  process.env.PAM_CLIENT_SECRET = "test-secret";
  process.env.PAM_CUSTOMER_ID = "tenant-test";
}
test("Missing configuration blocks requests before contacting PAM", async () => {
  configure(); delete process.env.PAM_CUSTOMER_ID;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Must not contact upstream"); };
  try { const pam = await moduleUnderTest(); await assert.rejects(pam.readPam("users"), error => error.status === 503 && error.message.includes("PAM_CUSTOMER_ID")); }
  finally { globalThis.fetch = original; }
});
test("Token stays server-side; nested secrets are redacted; cached token is reused", async () => {
  configure();
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    if (init.method === "POST") {
      assert.deepEqual(JSON.parse(init.body), { grant_type: "client_credentials", client_id: "test-client", client_secret: "test-secret", customer: "tenant-test" });
      return Response.json({ access_token: "private-test-token", expires_in_minutes: 60 });
    }
    assert.equal(init.headers.Authorize, "Bearer private-test-token");
    return Response.json({ results: [{ username: "alice", password: "do-not-display", nested: { client_secret: "do-not-display", api_key: "do-not-display" } }] });
  };
  try {
    const pam = await moduleUnderTest();
    const first = await pam.readPam("users"); await pam.readPam("groups");
    assert.equal(calls.filter(call => call.init.method === "POST").length, 1);
    assert.equal(calls[1].url, "https://pam.test/pam/apps/users/user/?page=1&page_size=100&search=&filter_by=");
    assert.equal(first.data.results[0].username, "alice");
    assert.equal(first.data.results[0].password, "[REDACTED]");
    assert.equal(first.data.results[0].nested.client_secret, "[REDACTED]");
    assert.equal(first.data.results[0].nested.api_key, "[REDACTED]");
    assert.ok(!JSON.stringify(first).includes("private-test-token"));
    assert.ok(!JSON.stringify(first).includes("do-not-display"));
  } finally { globalThis.fetch = original; }
});
test("An expired token is refreshed once after HTTP 401", async () => {
  configure(); const original = globalThis.fetch; let tokens = 0; let reads = 0;
  globalThis.fetch = async (url, init) => {
    if (init.method === "POST") return Response.json({ access_token: "token-" + ++tokens, expires_in_minutes: 60 });
    reads++; return reads === 1 ? new Response(null, { status: 401 }) : Response.json([]);
  };
  try { const pam = await moduleUnderTest(); const result = await pam.readPam("assets"); assert.equal(tokens, 2); assert.equal(reads, 2); assert.deepEqual(result.data, []); }
  finally { globalThis.fetch = original; }
});
test("Unknown resource paths are rejected before any upstream request", async () => {
  configure(); const pam = await moduleUnderTest();
  await assert.rejects(pam.readPam("../credentials"), error => error.status === 404);
});

test("Rotating client credentials requests a new token instead of reusing the old one", async () => {
 configure();const original=globalThis.fetch;let tokens=0;const secrets=[];const bearer=[];
 globalThis.fetch=async(url,init)=>{
  if(init.method==="POST"){tokens++;secrets.push(JSON.parse(init.body).client_secret);return Response.json({access_token:"token-"+tokens,expires_in_minutes:60});}
  bearer.push(init.headers.Authorize);return Response.json([]);
 };
 try{const pam=await moduleUnderTest();await pam.readPam("users");process.env.PAM_CLIENT_SECRET="new-test-secret";await pam.readPam("users");assert.equal(tokens,2);assert.deepEqual(secrets,["test-secret","new-test-secret"]);assert.deepEqual(bearer,["Bearer token-1","Bearer token-2"]);}
 finally{globalThis.fetch=original;}
});
