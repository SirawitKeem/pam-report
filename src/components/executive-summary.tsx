"use client";
import { useState, type ReactNode } from "react";
import type { ExecutiveReport } from "@/lib/executive-model";
import { booleanCapabilities } from "@/lib/executive-model";
import { label, resourceName, type Row } from "@/lib/resource-model";
import coverBackground from "@/lib/bg1pam.png";
import coverLogo from "@/lib/logobam.png";

const chunks = <T,>(rows: T[], size: number): T[][] => rows.length ? Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size)) : [[]];
function Heading({ children, note }: { children: ReactNode; note?: string }) { return <div className="er-heading"><h2>{children}</h2>{note && <small>{note}</small>}</div>; }
function Note({ children }: { children: ReactNode }) { return <div className="er-note">{children}</div>; }
function accessSummary(role: Row, domain: "assets" | "apps") {
  const values = new Map(booleanCapabilities(role.capabilities).map(item => [item.path, item.enabled]));
  if (values.get(domain + ".view") === true) return "ดูทะเบียน";
  if (values.get("view_allocated_" + domain) === true || values.get(domain + ".view_allocated_" + domain) === true) return "ดูที่จัดสรร";
  return values.has(domain + ".view") || values.has("view_allocated_" + domain) ? "ไม่อนุญาตตามค่า API" : "ไม่ระบุ";
}
type Page = { title: string; subtitle: string; body: ReactNode };

