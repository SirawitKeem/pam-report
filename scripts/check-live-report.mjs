const states=[];
for(let i=0;i<2;i++){const response=await fetch('http://127.0.0.1:3000/resources-report',{cache:'no-store',signal:AbortSignal.timeout(40000)});const html=await response.text();const timestamps=[...new Set(html.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g)||[])];states.push({status:response.status,fetchedAt:timestamps[0],hasReport:html.includes('รายงาน Resources')});}
console.log(JSON.stringify({requests:states,newFetchOnEachPage:Boolean(states[0].fetchedAt && states[1].fetchedAt && states[0].fetchedAt!==states[1].fetchedAt)}));
