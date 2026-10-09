import "server-only";
import { apis } from "./catalog";
import { dataset, fetchResourceReport } from "./resource-report";
import { PamError, readPamEndpoint } from "./pam";
import type { ApiCheck, ExecutiveReport, ReportOptions, ReportSource, ResourceAllocation, ResourceDetail, ResourceSelection } from "./executive-model";
import type { Row } from "./resource-model";

async function readSource(name: string, endpoint: string): Promise<ReportSource> {
  try {
    const result = await readPamEndpoint(endpoint);
    return { name, endpoint, status: result.upstreamStatus, ok: true, data: result.data };
  } catch (error) {
    return { name, endpoint, ok: false, status: error instanceof PamError ? error.upstreamStatus : undefined,
      error: error instanceof Error ? error.message : "ดึงข้อมูลไม่สำเร็จ" };
  }
}
async function check(name: string, endpoint: string): Promise<ApiCheck> {
  const { data: _data, ...result } = await readSource(name, endpoint);
  return result;
}
export async function fetchExecutiveReport(selection: ResourceSelection = { assets: [], applications: [], webApps: [] }, options: ReportOptions = { scanTo: 0, month: "" }): Promise<ExecutiveReport> {
  const [resourceReport, groups, checks, sources] = await Promise.all([
    fetchResourceReport(),
    dataset("/pam/apps/groups/groups/?page=0&limit=100&search=&filter_by=", "groups", "totalGroups", 0),
    Promise.all([
      ...apis.filter(api => api.id !== "users" && api.id !== "roles").map(api => check(api.name + " · URL ตามเอกสาร", api.path))
    ]),
    Promise.all([
      readSource("Roles · รายการ", "/pam/apps/roles/role/?page=1&page_size=10&search=&filter_by="),
      readSource("System Users · รายการ", "/pam/apps/assets/systemuser/list/?page=0&limit=10&search=&filter_by="),
      readSource("Tickets · รายการ", "/pam/apps/ticket/tickets/?page=0&limit=10&search=&filter_by=&advance_filter_by=&isEPM=false"),
      readSource("Certificates", "/pam/apps/api/certificates/")
    ])
  ]);
  checks.push(...sources.map(({ data: _data, ...result }) => result));
  for (const [name, data] of [["Users", resourceReport.users], ["Resources", resourceReport.resources], ["Groups · รายการ", groups]] as const) {
    checks.unshift({ name, endpoint: data.endpoint, status: data.status, ok: !data.error, error: data.error });
  }
  // Automatically discover references from the live list when that endpoint works.
  // When it fails, selected IDs come from the report URL, never from embedded record data.
  const selected = { assets: [...selection.assets], applications: [...selection.applications], webApps: [...selection.webApps] };
  for (const row of resourceReport.resources.rows) {
    if (typeof row.id !== "number" || !Number.isInteger(row.id) || row.id <= 0) continue;
    const type = String(row.resource_type).toLowerCase();
    const key = type === "asset" ? "assets" : type === "app" ? "applications" : type === "webapp" ? "webApps" : null;
    if (key && !selected[key].includes(row.id)) selected[key].push(row.id);
  }
  const details: ResourceDetail[] = [];
  const attempts: ExecutiveReport["discovery"]["attempts"] = [];
  let detailLimitReached = false;
  for (const [kind, ids, path, key, arrayKey] of [
    ["Asset", selected.assets, "/pam/apps/assets/asset/", "asset_id", "asset"],
    ["App", selected.applications, "/pam/apps/apps/app/", "app_id", "app"],
    ["WebApp", selected.webApps, "/pam/apps/web_apps/web_app/", "web_app_id", "web_app"]
  ] as const) {
    const requested = [...new Set([...ids, ...(kind !== "WebApp" ? Array.from({ length: options.scanTo }, (_, index) => index + 1) : [])])];
    if (requested.length > 2000) detailLimitReached = true;
    let cursor = 0;
    const found = new Map<number, ResourceDetail>();
    async function worker() {
    while (cursor < Math.min(requested.length, 2000)) {
      const id = requested[cursor++];
      const endpoint = path + "?" + key + "=" + id + "&is_clone=false";
      const detail: ResourceDetail = { kind, requestedId: id, endpoint };
      try {
        const response = await readPamEndpoint(endpoint); detail.status = response.upstreamStatus;
        const row = (response.data as Record<string, unknown>)[arrayKey];
        if (!row || typeof row !== "object" || Array.isArray(row) || String((row as Row).id) !== String(id)) throw new Error("API ไม่ส่งรายละเอียดที่ตรงกับรหัสที่ร้องขอ");
        detail.row = row as Row;
      } catch (error) {
        detail.status = error instanceof PamError ? error.upstreamStatus : detail.status;
        detail.error = error instanceof Error ? error.message : "ดึงรายละเอียดไม่สำเร็จ";
      }
      attempts.push({ kind, id, status: detail.status, matched: Boolean(detail.row) });
      // Missing IDs and upstream failures remain diagnostic evidence, never inventory rows.
      if (detail.row || ids.includes(id)) found.set(id, detail);
    }
    }
    await Promise.all(Array.from({ length: Math.min(4, requested.length) }, () => worker()));
    for (const detail of [...found.values()].sort((a, b) => a.requestedId - b.requestedId)) {
      details.push(detail);
      checks.push({ name: kind + " · รายการ ID " + detail.requestedId, endpoint: detail.endpoint, status: detail.status, ok: Boolean(detail.row), error: detail.error });
    }
  }
  const allocations: ResourceAllocation[] = [];
  // Check allocations from verified detail records even when the aggregate list fails.
  for (const detail of details) {
    if (!detail.row || detail.kind === "WebApp") continue;
    const path = detail.kind === "Asset"
      ? "/pam/apps/assets/allocated-users/?assetid=" + detail.requestedId
      : "/pam/apps/apps/allocated-users/?app_id=" + detail.requestedId;
    const linked = await dataset(path + "&page=1&page_size=100&search=&filter_by=", "results", "count", 1);
    allocations.push({ kind: detail.kind, resourceId: detail.requestedId, dataset: linked });
    checks.push({ name: detail.kind + " · ผู้มีสิทธิ์ ID " + detail.requestedId, endpoint: linked.endpoint, status: linked.status, ok: !linked.error, error: linked.error });
  }
  const groupDetails: ReportSource[] = [];
  for (const group of groups.rows.slice(0, 50)) {
    if (typeof group.group_id !== "number" || !Number.isInteger(group.group_id) || group.group_id <= 0) continue;
    const source = await readSource("Group · รายกลุ่ม ID " + group.group_id, "/pam/apps/groups/group/?group_id=" + group.group_id);
    groupDetails.push(source);
    const { data: _data, ...result } = source; checks.push(result);
  }
  let ticketAutomation: boolean | null = null;
  const routingPath = "/pam/apps/ticket/ticket-routing/";
  const ticketSettings = await readSource("Ticket automation · การตั้งค่า", routingPath);
  if (ticketSettings.ok && ticketSettings.data && typeof ticketSettings.data === "object") {
    const data = ticketSettings.data as Record<string, unknown>;
    if (typeof data.use_ticketing_automation === "boolean") ticketAutomation = data.use_ticketing_automation;
  }
  const { data: _data, ...settingsCheck } = ticketSettings; checks.push(settingsCheck);
  const monthlySources = await Promise.all(["asset_allocation_user_audit", "asset_allocation_group_audit", "asset_allocation_role_audit"].map(type => readSource("Allocation audit · " + type,
    "/pam/apps/audits/generate-reports/?page=1&page_size=100&search=&report_type=" + type + "&response_type=table&filter_by=&time_zone=Asia%2FBangkok")));
  checks.push(...monthlySources.map(({ data: _data, ...result }) => result));
  // The audit route is verified in frontend code; date-filter semantics are not yet verified.
  // Never filter current inventory by a month and present it as historical state.
  const monthly = { supported: false, reason: monthlySources.some(source => source.ok)
    ? "ได้รับคำตอบจาก Audit API แต่ยังไม่ยืนยันตัวกรองวันที่และการดึงครบทุกหน้า จึงยังไม่สรุปยอดรายเดือน"
    : "Audit API ยังไม่ส่งข้อมูลผ่าน OAuth จึงยังสรุปการใช้งานหรือการเปลี่ยนแปลงย้อนหลังรายเดือนไม่ได้", sources: monthlySources };
  resourceReport.fetchedAt = new Date().toISOString();
  const inventoryKeys = resourceReport.resources.rows.map(row => {
    const type = String(row.resource_type).toLowerCase();
    const kind = type === "asset" ? "Asset" : type === "app" ? "App" : type === "webapp" ? "WebApp" : null;
    return kind && typeof row.id === "number" && Number.isInteger(row.id) && row.id > 0 ? kind + ":" + row.id : null;
  });
  const verifiedKeys = new Set(details.filter(detail => detail.row).map(detail => detail.kind + ":" + detail.requestedId));
  const inventoryComplete = resourceReport.resources.complete && !detailLimitReached
    && inventoryKeys.every(key => key !== null && verifiedKeys.has(key))
    && new Set(inventoryKeys).size === inventoryKeys.length && verifiedKeys.size === inventoryKeys.length;
  return { resourceReport, groups, checks, selection, details, ticketAutomation, sources, allocations, groupDetails, ticketSettings, options,
    discovery: { attempts: attempts.sort((a, b) => a.kind.localeCompare(b.kind) || a.id - b.id), inventoryComplete, detailLimitReached }, monthly };
}
