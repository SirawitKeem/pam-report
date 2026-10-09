import fs from 'node:fs/promises';
const code=await fs.readFile('data/inspection/chunk-1862.txt','utf8');
for(const term of ['resource_type','resource_sub_type','resourceType','filter_by']){let i=-1,c=0;const out=[];while((i=code.indexOf(term,i+1))>=0&&c++<8)out.push(code.slice(Math.max(0,i-100),i+260));console.log(JSON.stringify({term,snippets:out}));}
const main=await fs.readFile('data/inspection/script-0.txt','utf8');const paths=[...new Set([...main.matchAll(/"(\/[^"\s\\]{1,180})"/g)].map(m=>m[1]))].filter(p=>/type|config/.test(p)&&!/dashboard|static|cloud|credential-scanning|customer/.test(p));console.log(JSON.stringify({relatedEndpoints:paths}));