export default function ExecutiveSummary({ initial }: { initial: ExecutiveReport }) {
  const [report, setReport] = useState<ExecutiveReport | null>(initial);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [technical, setTechnical] = useState(false);
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/executive-report" + window.location.search, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "ดึงข้อมูลไม่สำเร็จ"); setReport(data);
    } catch (e) { setReport(null); setError(e instanceof Error ? e.message : "ดึงข้อมูลไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `pam-report-${report.options.month}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const source = report?.resourceReport, users = source?.users, groups = report?.groups;
  const userRows = users?.rows ?? [], groupRows = groups?.rows ?? [];
  const resources = report?.details.filter(d => d.row) ?? [];
  const roles = new Map<string, { role: Row; members: Row[] }>();
  for (const user of userRows) {
    if (!user.role || typeof user.role !== "object" || Array.isArray(user.role)) continue;
    const role = user.role as Row, key = label(role.role_id ?? role.role_name);
    const entry = roles.get(key) ?? { role, members: [] }; entry.members.push(user); roles.set(key, entry);
  }
  const types = new Map<string, number>();
  for (const d of resources) { const type = label(d.row?.resource_sub_type ?? d.row?.asset_type ?? d.row?.app_type); types.set(type, (types.get(type) ?? 0) + 1); }
  const active = resources.filter(d => d.row?.active === true).length, inactive = resources.filter(d => d.row?.active === false).length;
  const time = source ? new Date(source.fetchedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false }) : "ยังไม่มีข้อมูล";
  const month = report?.options.month;
  const monthLabel = month && /^\d{4}-\d{2}$/.test(month) ? new Date(month + "-01T00:00:00+07:00").toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }) : "รอบปัจจุบัน";
  const allocationComplete = report?.allocations.filter(a => a.dataset.complete).length ?? 0;
  const inventoryComplete = Boolean(report?.discovery.inventoryComplete && !report.discovery.detailLimitReached && report.details.every(d => d.row));
  const coverage = [
    ["ผู้ใช้งาน PAM", users?.complete ? "ครบตามรายการ API" : "ข้อมูลยังไม่ครบ", `${userRows.length} บัญชีที่ได้รับ`],
    ["กลุ่มผู้ใช้งาน", groups?.complete ? "ครบตามรายการ API" : "ข้อมูลยังไม่ครบ", `${groupRows.length} กลุ่มที่ได้รับ`],
    ["เครื่อง / แอป", inventoryComplete ? "ครบตามรายการ API" : "ยังไม่ยืนยันครบทั้งระบบ", `${resources.length} รายการที่ยืนยัน ID ได้`],
    ["การจัดสรรผู้ใช้", allocationComplete ? "ได้รับข้อมูลบางรายการ" : "ยังไม่ได้รับข้อมูล", `${allocationComplete} / ${report?.allocations.length ?? 0} รายการที่ตรวจครบ`],
    ["กิจกรรมรายเดือน", "ยังไม่ยืนยันช่วงเวลา", "Audit API ยังต้องตรวจเพิ่มเติม"],
  ];
  const pages: Page[] = [];
  pages.push({ title: "สรุปสถานะระบบ PAM", subtitle: "บัญชี ทรัพยากร และประเด็นที่องค์กรควรติดตาม", body: <>
    <div className="er-hero"><div><span>MANAGEMENT SUMMARY</span><h2>บัญชีและทรัพยากร<br/>ภายใต้การควบคุม PAM</h2><p>ข้อมูลทะเบียนปัจจุบัน ณ {time}</p></div><div className="er-hero-mark">PAM<small>STATUS REPORT</small></div></div>
    <div className="er-kpis">{[["ผู้ใช้งาน PAM", users?.total ?? "—", "จำนวนตาม API"], ["กลุ่มผู้ใช้งาน", groups?.total ?? "—", "จำนวนตาม API"], ["เครื่อง / อุปกรณ์", resources.filter(d => d.kind === "Asset").length, "รายละเอียดที่ได้รับ"], ["แอป / ฐานข้อมูล", resources.filter(d => d.kind === "App").length, "รายละเอียดที่ได้รับ"]].map(([name, count, note]) => <section key={String(name)}><small>{name}</small><strong>{count}</strong><span>{note}</span></section>)}</div>
    <Heading>สาระสำคัญ</Heading><div className="er-facts"><p><b>{resources.length} ทรัพยากรที่ได้รับ</b> · เปิดใช้งาน {active} · ปิดใช้งาน {inactive} · ไม่ระบุ {resources.length - active - inactive}</p><p><b>{roles.size} บทบาทที่พบใน Users</b> · บัญชีที่ล็อก {users?.error ? "ยังไม่ทราบ" : userRows.filter(u => u.locked === true).length}</p><p><b>ผู้ได้รับสิทธิ์รายเครื่อง</b> {allocationComplete ? `มี ${allocationComplete} รายการที่ตรวจครบ` : "ยังไม่สามารถยืนยันได้จาก API"}</p></div>
    <Heading>ความครอบคลุมของข้อมูล</Heading><table className="er-table"><thead><tr><th>หมวดข้อมูล</th><th>ผลตรวจ</th><th>ขอบเขตที่ได้รับ</th></tr></thead><tbody>{coverage.map(([name, status, scope]) => <tr key={name}><td>{name}</td><td>{status}</td><td>{scope}</td></tr>)}</tbody></table>
    <Note><b>ประเด็นที่ต้องติดตาม</b><p>ยืนยันทะเบียน Resources ทั้งระบบ และเปิดอ่านการจัดสรร/ประวัติผ่าน OAuth เพื่อสรุปสิทธิ์และกิจกรรมรายเดือนได้ครบ ตัวเลขเครื่องและแอปนี้ยังไม่ใช้แทนยอดรวมทั้งระบบ</p></Note>
  </> });
  chunks(resources, 10).forEach((rows, index) => pages.push({ title: "ทะเบียนและสถานะทรัพยากร", subtitle: "ประเภท เครื่องปลายทาง และสิทธิ์ที่ตรวจสอบได้ในหน้าเดียว", body: <>
    {!index && <><Heading note={`${resources.length} รายการที่ได้รับ`}>ประเภทและสถานะทรัพยากรที่ได้รับ</Heading><div className="er-types">{[...types].map(([type, count]) => <div key={type}><span>{type}</span><b>{count}</b><i style={{ width: `${resources.length ? count / resources.length * 100 : 0}%` }} /></div>)}</div><p className="er-caption">เปิดใช้งาน {active} · ปิดใช้งาน {inactive} · ไม่ระบุ {resources.length - active - inactive} — active เป็นการตั้งค่า ไม่ใช่สถานะออนไลน์</p></>}
    <Heading note={index ? "ต่อจากหน้าก่อน" : "เครื่องและอุปกรณ์ / แอปพลิเคชันและฐานข้อมูล"}>รายละเอียดทรัพยากร</Heading>
    {rows.length ? <table className="er-table er-inventory"><thead><tr><th>ชื่อ / รหัส</th><th>ประเภท</th><th>ปลายทาง</th><th>สถานะ / ผู้ได้รับสิทธิ์</th></tr></thead><tbody>{rows.map(d => {
      const row = d.row!, allocated = report?.allocations.find(a => a.kind === d.kind && a.resourceId === d.requestedId)?.dataset;
      const names = allocated?.rows.map(item => { const nested = item.user && typeof item.user === "object" ? item.user as Row : undefined; const id = item.user_id ?? nested?.id ?? item.id; return label(item.username ?? nested?.username ?? userRows.find(u => String(u.id) === String(id))?.username ?? id); }) ?? [];
      return <tr key={d.kind + d.requestedId}><td><b>{resourceName(row)}</b><small>{d.kind} · ID {d.requestedId}</small></td><td>{label(row.resource_sub_type ?? row.asset_type ?? row.app_type)}<small>{label(row.asset_category ?? row.default_database)}</small></td><td>{label(row.ip_host ?? row.host)}<small>Port {label(row.port)}</small></td><td><span className={"er-pill " + (row.active === true ? "good" : "neutral")}>{row.active === true ? "เปิดใช้งาน" : row.active === false ? "ปิดใช้งาน" : "ไม่ระบุ"}</span><small>{names.length ? names.join(", ") + (allocated?.complete ? "" : " (บางส่วน)") : allocated?.complete ? "API ส่งรายการสิทธิ์ว่าง" : "ผู้ได้รับสิทธิ์: ยังไม่ทราบ"}</small></td></tr>;
    })}</tbody></table> : <Note>ยังไม่ได้รับรายละเอียดทรัพยากรที่ยืนยัน ID ได้</Note>}
    <Note><b>ขอบเขตทะเบียน</b><p>{report?.options.scanTo ? `ตรวจ Asset/Application ช่วง ID 1–${report.options.scanTo} รวมกับ ID ที่เลือกและรายการรวมที่ API ส่งกลับ` : "ตรวจตาม ID ที่เลือกและรายการรวมที่ได้รับ"} · {inventoryComplete ? "ครบตามรายการ API" : "ยังไม่ยืนยันครบทั้งระบบ"}</p><p>ผู้มีสิทธิ์เข้าถึงไม่ยืนยันว่าเป็นผู้รับผิดชอบเครื่อง ข้อมูลที่ไม่ได้รับแสดงเป็น “ยังไม่ทราบ”</p></Note>
  </> }));
  chunks(userRows, 10).forEach((rows, index) => pages.push({ title: "บัญชีผู้ใช้งานและบทบาท", subtitle: "ผู้ใช้งาน PAM และบทบาทที่กำหนดให้บัญชี", body: <>
    <Heading note={`${userRows.length} บัญชีที่ได้รับ${index ? " · ต่อ" : ""}`}>บัญชีผู้ใช้งาน PAM</Heading><table className="er-table"><thead><tr><th>บัญชี / ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th>สถานะ</th></tr></thead><tbody>{rows.map(u => <tr key={label(u.id)}><td><b>{label(u.username)}</b><small>{[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"} · ID {label(u.id)}</small></td><td>{label(u.email)}</td><td>{label(u.role)}</td><td>{u.locked === true ? "ล็อก" : u.locked === false ? "ไม่ล็อก" : "ไม่ระบุ"}<small>2FA: {label(u.second_factor_auth_type)}</small></td></tr>)}</tbody></table>
    {!index && roles.size <= 6 && <><Heading note="Role ที่แนบมากับ Users">สรุปบทบาท</Heading><table className="er-table"><thead><tr><th>บทบาท</th><th>จำนวนบัญชี</th><th>บัญชีที่มีบทบาท</th></tr></thead><tbody>{[...roles.values()].map(({ role, members }) => <tr key={label(role.role_id)}><td>{label(role.display_name ?? role.role_name)}</td><td>{members.length}</td><td>{members.map(u => label(u.username)).join(", ")}</td></tr>)}</tbody></table></>}
    <p className="er-caption">ผู้ใช้ PAM แยกจาก System User สำหรับเชื่อมต่อเครื่อง · บทบาทที่พบไม่ใช่ Roles ทั้งระบบ · ค่า 2FA แสดงตาม API</p>{users?.error && <Note>{users.error}</Note>}
  </> }));
  if (roles.size > 6) chunks([...roles.values()], 12).forEach(rows => pages.push({ title: "บทบาทของบัญชี", subtitle: "ข้อมูลจาก Users", body: <table className="er-table"><thead><tr><th>บทบาท</th><th>จำนวนบัญชี</th><th>สมาชิก</th></tr></thead><tbody>{rows.map(({ role, members }) => <tr key={label(role.role_id)}><td>{label(role.display_name ?? role.role_name)}</td><td>{members.length}</td><td>{members.map(u => label(u.username)).join(", ")}</td></tr>)}</tbody></table> }));
  chunks(groupRows, 6).forEach((rows, index) => pages.push({ title: "กลุ่มและการควบคุมสิทธิ์", subtitle: "สมาชิกกลุ่มและความสามารถของบทบาท", body: <>
    <Heading note={`${groupRows.length} กลุ่มที่ได้รับ`}>กลุ่มผู้ใช้งาน</Heading><table className="er-table"><thead><tr><th>กลุ่ม / แหล่งที่มา</th><th>สมาชิกตาม API</th><th>บัญชีที่ระบุ</th></tr></thead><tbody>{rows.map(g => <tr key={label(g.group_id)}><td><b>{label(g.group_display_name ?? g.group_name)}</b><small>{label(g.source)} · ID {label(g.group_id)}</small></td><td>{label(g.member_count)}</td><td>{Array.isArray(g.users) ? g.users.map(id => label(userRows.find(u => String(u.id) === String(id))?.username ?? id)).join(", ") || "API ส่งรายการว่าง" : "ยังไม่ทราบ"}</td></tr>)}</tbody></table>
    {!index && roles.size <= 6 && <><Heading note="ไม่ใช่ OAuth scope หรือการจัดสรรเครื่อง">สิทธิ์ดูข้อมูลทรัพยากรตามบทบาท</Heading><table className="er-table"><thead><tr><th>บทบาท</th><th>เครื่อง / อุปกรณ์</th><th>แอป / ฐานข้อมูล</th></tr></thead><tbody>{[...roles.values()].map(({ role }) => <tr key={label(role.role_id)}><td>{label(role.display_name ?? role.role_name)}</td><td>{accessSummary(role, "assets")}</td><td>{accessSummary(role, "apps")}</td></tr>)}</tbody></table></>}
    <Note><b>การตีความสิทธิ์</b><p>สมาชิกกลุ่มและความสามารถของบทบาทยังไม่ยืนยันว่าเข้าถึงเครื่องใด ต้องตรวจ Asset Allocation รวมถึงเงื่อนไขเวลาและการจัดสรรผ่าน User/Group/Role</p><p>การจัดสรรที่ตรวจครบ {allocationComplete} / {report?.allocations.length ?? 0} รายการ · System Users / Certificates ยังต้องได้รับข้อมูลก่อนสรุปการควบคุมส่วนนี้</p></Note>{groups?.error && <Note>{groups.error}</Note>}
  </> }));
  pages.push({ title: "รอบรายงานและประเด็นติดตาม", subtitle: "ความพร้อมของรายงานรายเดือนและข้อมูลที่ยังขาด", body: <>
    <Heading note={monthLabel}>รายงานสถานะประจำเดือน</Heading><Note><b>ภาพสถานะปัจจุบัน ณ {time}</b><p>เดือนที่เลือกเป็นรอบจัดทำเอกสาร ไม่กรองทะเบียนปัจจุบันย้อนหลัง และไม่ใช้ยืนยันสถานะ ณ สิ้นเดือนที่ผ่านมา</p></Note><p>{report?.monthly.reason}</p>
    <table className="er-table"><thead><tr><th>รายงานได้ตอนนี้</th><th>ต้องมีข้อมูลประวัติเพิ่มเติม</th></tr></thead><tbody><tr><td>บัญชี กลุ่ม ทรัพยากร และการตั้งค่า ณ เวลาดึง</td><td>การเข้าใช้งาน จำนวนครั้ง/ระยะเวลา และแนวโน้มรายเดือน</td></tr><tr><td>ประเภทและสถานะเปิดใช้งานจากทะเบียน</td><td>การเพิ่ม/ลบทรัพยากร และการเพิ่ม/ถอนสิทธิ์ในช่วงวันที่</td></tr></tbody></table>
    <Heading>ลำดับงานที่องค์กรควรติดตาม</Heading><ol className="er-actions"><li><b>ยืนยันทะเบียนทั้งหมด</b><span>ทำให้ Resources API ดึงทุกหน้าได้ หรือใช้ทะเบียน ID จากระบบเทียบความครบถ้วน ไม่ใช้ช่วงค้นหาแทนยอดรวม</span></li><li><b>ยืนยันการจัดสรรและเงื่อนไขสิทธิ์</b><span>ตรวจคำขอที่ตอบ 403 และการรองรับ OAuth จากนั้นจับคู่ User ID กับทะเบียนผู้ใช้</span></li><li><b>เปิดประวัติสำหรับรายเดือน</b><span>ยืนยัน Audit API ตัวกรองวันที่ เขตเวลา และ pagination ก่อนสรุปยอดกิจกรรมย้อนหลัง</span></li></ol>
    <p className="er-caption">Ticket automation: {report?.ticketAutomation === true ? "เปิด" : report?.ticketAutomation === false ? "ปิด" : "ยังไม่ทราบ"} — ไม่ใช่จำนวนคำขอหรือผลอนุมัติ</p>
  </> });
  if (technical) chunks(report?.checks ?? [], 15).forEach(rows => pages.push({ title: "ภาคผนวกแหล่งข้อมูล", subtitle: "รายละเอียดสำหรับทีมระบบ", body: <><p className="er-caption">ตรวจ GET เท่านั้น · 403/500 ต้องตรวจสิทธิ์ การรองรับ OAuth พารามิเตอร์ และ log · ไม่ใช้ผลผิดพลาดของ ID ที่ค้นหาเป็นรายการทรัพยากร</p><table className="er-table er-technical"><thead><tr><th>แหล่งข้อมูล</th><th>HTTP</th><th>Endpoint</th></tr></thead><tbody>{rows.map((c, i) => <tr key={i}><td>{c.name}</td><td>{c.status ?? "—"}</td><td>{c.endpoint}</td></tr>)}</tbody></table></> }));
  return <main className="er-canvas"><div className="er-toolbar no-print"><div><b>PAM / REPORT</b><span>รายงานสรุปสำหรับองค์กร · A4</span></div><div><button className="button primary" onClick={refresh} disabled={busy}>{busy ? "กำลังดึง / ค้นหา…" : "ดึงข้อมูลใหม่"}</button><button className="button quiet" onClick={download} disabled={!report}>ข้อมูล JSON</button><button className="button dark" onClick={() => window.print()} disabled={!report}>พิมพ์ / PDF</button></div></div>
    <details className="er-controls no-print"><summary>ตั้งค่ารอบรายงานและขอบเขตค้นหา</summary><form action="/" method="get"><label>รอบจัดทำเอกสาร<input type="month" name="month" defaultValue={report?.options.month} /></label><label>ค้นหา Asset/App ถึง ID<input type="number" min="0" max="1000" name="scanTo" defaultValue={report?.options.scanTo ?? 0} /></label><label>Asset IDs เพิ่มเติม<input name="assets" defaultValue={report?.selection.assets.join(",") ?? ""} /></label><label>App IDs เพิ่มเติม<input name="applications" defaultValue={report?.selection.applications.join(",") ?? ""} /></label><label>WebApp IDs<input name="webApps" defaultValue={report?.selection.webApps.join(",") ?? ""} /></label><button className="button primary">จัดทำรายงาน</button></form><p>0 ปิดการค้นหาช่วง ID · ช่วงที่ตรวจครบไม่ยืนยันครบทั้งระบบ · เดือนเป็นรอบเอกสาร ข้อมูลยังเป็นสถานะ ณ เวลาดึง</p><label className="er-checkbox"><input type="checkbox" checked={technical} onChange={e => setTechnical(e.target.checked)} /> รวมภาคผนวก Endpoint / HTTP ในเอกสาร</label></details>
    <div className="er-live no-print"><i /><span>ข้อมูลสดจาก PAM · ตรวจรายรายการ {report?.discovery.attempts.length ?? 0} คำขอ · ได้รายละเอียด {resources.length} รายการ · {inventoryComplete ? "ครบตาม API" : "ยังไม่ยืนยันครบทั้งระบบ"}</span></div>
    {error && <p className="rr-alert" role="alert">{error}</p>}
    {report && <article className="er-cover" aria-label="หน้าปกรายงาน PAM">
      <img className="er-cover-background" src={coverBackground.src} alt="" aria-hidden="true" />
      <img className="er-cover-logo" src={coverLogo.src} alt="โลโก้องค์กร" />
      <div className="er-cover-title"><span className="er-cover-label">REPORT</span><i className="er-cover-rule" /><h1><strong>Privileged Access</strong><span>Management</span></h1><p>Resource &amp; Access Management Report</p></div>
      <div className="er-cover-meta"><span className="er-cover-meta-label">REPORTING PERIOD</span><b>{monthLabel}</b><p>รายงานสรุปสถานะระบบ PAM</p><small>ข้อมูล ณ {time}<br />{source?.baseUrl}</small></div>
      <div className="er-cover-footer">INTERNAL REPORT <span>ข้อมูลสถานะ ณ วันที่จัดทำ</span></div>
    </article>}
    {!report ? <article className="er-sheet"><Note>ยังไม่มีข้อมูลสำหรับรายงาน กรุณาดึงใหม่</Note></article> : pages.map((page, index) => <article className="er-sheet" key={index}><header className="er-header"><div><span>PAM GOVERNANCE / {String(index + 1).padStart(2, "0")}</span><h1>{page.title}</h1><p>{page.subtitle}</p></div><div className="er-period"><b>{monthLabel}</b><small>ภาพสถานะปัจจุบัน</small></div></header><div className="er-meta"><span>ระบบ <b>{source?.baseUrl}</b></span><span>ดึงข้อมูล <b>{time}</b></span></div><div className="er-content">{page.body}</div><footer className="er-footer"><span>INTERNAL · ข้อมูล ณ เวลาดึง · ไม่แสดงรหัสผ่านหรือ Token</span><span>{index + 1} / {pages.length}</span></footer></article>)}
    <details className="er-controls no-print"><summary>ผลตรวจทางเทคนิคและข้อมูลที่ยังขาด</summary><p>ข้อมูลทั้งหมดที่ได้รับ รวม group details, ticket settings, ผลค้นหา ID และ Audit อยู่ในปุ่มข้อมูล JSON ที่ปิดบังฟิลด์ลับแล้ว</p><table className="er-table er-technical"><thead><tr><th>แหล่งข้อมูล</th><th>HTTP</th><th>Endpoint</th></tr></thead><tbody>{(report?.checks ?? []).filter(c => !c.ok).map((c, i) => <tr key={i}><td>{c.name}</td><td>{c.status ?? "—"}</td><td>{c.endpoint}</td></tr>)}</tbody></table></details>
  </main>;
}
