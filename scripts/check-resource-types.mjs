import fs from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());const compile=code=>'data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(code,{mode:'transform'})).toString('base64');
const catalog=compile(await fs.readFile('src/lib/catalog.ts','utf8'));
const source=(await fs.readFile('src/lib/pam.ts','utf8')).replace('import "server-only";','').replace('"./catalog"',JSON.stringify(catalog)).replace('"./pam-transport.mjs"',JSON.stringify(new URL('../src/lib/pam-transport.mjs',import.meta.url).href));
const {readPamEndpoint}=await import(compile(source));
for(const type of ['','Asset','App','WebApp','application_credentials']){
 const path='/pam/apps/resources/?page=0&limit=10&search='+encodeURIComponent(type)+'&filter_by='+(type?'resource_type':'');
 try{const result=await readPamEndpoint(path);const data=result.data;console.log(JSON.stringify({filter:type||'all',status:result.upstreamStatus,total:data?.total_resources,received:data?.resources?.length,types:[...new Set((data?.resources||[]).map(row=>row.resource_sub_type))]}));}
 catch(error){console.log(JSON.stringify({filter:type||'all',status:error.upstreamStatus,error:error.message}));}
}
