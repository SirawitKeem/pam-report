import fs from 'node:fs/promises';
const file='src/lib/pam.ts';let code=await fs.readFile(file,'utf8');const start=code.indexOf('export async function readPam(id: string)');
code=code.slice(0,start)+`export async function readPamEndpoint(path: string, scope = "") {
  const base = baseUrl();
  const url = new URL(path, base);
  const allowed = [...apis.map(item => item.path), "/pam/apps/resources/", "/pam/apps/assets/allocated-users/", "/pam/apps/apps/allocated-users/", "/pam/apps/web_apps/user-allocation/"];
  if (url.origin !== base || !path.startsWith("/pam/apps/") || !allowed.includes(url.pathname as typeof apis[number]["path"])) throw new PamError("Endpoint ไม่อยู่ในรายการที่อนุญาต", 404);
  let token = await accessToken(base);
  let response = await call(url.href, { headers: { Authorize: "Bearer " + token, Accept: "application/json" } });
  if (response.status === 401) {
    cached = undefined;
    token = await accessToken(base);
    response = await call(url.href, { headers: { Authorize: "Bearer " + token, Accept: "application/json" } });
  }
  if (!response.ok) throw new PamError("PAM ตอบ HTTP " + response.status + (response.status === 403 && scope ? " · scope: " + scope : "") + " และไม่ส่งรายการข้อมูลกลับมา", 502, response.status);
  const data: unknown = await response.json().catch(() => { throw new PamError("PAM ส่งข้อมูลที่ไม่ใช่ JSON"); });
  return { data: redact(data), fetchedAt: new Date().toISOString(), upstreamStatus: response.status };
}
export async function readPam(id: string) {
  const api = apis.find(item => item.id === id);
  if (!api) throw new PamError("ไม่พบหมวด API นี้", 404);
  const path = api.path + (id === "users" ? "?page=1&page_size=100&search=&filter_by=" : "");
  return readPamEndpoint(path, api.scope);
}
`;
await fs.writeFile(file,code);
await fs.mkdir('src/app/resources-report',{recursive:true});await fs.mkdir('src/app/api/resources-report',{recursive:true});
await fs.writeFile('src/lib/resource-model.ts',`export type Row = Record<string, unknown>;
export type Dataset = { rows: Row[]; total: number | null; complete: boolean; status?: number; error?: string; endpoint: string };
export type Assignment = { resourceKey: string; username: string; userId: string; systemUser: string; allocationType: string };
export type ResourceReport = { fetchedAt: string; baseUrl: string; resources: Dataset; users: Dataset; assignments: Assignment[]; allocationErrors: string[]; allocationComplete: boolean };
export function label(value: unknown): string { if (value == null || value === "") return "—"; if (typeof value === "object") { const obj=value as Row; return label(obj.username ?? obj.name ?? obj.display_name ?? obj.id); } return String(value); }
export function resourceKey(row: Row) { return label(row.resource_type) + ":" + label(row.id); }
export function resourceName(row: Row) { return label(row.display_name ?? row.asset_name ?? row.app_name ?? row.web_app_name ?? row.name ?? row.id); }
`);
await fs.writeFile('src/lib/resource-report.ts',`import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { PamError, readPamEndpoint, configStatus } from "./pam";
import { label, resourceKey, resourceName, type Row, type Dataset, type ResourceReport } from "./resource-model";
const snapshotPath = () => path.join(process.cwd(), "data", "resources-report.latest.json");
const resourcePath="/pam/apps/resources/?page=0&limit=100&search=&filter_by=";
const usersPath="/pam/apps/users/user/?page=1&page_size=100&search=&filter_by=";
async function dataset(endpoint: string, arrayKey: string, totalKey: string, firstPage: number): Promise<Dataset> {
  const rows: Row[]=[]; let total: number|null=null; let status: number|undefined;
  try {
    for(let page=firstPage;page<firstPage+100;page++) {
      const url=new URL(endpoint,"https://pam.invalid");url.searchParams.set("page",String(page));
      const response=await readPamEndpoint(url.pathname+url.search);status=response.upstreamStatus;
      const data=response.data as Record<string,unknown>;
      if(!data || !Array.isArray(data[arrayKey])) throw new Error("API ส่งโครงสร้างรายการที่ยังไม่รองรับ");
      const list=data[arrayKey] as Row[];
      if(list.some(row=>!row || typeof row!=="object"))throw new Error("รูปแบบรายการไม่ถูกต้อง");
      if(page===firstPage && typeof data[totalKey]==="number" && Number.isInteger(data[totalKey]) && data[totalKey]>=0)total=data[totalKey] as number;
      rows.push(...list);
      if(total!==null && rows.length>=total)return {rows,total,complete:rows.length===total,status,endpoint};
      if(data.next===null || list.length===0 || (total===null && list.length<100))return {rows,total,complete:total===null || rows.length===total,status,endpoint};
    }
    return {rows,total,status,complete:false,error:"หยุดที่ 100 หน้า รายการยังไม่ครบ",endpoint};
  } catch(error) { return {rows,total,complete:false,status:error instanceof PamError?error.upstreamStatus:status,error:error instanceof Error?error.message:"ดึงข้อมูลไม่สำเร็จ",endpoint}; }
}
export async function fetchResourceReport(): Promise<ResourceReport> {
  const [resources,users]=await Promise.all([dataset(resourcePath,"resources","total_resources",0),dataset(usersPath,"results","count",1)]);
  const report:ResourceReport={fetchedAt:new Date().toISOString(),baseUrl:configStatus().baseUrl,resources,users,assignments:[],allocationErrors:[],allocationComplete:resources.complete};
  for(const resource of resources.rows) {
    const type=String(resource.resource_type).toLowerCase();const id=resource.id;
    let endpoint:string;
    if(type==="asset" || type==="assets")endpoint="/pam/apps/assets/allocated-users/?assetid="+encodeURIComponent(String(id));
    else if(type==="app" || type==="apps")endpoint="/pam/apps/apps/allocated-users/?app_id="+encodeURIComponent(String(id));
    else {report.allocationComplete=false;report.allocationErrors.push(resourceName(resource)+": ยังไม่มีคำขอข้อมูล User ที่ยืนยันสำหรับประเภทนี้");continue;}
    const linked=await dataset(endpoint+"&page=1&page_size=100&search=&filter_by=","results","count",1);
    if(!linked.complete){report.allocationComplete=false;report.allocationErrors.push(resourceName(resource)+": "+(linked.error||"รายการ User ยังไม่ครบ"));}
    for(const user of linked.rows)report.assignments.push({resourceKey:resourceKey(resource),username:label(user.username ?? (user.user as Row)?.username),userId:label(user.user_id ?? (user.user as Row)?.id),systemUser:label(user.systemuser ?? user.system_user),allocationType:label(user.allocation_type)});
  }
  await fs.mkdir(path.dirname(snapshotPath()),{recursive:true});await fs.writeFile(snapshotPath(),JSON.stringify(report,null,2));
  return report;
}
export async function savedResourceReport():Promise<ResourceReport|null> {
  try {return JSON.parse(await fs.readFile(snapshotPath(),"utf8"));}catch{return null;}
}
`);
await fs.writeFile('src/app/api/resources-report/route.ts',`import { NextRequest, NextResponse } from "next/server";
import { fetchResourceReport } from "@/lib/resource-report";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  const origin=request.headers.get("origin");
  if(origin && origin!==request.nextUrl.origin)return NextResponse.json({error:"Origin ไม่ถูกต้อง"},{status:403});
  try{return NextResponse.json(await fetchResourceReport(),{headers:{"Cache-Control":"no-store"}});}
  catch{return NextResponse.json({error:"ไม่สามารถจัดทำรายงานได้"},{status:500,headers:{"Cache-Control":"no-store"}});}
}
`);
await fs.writeFile('src/app/resources-report/page.tsx',`import { savedResourceReport } from "@/lib/resource-report";
import ResourceReportView from "@/components/resource-report";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export default async function ResourcesReportPage(){return <ResourceReportView initial={await savedResourceReport()} />;}
`);
await fs.writeFile('src/app/page.tsx',`export { default, dynamic, runtime } from "./resources-report/page";\n`);
let ignore=await fs.readFile('.gitignore','utf8');if(!ignore.includes('/data/'))ignore+='\n/data/\n';await fs.writeFile('.gitignore',ignore);
console.log('Created Resources report server and API.');
