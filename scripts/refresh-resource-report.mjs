import fs from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const compile=code=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code,{mode:'transform'})).toString('base64');
const catalog=compile(await fs.readFile('src/lib/catalog.ts','utf8'));const model=compile(await fs.readFile('src/lib/resource-model.ts','utf8'));
const pam=compile((await fs.readFile('src/lib/pam.ts','utf8')).replace('import "server-only";','').replace('"./catalog"',JSON.stringify(catalog)).replace('"./pam-transport.mjs"',JSON.stringify(new URL('../src/lib/pam-transport.mjs',import.meta.url).href)));
const report=compile((await fs.readFile('src/lib/resource-report.ts','utf8')).replace('import "server-only";','').replace('"./pam"',JSON.stringify(pam)).replace('"./resource-model"',JSON.stringify(model)));
const {fetchResourceReport}=await import(report);const result=await fetchResourceReport();
console.log(JSON.stringify({resources:{status:result.resources.status,total:result.resources.total,received:result.resources.rows.length,error:result.resources.error},users:{status:result.users.status,total:result.users.total,received:result.users.rows.length},relationships:result.assignments.length,source:'Live API'}));
