import type { Dataset, ResourceReport, Row } from "./resource-model";
export type ApiCheck = { name: string; endpoint: string; status?: number; ok: boolean; error?: string };
export type ResourceSelection = { assets: number[]; applications: number[]; webApps: number[] };
export type ResourceDetail = { kind: "Asset" | "App" | "WebApp"; requestedId: number; endpoint: string; status?: number; row?: Row; error?: string };
export type ReportSource = ApiCheck & { data?: unknown };
export type ResourceAllocation = { kind: "Asset" | "App"; resourceId: number; dataset: Dataset };
export type ReportOptions = { scanTo: number; month: string };
export type DiscoveryAttempt = { kind: string; id: number; status?: number; matched: boolean };
export type ExecutiveReport = { resourceReport: ResourceReport; groups: Dataset; checks: ApiCheck[]; selection: ResourceSelection; details: ResourceDetail[]; ticketAutomation: boolean | null; sources: ReportSource[]; allocations: ResourceAllocation[]; groupDetails: ReportSource[]; ticketSettings: ReportSource; options: ReportOptions; discovery: { attempts: DiscoveryAttempt[]; inventoryComplete: boolean; detailLimitReached: boolean }; monthly: { supported: boolean; reason: string; sources: ReportSource[] } };

export function parseReportOptions(params: Record<string, string | undefined>, defaults: Record<string, string | undefined> = {}): ReportOptions {
  const raw = params.scanTo ?? defaults.scanTo ?? "0";
  if (!/^\d{1,4}$/.test(raw) || Number(raw) > 1000) throw new Error("ช่วงค้นหาต้องเป็นเลข 0–1000");
  const currentMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).format(new Date());
  const month = params.month || currentMonth;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("เดือนต้องเป็น YYYY-MM");
  return { scanTo: Number(raw), month };
}

// Ambiguous response arrays are not guessed to be the requested inventory.
export function sourceRows(data: unknown): Row[] | null {
  const isRows = (value: unknown): value is Row[] => Array.isArray(value) && value.every(row => row !== null && typeof row === "object" && !Array.isArray(row));
  if (isRows(data)) return data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const arrays = Object.values(data).filter(isRows);
  return arrays.length === 1 ? arrays[0] : null;
}

export function booleanCapabilities(value: unknown, prefix = ""): { path: string; enabled: boolean }[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? prefix + "." + key : key;
    return typeof item === "boolean" ? [{ path, enabled: item }] : booleanCapabilities(item, path);
  });
}

export function parseResourceSelection(params: Record<string, string | undefined>, defaults: Record<string, string | undefined> = {}): ResourceSelection {
  function parse(key: string) {
    const raw = (params[key] ?? defaults[key])?.trim();
    if (!raw) return [];
    const items = raw.split(",").map(value => value.trim());
    if (items.length > 50 || items.some(value => !/^[1-9]\d{0,8}$/.test(value))) throw new Error("รหัสทรัพยากรต้องเป็นเลขจำนวนเต็มบวก คั่นด้วย comma และไม่เกิน 50 รหัสต่อประเภท");
    return [...new Set(items.map(Number))];
  }
  return { assets: parse("assets"), applications: parse("applications"), webApps: parse("webApps") };
}
