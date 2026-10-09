import fs from 'node:fs/promises';
import nextEnv from '@next/env';
import { pamFetch } from '../src/lib/pam-transport.mjs';
nextEnv.loadEnvConfig(process.cwd());
const base=new URL(process.env.PAM_BASE_URL).origin;
const privateField=/password|passwd|secret|token|api.?key|private.?key|credential|cookie|authorization|authorize/i;
function redact(value){if(Array.isArray(value))return value.map(redact);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,privateField.test(k)?'[REDACTED]':redact(v)]));return value;}
const tokenResponse=await pamFetch(base+'/pam/apps/autheticate/oauth/token-generation/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:process.env.PAM_CLIENT_ID,client_secret:process.env.PAM_CLIENT_SECRET,customer:process.env.PAM_CUSTOMER_ID}),redirect:'error',signal:AbortSignal.timeout(20000)});
const token=await tokenResponse.json();
if(!tokenResponse.ok || !token.access_token)throw new Error('Token request failed: HTTP '+tokenResponse.status);
console.log(JSON.stringify({stage:'token',status:tokenResponse.status,received:true}));
const queries=[['users','/pam/apps/users/user/?page=1&page_size=10&search=&filter_by='],['assets','/pam/apps/assets/asset/?page=1&page_size=10&search=&filter_by='],['system-users','/pam/apps/assets/systemuser/?page=1&page_size=10&search=&filter_by='],['certificates','/pam/apps/api/certificates/'],['certificate-statistics','/pam/apps/api/certificates/statistics/']];
const snapshot={baseUrl:base,fetchedAt:new Date().toISOString(),source:'OAuth Client Credentials',results:{}};
for(const [id,path] of queries){
 try{
 const response=await pamFetch(base+path,{headers:{Authorize:'Bearer '+token.access_token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>null);
 snapshot.results[id]={path,upstreamStatus:response.status,fetchedAt:new Date().toISOString(),...(response.ok && data!==null?{data:redact(data)}:{error:'PAM returned HTTP '+response.status,details:redact(data)})};
 console.log(JSON.stringify({id,status:response.status,keys:data&&typeof data==='object'?Object.keys(data):[],sample:response.ok?undefined:redact(data)}));
 }catch(e){snapshot.results[id]={path,error:e.message};console.log(JSON.stringify({id,error:e.message}));}
}
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/pam-report.json',JSON.stringify(snapshot,null,2));
console.log('Saved redacted API snapshot: data/pam-report.json');
