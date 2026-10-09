import nextEnv from '@next/env';import fs from 'node:fs/promises';import {pamFetch} from '../src/lib/pam-transport.mjs';
nextEnv.loadEnvConfig(process.cwd());const base=new URL(process.env.PAM_BASE_URL).origin;
const snapshot=JSON.parse(await fs.readFile('data/pam-report.json','utf8'));
console.log(JSON.stringify({userCount:snapshot.results.users.data?.count,userFields:Object.keys(snapshot.results.users.data?.results?.[0]||{})}));
const page=await pamFetch(base+'/pam/dashboard',{redirect:'error',signal:AbortSignal.timeout(20000)}); const html=await page.text();
const scripts=[...html.matchAll(/<script[^>]*src=["']([^"']+)["']/g)].map(match=>match[1]);console.log(JSON.stringify({pageStatus:page.status,scripts}));
await fs.mkdir('data/inspection',{recursive:true});
for(const [index,source] of scripts.entries()){
 const url=new URL(source,base);if(url.origin!==base)continue;
 const response=await pamFetch(url.href,{redirect:'error',signal:AbortSignal.timeout(20000)});const code=await response.text(); await fs.writeFile('data/inspection/script-'+index+'.txt',code);
 console.log(JSON.stringify({source,status:response.status,characters:code.length}));
}
