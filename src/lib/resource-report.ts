import "server-only";
import { PamError, readPamEndpoint, configStatus } from "./pam";
import { label, resourceKey, resourceName, type Row, type Dataset, type ResourceReport } from "./resource-model";
const resourcePath="/pam/apps/resources/?page=0&limit=10&search=&filter_by=";
const usersPath="/pam/apps/users/user/?page=1&page_size=100&search=&filter_by=";
export async function dataset(endpoint: string, arrayKey: string, totalKey: string, firstPage: number): Promise<Dataset> {
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
      const pageSize=Number(url.searchParams.get("limit") ?? url.searchParams.get("page_size") ?? 100);
      if(data.next===null || list.length===0 || (total===null && Number.isInteger(pageSize) && pageSize>0 && list.length<pageSize))return {rows,total,complete:total===null || rows.length===total,status,endpoint};
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
  return report;
}
