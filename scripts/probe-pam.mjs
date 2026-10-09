import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const keys=['PAM_BASE_URL','PAM_CLIENT_ID','PAM_CLIENT_SECRET','PAM_CUSTOMER_ID'];
console.log(JSON.stringify({configuration:Object.fromEntries(keys.map(key=>[key,Boolean(process.env[key]?.trim())]))}));
const base=new URL(process.env.PAM_BASE_URL).origin;
try {
 const body={grant_type:'client_credentials',client_id:process.env.PAM_CLIENT_ID,client_secret:process.env.PAM_CLIENT_SECRET};
 if(process.env.PAM_CUSTOMER_ID?.trim()) body.customer=process.env.PAM_CUSTOMER_ID.trim();
 const response=await fetch(base+'/pam/apps/autheticate/oauth/token-generation/',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
 const data=await response.json().catch(()=>null);
 console.log(JSON.stringify({stage:'token',status:response.status,tokenReceived:typeof data?.access_token==='string',fields:data?Object.keys(data):[],errors:response.ok?undefined:data?.errors}));
 if(response.ok && data?.access_token){
  for(const [name,path] of [['Users','/pam/apps/users/user/'],['Resources','/pam/apps/assets/asset/'],['System Users','/pam/apps/assets/systemuser/'],['Certificates statistics','/pam/apps/api/certificates/statistics/']]){
   const read=await fetch(base+path,{headers:{Authorize:'Bearer '+data.access_token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
   const value=await read.json().catch(()=>null);
   console.log(JSON.stringify({category:name,status:read.status,fields:value&&typeof value==='object'?Object.keys(value):[],count:Array.isArray(value)?value.length:undefined}));
  }
 }
} catch(error){ console.log(JSON.stringify({stage:'connection',error:error.name,code:error.cause?.code,message:error.cause?.message||error.message}));process.exitCode=1;}
