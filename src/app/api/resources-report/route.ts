import { NextRequest, NextResponse } from "next/server";
import { fetchResourceReport } from "@/lib/resource-report";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest) {
  const origin=request.headers.get("origin");
  if(origin && origin!==request.nextUrl.origin)return NextResponse.json({error:"Origin ไม่ถูกต้อง"},{status:403});
  try{return NextResponse.json(await fetchResourceReport(),{headers:{"Cache-Control":"no-store"}});}
  catch{return NextResponse.json({error:"ไม่สามารถจัดทำรายงานได้"},{status:500,headers:{"Cache-Control":"no-store"}});}
}
