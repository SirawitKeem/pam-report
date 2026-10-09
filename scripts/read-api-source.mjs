import fs from 'node:fs/promises';const code=await fs.readFile('data/inspection/chunk-1862.txt','utf8');
for(const term of ['.g_)','filterBy:','filterBy=','useState)("All"','useState)("all"']){let i=-1,c=0;while((i=code.indexOf(term,i+1))>=0&&c++<6)console.log(JSON.stringify({term,text:code.slice(Math.max(0,i-300),i+400)}));}
