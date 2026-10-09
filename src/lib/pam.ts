import "server-only";
import { createHash } from "node:crypto";
import { apis } from "./catalog";
import { pamFetch } from "./pam-transport.mjs";

export class PamError extends Error {
  constructor(message: string, public status = 502, public upstreamStatus?: number) { super(message); }
}
export function configStatus() {
  const missing = ["PAM_BASE_URL", "PAM_CLIENT_ID", "PAM_CLIENT_SECRET", "PAM_CUSTOMER_ID"].filter(key => !process.env[key]?.trim());
  return { ready: missing.length === 0, missing, baseUrl: process.env.PAM_BASE_URL || "", clientIdConfigured: Boolean(process.env.PAM_CLIENT_ID), secretConfigured: Boolean(process.env.PAM_CLIENT_SECRET), customerConfigured: Boolean(process.env.PAM_CUSTOMER_ID) };
}
function baseUrl() {
  const state = configStatus();
  if (!state.ready) throw new PamError("กรุณากรอก " + state.missing.join(", ") + " ใน .env.local แล้วรีสตาร์ตแอป", 503);
  const url = new URL(process.env.PAM_BASE_URL!);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new PamError("PAM_BASE_URL ต้องเป็น HTTPS URL ที่ไม่มี credentials หรือ query string", 503);
  return url.origin;
}
async function call(url: string, init: RequestInit) {
  try {
    return await pamFetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
  } catch (error) {
    const cause = error as { cause?: { code?: string }; name?: string };
    const code = cause.cause?.code || "";
    if (/CERT|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code)) throw new PamError("ตรวจสอบใบรับรอง HTTPS ของ PAM ไม่ผ่าน ให้ตั้งค่า CA ขององค์กรผ่าน NODE_EXTRA_CA_CERTS แล้วรีสตาร์ตแอป");
    if (/ENOTFOUND|EAI_AGAIN/.test(code)) throw new PamError("ไม่สามารถค้นหา host ของ PAM ได้ ตรวจสอบ DNS หรือการเชื่อมต่อเครือข่ายภายใน");
    if (/Timeout|Abort/.test(cause.name || "")) throw new PamError("PAM ไม่ตอบกลับภายใน 20 วินาที", 504);
    throw new PamError("เชื่อมต่อ PAM ไม่สำเร็จ ตรวจสอบเครือข่ายและใบรับรอง HTTPS");
  }
}
let cached: { token: string; expiresAt: number; key: string } | undefined;
let pending: { key: string; promise: Promise<string> } | undefined;
async function accessToken(base: string): Promise<string> {
  const key = createHash("sha256").update(JSON.stringify([base, process.env.PAM_CLIENT_ID, process.env.PAM_CLIENT_SECRET, process.env.PAM_CUSTOMER_ID])).digest("hex");
  if (cached && cached.key === key && cached.expiresAt > Date.now()) return cached.token;
  if (pending?.key === key) return pending.promise;
  const promise = (async () => {
    const response = await call(base + "/pam/apps/autheticate/oauth/token-generation/", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: process.env.PAM_CLIENT_ID, client_secret: process.env.PAM_CLIENT_SECRET, customer: process.env.PAM_CUSTOMER_ID })
    });
    if (!response.ok) throw new PamError("ขอ token ไม่สำเร็จ (HTTP " + response.status + ") ตรวจสอบ Client ID, Secret, Customer ID และ endpoint ของเวอร์ชันที่ติดตั้ง", 502, response.status);
    const data = await response.json().catch(() => null);
    if (!data || typeof data.access_token !== "string" || !data.access_token) throw new PamError("PAM ไม่ส่ง access_token ในรูปแบบที่เอกสารระบุ");
    const minutes = Number(data.expires_in_minutes);
    const ttl = Number.isFinite(minutes) && minutes > 0 ? minutes * 60000 : 60000;
    cached = { token: data.access_token, expiresAt: Date.now() + Math.max(0, ttl - 30000), key };
    return data.access_token as string;
  })();
  pending = { key, promise };
  try { return await promise; } finally { if (pending?.promise === promise) pending = undefined; }
}
const privateField = /password|passwd|secret|token|api.?key|private.?key|credential|cookie|authorization|authorize/i;
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, privateField.test(key) ? "[REDACTED]" : redact(val)]));
  return value;
}
export async function readPamEndpoint(path: string, scope = "") {
  const base = baseUrl();
  const url = new URL(path, base);
  const allowed = [...apis.map(item => item.path), "/pam/apps/resources/", "/pam/apps/assets/allocated-users/", "/pam/apps/apps/allocated-users/", "/pam/apps/web_apps/user-allocation/", "/pam/apps/groups/groups/", "/pam/apps/ticket/tickets/", "/pam/apps/assets/systemuser/list/", "/pam/apps/api/certificates/", "/pam/apps/web_apps/web_app/", "/pam/apps/ticket/ticket-routing/", "/pam/apps/audits/generate-reports/", "/pam/apps/users/allocated-resource/", "/pam/apps/assets/resource-list-using-system-user/", "/pam/apps/assets/system-user-list-using-resource-type/"];
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
