import { fetchResourceReport } from "@/lib/resource-report";
import ResourceReportView from "@/components/resource-report";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export default async function ResourcesReportPage(){return <ResourceReportView initial={await fetchResourceReport()} />;}
