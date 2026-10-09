import fs from 'node:fs/promises';
let pam=await fs.readFile('src/lib/pam.ts','utf8');pam=pam.replace('import "server-only";','import "server-only";\nimport { createHash } from "node:crypto";');
pam=pam.replace('let cached: { token: string; expiresAt: number; base: string } | undefined;','let cached: { token: string; expiresAt: number; key: string } | undefined;').replace('let pending: Promise<string> | undefined;','let pending: { key: string; promise: Promise<string> } | undefined;');
pam=pam.replace('  if (cached && cached.base === base && cached.expiresAt > Date.now()) return cached.token;\n  if (pending) return pending;\n  pending = (async () => {','  const key = createHash("sha256").update(JSON.stringify([base, process.env.PAM_CLIENT_ID, process.env.PAM_CLIENT_SECRET, process.env.PAM_CUSTOMER_ID])).digest("hex");\n  if (cached && cached.key === key && cached.expiresAt > Date.now()) return cached.token;\n  if (pending?.key === key) return pending.promise;\n  const promise = (async () => {');
pam=pam.replace('ttl - 30000), base };','ttl - 30000), key };').replace('  try { return await pending; } finally { pending = undefined; }','  pending = { key, promise };\n  try { return await promise; } finally { if (pending?.promise === promise) pending = undefined; }');await fs.writeFile('src/lib/pam.ts',pam);
let report=await fs.readFile('src/lib/resource-report.ts','utf8');report=report.replace('import fs from "node:fs/promises";\n','').replace('import path from "node:path";\n','').replace('const snapshotPath = () => path.join(process.cwd(), "data", "resources-report.latest.json");\n','').replace('  await fs.mkdir(path.dirname(snapshotPath()),{recursive:true});await fs.writeFile(snapshotPath(),JSON.stringify(report,null,2));\n','');report=report.slice(0,report.indexOf('export async function savedResourceReport'));await fs.writeFile('src/lib/resource-report.ts',report);
let page=await fs.readFile('src/app/resources-report/page.tsx','utf8');page=page.replaceAll('savedResourceReport','fetchResourceReport');await fs.writeFile('src/app/resources-report/page.tsx',page);
let cli=await fs.readFile('scripts/refresh-resource-report.mjs','utf8');cli=cli.replace(",saved:'data/resources-report.latest.json'",",source:'Live API'");await fs.writeFile('scripts/refresh-resource-report.mjs',cli);
let ui=await fs.readFile('src/components/resource-report.tsx','utf8');ui=ui.replace('catch(e){setError(','catch(e){setReport(null);setError(');await fs.writeFile('src/components/resource-report.tsx',ui);
let tests=await fs.readFile('tests/pam.test.mjs','utf8');tests+=`\ntest("Rotating client credentials requests a new token instead of reusing the old one", async () => {
 configure();const original=globalThis.fetch;let tokens=0;const secrets=[];const bearer=[];
 globalThis.fetch=async(url,init)=>{
  if(init.method==="POST"){tokens++;secrets.push(JSON.parse(init.body).client_secret);return Response.json({access_token:"token-"+tokens,expires_in_minutes:60});}
  bearer.push(init.headers.Authorize);return Response.json([]);
 };
 try{const pam=await moduleUnderTest();await pam.readPam("users");process.env.PAM_CLIENT_SECRET="new-test-secret";await pam.readPam("users");assert.equal(tokens,2);assert.deepEqual(secrets,["test-secret","new-test-secret"]);assert.deepEqual(bearer,["Bearer token-1","Bearer token-2"]);}
 finally{globalThis.fetch=original;}
});\n`;await fs.writeFile('tests/pam.test.mjs',tests);
let readme=await fs.readFile('README.md','utf8');readme=readme.replace('Redacted snapshots are stored locally in data/ (ignored by Git).','The report fetches live API data on every page request and refresh. Diagnostic JSON files in data/ are not used as report inputs.');await fs.writeFile('README.md',readme);
console.log('Report now fetches live API data; token cache follows credential changes.');
