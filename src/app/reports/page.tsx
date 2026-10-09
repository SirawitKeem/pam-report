import { configStatus } from "@/lib/pam";
import Report from "@/components/report";
export const dynamic = "force-dynamic";
export default function ReportsPage() { return <Report config={configStatus()} />; }
