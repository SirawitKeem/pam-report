import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const compile = source => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64');
const { parseResourceSelection, parseReportOptions, sourceRows, booleanCapabilities } = await import(compile(await fs.readFile('src/lib/executive-model.ts', 'utf8')));

test('Discovery and document months are bounded and do not imply historical data', () => {
  assert.deepEqual(parseReportOptions({scanTo:'100',month:'2026-10'}),{scanTo:100,month:'2026-10'});
  for(const scanTo of ['1001','-1','Infinity','1.5']) assert.throws(()=>parseReportOptions({scanTo}));
  assert.throws(()=>parseReportOptions({month:'2026-13'}));
});

test('Range discovery includes only matched identities and never declares a failed list complete', async () => {
  const catalog=compile('export const apis=[];');
  const resource=compile(`const empty={rows:[],total:null,complete:false,endpoint:'/unavailable/'};export async function dataset(){return empty;}export async function fetchResourceReport(){return {fetchedAt:new Date().toISOString(),baseUrl:'https://pam.test',users:empty,resources:empty,assignments:[],allocationErrors:[],allocationComplete:false};}`);
  const pam=compile(`export class PamError extends Error {} export async function readPamEndpoint(path){const id=Number(new URL(path,'https://pam.test').searchParams.get('asset_id'));return {upstreamStatus:200,data:id===2?{asset:{id:2}}:id===3?{asset:{id:99}}:{}};}`);
  const code=(await fs.readFile('src/lib/executive-report.ts','utf8')).replace('import "server-only";','').replace('"./catalog"',JSON.stringify(catalog)).replace('"./resource-report"',JSON.stringify(resource)).replace('"./pam"',JSON.stringify(pam));
  const {fetchExecutiveReport}=await import(compile(code));
  const report=await fetchExecutiveReport({assets:[],applications:[],webApps:[]},{scanTo:3,month:'2026-10'});
  assert.equal(report.details.length,1);assert.equal(report.details[0].requestedId,2);
  assert.equal(report.discovery.attempts.length,6);assert.equal(report.discovery.inventoryComplete,false);
  assert.equal(report.monthly.supported,false);
});
test('Resource references reject invalid IDs, paths and unbounded request lists', () => {
  assert.deepEqual(parseResourceSelection({assets:'7,2,7',applications:'4'}), {assets:[7,2],applications:[4],webApps:[]});
  for (const raw of ['-1','0','1.5','https://other.test','1&asset_id=2',Array.from({length:51},(_,i)=>i+1).join(',')]) assert.throws(() => parseResourceSelection({assets:raw}));
});

test('Home defaults apply to absent selections, while explicit empty selections clear them', () => {
  const defaults = {assets:'7,2', applications:'4', webApps:'3'};
  assert.deepEqual(parseResourceSelection({}, defaults), {assets:[7,2], applications:[4], webApps:[3]});
  assert.deepEqual(parseResourceSelection({assets:'', applications:'5'}, defaults), {assets:[], applications:[5], webApps:[3]});
  assert.throws(() => parseResourceSelection({}, {assets:'invalid'}));
});

test('Additional inventories reject ambiguous arrays and capability counts use only explicit booleans', () => {
  assert.equal(sourceRows({users:[{id:1}],groups:[{id:2}]}), null);
  assert.equal(sourceRows({results:[1,2]}), null);
  assert.deepEqual(sourceRows({results:[{id:1}],count:1}), [{id:1}]);
  assert.deepEqual(booleanCapabilities({assets:{view:true,edit:false,delete:'false'},secret:'[REDACTED]'}), [{path:'assets.view',enabled:true},{path:'assets.edit',enabled:false}]);
});

test('Pagination at the UI page size does not stop early when the total is absent', async () => {
  const model = compile(await fs.readFile('src/lib/resource-model.ts','utf8'));
  const pam = compile(`export class PamError extends Error {} export function configStatus(){return {baseUrl:'https://pam.test'}};
    export async function readPamEndpoint(path){const page=Number(new URL(path,'https://pam.test').searchParams.get('page'));return {upstreamStatus:200,data:{resources:page<2?Array.from({length:10},(_,i)=>({id:page*10+i+1})):[]}};}`);
  const code=(await fs.readFile('src/lib/resource-report.ts','utf8')).replace('import "server-only";','').replace('"./pam"',JSON.stringify(pam)).replace('"./resource-model"',JSON.stringify(model));
  const {dataset}=await import(compile(code));
  const result=await dataset('/pam/apps/resources/?page=0&limit=10','resources','total_resources',0);
  assert.equal(result.rows.length,20); assert.equal(result.complete,true); assert.equal(result.total,null);
});

test('Verified detail allocations are fetched even when the aggregate Resources list is unavailable', async () => {
  const catalog=compile('export const apis=[];');
  const resource=compile(`const empty={rows:[],total:null,complete:false,endpoint:'/unavailable/'};
    export async function dataset(endpoint){return endpoint.includes('assetid=7')?{rows:[{id:3,username:'assigned'}],total:1,complete:true,status:200,endpoint}:empty;}
    export async function fetchResourceReport(){return {fetchedAt:new Date().toISOString(),baseUrl:'https://pam.test',users:empty,resources:{...empty,status:500},assignments:[],allocationErrors:[],allocationComplete:false};}`);
  const pam=compile(`export class PamError extends Error {} export async function readPamEndpoint(path){return {upstreamStatus:200,data:path.includes('asset_id=7')?{asset:{id:7,asset_name:'Selected'}}:{}};}`);
  const code=(await fs.readFile('src/lib/executive-report.ts','utf8')).replace('import "server-only";','').replace('"./catalog"',JSON.stringify(catalog)).replace('"./resource-report"',JSON.stringify(resource)).replace('"./pam"',JSON.stringify(pam));
  const {fetchExecutiveReport}=await import(compile(code));
  const report=await fetchExecutiveReport({assets:[7],applications:[],webApps:[]});
  assert.equal(report.resourceReport.resources.complete,false);
  assert.equal(report.allocations[0].resourceId,7);
  assert.equal(report.allocations[0].dataset.rows[0].username,'assigned');
  assert.equal(report.allocations[0].dataset.complete,true);
});
test('An upstream response for a different resource is never included as the selected asset', async () => {
  const catalog = compile('export const apis=[];');
  const resource = compile(`const empty={rows:[],total:null,complete:false,endpoint:'/unavailable/'};
    export async function dataset(){return empty;}
    export async function fetchResourceReport(){return {fetchedAt:new Date().toISOString(),baseUrl:'https://pam.test',users:empty,resources:empty,assignments:[],allocationErrors:[],allocationComplete:false};}`);
  const pam = compile(`export class PamError extends Error {}
    export async function readPamEndpoint(path){return {upstreamStatus:200,data:path.includes('asset_id=7')?{asset:{id:9,asset_name:'Different asset'}}:{}};}`);
  const code=(await fs.readFile('src/lib/executive-report.ts','utf8')).replace('import "server-only";','').replace('"./catalog"',JSON.stringify(catalog)).replace('"./resource-report"',JSON.stringify(resource)).replace('"./pam"',JSON.stringify(pam));
  const {fetchExecutiveReport}=await import(compile(code));
  const report=await fetchExecutiveReport({assets:[7],applications:[],webApps:[]});
  assert.equal(report.details[0].row,undefined);
  assert.match(report.details[0].error,/รหัส/);
  assert.equal(report.checks.find(check=>check.endpoint.includes('asset_id=7')).ok,false);
});
