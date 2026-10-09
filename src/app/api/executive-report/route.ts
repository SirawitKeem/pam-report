import { NextRequest, NextResponse } from "next/server";
import { fetchExecutiveReport } from "@/lib/executive-report";
import { parseResourceSelection, parseReportOptions } from "@/lib/executive-model";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Origin ไม่ถูกต้อง" }, { status: 403 });
  let selection, options;
  try { selection = parseResourceSelection(Object.fromEntries(request.nextUrl.searchParams), {
    assets: process.env.PAM_REPORT_ASSET_IDS,
    applications: process.env.PAM_REPORT_APPLICATION_IDS,
    webApps: process.env.PAM_REPORT_WEB_APP_IDS,
  }); options = parseReportOptions(Object.fromEntries(request.nextUrl.searchParams), { scanTo: process.env.PAM_REPORT_DISCOVERY_MAX_ID }); }
  catch { return NextResponse.json({ error: "รูปแบบรหัสทรัพยากรไม่ถูกต้อง" }, { status: 400 }); }
  try { return NextResponse.json(await fetchExecutiveReport(selection, options), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "ไม่สามารถจัดทำรายงานได้" }, { status: 500, headers: { "Cache-Control": "no-store" } }); }
}
