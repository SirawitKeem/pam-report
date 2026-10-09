import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const catalogSource = await fs.readFile(new URL("../src/lib/catalog.ts", import.meta.url), "utf8");
const catalogCode = stripTypeScriptTypes(catalogSource, { mode: "transform" });
const catalogUrl = "data:text/javascript;base64," + Buffer.from(catalogCode).toString("base64");
const source = (await fs.readFile(new URL("../src/lib/pam.ts", import.meta.url), "utf8"))
  .replace('import "server-only";', "")
  .replace('"./catalog"', JSON.stringify(catalogUrl)).replace('"./pam-transport.mjs"', JSON.stringify(new URL("../src/lib/pam-transport.mjs", import.meta.url).href));
const moduleUrl = "data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(source, { mode: "transform" })).toString("base64");
const { configStatus, readPam } = await import(moduleUrl);
const status = configStatus();
console.log(JSON.stringify({ configured: status.ready, missing: status.missing }));
if (!status.ready) { process.exitCode = 1; } else {
const { apis } = await import(catalogUrl);
let failed = false;
for (const api of apis) {
  try {
    const result = await readPam(api.id);
    const data = result.data;
    console.log(JSON.stringify({ category: api.id, httpStatus: result.upstreamStatus, receivedJson: true, shape: Array.isArray(data) ? "array" : typeof data, records: Array.isArray(data) ? data.length : undefined }));
  } catch (error) {
    console.log(JSON.stringify({ category: api.id, error: error.message, upstreamStatus: error.upstreamStatus }));
    failed = true;
    if (api.id === "users") break;
  }
}
if (failed) process.exitCode = 1;

}
