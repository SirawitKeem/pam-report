import { fetchExecutiveReport } from "@/lib/executive-report";
import ExecutiveReportView from "@/components/executive-summary";
import { parseResourceSelection, parseReportOptions } from "@/lib/executive-model";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function ExecutiveReportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const input = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  let selection, options;
  try { selection = parseResourceSelection(input, {
    assets: process.env.PAM_REPORT_ASSET_IDS,
    applications: process.env.PAM_REPORT_APPLICATION_IDS,
    webApps: process.env.PAM_REPORT_WEB_APP_IDS,
  }); options = parseReportOptions(input, { scanTo: process.env.PAM_REPORT_DISCOVERY_MAX_ID }); }
  catch { return <main className="rr-canvas"><article className="rr-sheet"><h1>รหัสทรัพยากรไม่ถูกต้อง</h1><p>ใช้เลขจำนวนเต็มบวกคั่นด้วย comma ไม่เกิน 50 รหัสต่อประเภท</p><a href="/">กลับรายงานหลัก</a></article></main>; }
  return <ExecutiveReportView initial={await fetchExecutiveReport(selection, options)} />;
}
