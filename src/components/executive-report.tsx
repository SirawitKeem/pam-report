"use client";
import { useState, type ReactNode } from "react";
import type { ExecutiveReport } from "@/lib/executive-model";
import { label, resourceName, type Row } from "@/lib/resource-model";
import { booleanCapabilities, sourceRows } from "@/lib/executive-model";

function chunks<T>(rows: T[], size: number): T[][] {
  return rows.length ? Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size)) : [[]];
}
function Empty({ children }: { children: ReactNode }) { return <div className="rr-empty">{children}</div>; }
function bool(value: unknown) { return value === true ? "ล็อก" : value === false ? "ไม่ล็อก" : "ไม่ระบุ"; }
function ids(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

export default function ExecutiveReportView({ initial }: { initial: ExecutiveReport }) {
  const [report, setReport] = useState<ExecutiveReport | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/executive-report" + window.location.search, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ดึงข้อมูลไม่สำเร็จ");
      setReport(data);
    } catch (e) { setReport(null); setError(e instanceof Error ? e.message : "ดึงข้อมูลไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "pam-report.json"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const source = report?.resourceReport;
  const users = source?.users;
  const resources = source?.resources;
  const groups = report?.groups;
  const userRows = users?.rows ?? [];
  const groupRows = groups?.rows ?? [];
  const locked = userRows.filter(row => row.locked === true).length;
  const unknownLock = userRows.filter(row => typeof row.locked !== "boolean").length;
  const roles = new Map<string, { role: Row; users: Row[] }>();
  for (const user of userRows) {
    if (!user.role || typeof user.role !== "object" || Array.isArray(user.role)) continue;
    const role = user.role as Row;
    const key = String(role.role_id ?? role.role_name ?? role.display_name);
    const item = roles.get(key) ?? { role, users: [] }; item.users.push(user); roles.set(key, item);
  }
  const time = source ? new Date(source.fetchedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false }) : "ยังไม่มีข้อมูล";
  const sections: { title: string; subtitle: string; content: ReactNode }[] = [];
  sections.push({ title: "ภาพรวมระบบ PAM", subtitle: "ข้อมูลบัญชีผู้ใช้ กลุ่ม และความครบถ้วนของรายงาน", content: <>
    <div className="rr-summary"><section><small>ผู้ใช้งานทั้งหมด</small><strong>{users?.total ?? "—"}</strong><span>{users?.complete ? "ได้รับรายชื่อครบตาม API" : "ยังไม่ยืนยันรายการครบ"}</span></section><section><small>กลุ่มผู้ใช้งานทั้งหมด</small><strong>{groups?.total ?? "—"}</strong><span>{groups?.complete ? "ได้รับรายการครบตาม API" : "ยังไม่ยืนยันรายการครบ"}</span></section><section><small>Resources ทั้งหมด</small><strong>{resources?.total ?? "—"}</strong><span>{resources?.complete ? "ได้รับรายการครบตาม API" : "ยังไม่ทราบจำนวนทั้งหมด"}</span></section></div>
    <section className="rr-section"><h2>ข้อมูลที่รายงานนี้อธิบายได้</h2><p>รายชื่อและสถานะบัญชีผู้ใช้ บทบาทที่แนบมากับบัญชี และสมาชิกของกลุ่มที่ API ส่งกลับมา</p><p>บัญชีที่ล็อกในรายการที่ได้รับ: <b>{users?.error ? "ยังไม่ทราบ" : locked}</b>{unknownLock > 0 && ` · ไม่ระบุสถานะ ${unknownLock} บัญชี`}</p><p>บทบาทที่พบในบัญชีที่ได้รับ: <b>{users?.error ? "ยังไม่ทราบ" : roles.size}</b> ประเภท — ไม่ใช่จำนวนบทบาททั้งหมดในระบบ</p></section>
    <p>รายละเอียดทรัพยากรที่ดึงสำเร็จในรอบนี้: <b>{report?.details.filter(detail => detail.row).length ?? 0}</b> รายการจากรหัสที่เลือกและรายการ API ที่ได้รับ ไม่ใช่จำนวนทรัพยากรทั้งหมด</p>
    <p>การใช้ Ticket automation ตาม API: <b>{report?.ticketAutomation === true ? "เปิด" : report?.ticketAutomation === false ? "ปิด" : "ยังไม่ทราบ"}</b> — แยกจากจำนวน Tickets และสถานะอนุมัติคำขอ</p>
    <section className="rr-section"><h2>ข้อมูลที่ยังต้องตรวจสอบ</h2><div className="rr-status"><b>{resources?.complete ? "ตรวจสอบข้อมูลการจัดสรรในหน้าทรัพยากร" : "ยังสรุปจำนวนเครื่องและผู้เข้าถึงแต่ละเครื่องไม่ได้"}</b><p>จำนวน Resources ที่ยังดึงไม่ได้แสดงเป็น “—” ไม่ใช้ค่า 0 แทนข้อมูลที่ขาด</p><p>การเป็นสมาชิกกลุ่มหรือมีสิทธิ์เข้าถึงทรัพยากร ไม่ยืนยันว่าเป็นผู้รับผิดชอบเครื่อง</p></div></section>
    <table className="rr-table"><thead><tr><th>หมวดข้อมูล</th><th>ความครบถ้วน</th><th>ความหมาย</th></tr></thead><tbody>{[["ผู้ใช้", users], ["กลุ่ม", groups], ["ทรัพยากร", resources]].map(([name, value]) => { const data = value as typeof users; return <tr key={String(name)}><td>{String(name)}</td><td>{data?.error ? "ดึงไม่สำเร็จ" : data?.complete ? "ครบตามรายการ API" : "ข้อมูลบางส่วน"}</td><td>{data?.error ? "ยังสรุปจำนวนไม่ได้" : `${data?.rows.length ?? 0} รายการที่ได้รับ`}</td></tr>; })}</tbody></table>
  </> });
  chunks(userRows, 15).forEach((rows, index) => sections.push({ title: "บัญชีผู้ใช้งาน PAM", subtitle: `รายชื่อ บทบาท และสถานะบัญชี${index ? " · ต่อ" : ""}`, content: <>
    <p className="rr-explanation">ผู้ใช้ PAM คือบัญชีที่เข้าใช้งานระบบนี้ แยกจากบัญชี System User ที่ใช้เชื่อมต่อเครื่องปลายทาง</p>
    {users?.error && <Empty>{users.error}</Empty>}
    {rows.length ? <table className="rr-table"><thead><tr><th>ผู้ใช้ / ชื่อ</th><th>อีเมล</th><th>บทบาท</th><th>ล็อกบัญชี / 2FA</th></tr></thead><tbody>{rows.map((row, i) => <tr key={String(row.id ?? i)}><td><b>{label(row.username)}</b><small>{[row.first_name, row.last_name].filter(Boolean).join(" ") || "ไม่ระบุชื่อ"}</small></td><td>{label(row.email)}</td><td>{label(row.role)}</td><td>{bool(row.locked)}<small>2FA: {label(row.second_factor_auth_type)}</small></td></tr>)}</tbody></table> : !users?.error && <Empty>API ไม่ส่งรายการผู้ใช้</Empty>}
  </> }));
  chunks([...roles.values()], 8).forEach((rows, index) => sections.push({ title: "บทบาทของผู้ใช้งาน", subtitle: `บทบาทที่พบจากข้อมูลบัญชีผู้ใช้${index ? " · ต่อ" : ""}`, content: <>
    <p className="rr-explanation">อ้างอิง Role ที่แนบมากับ Users ไม่ใช่รายการ Roles ทั้งระบบ และจำนวนด้านล่างนับจากผู้ใช้ที่ดึงได้</p>
    {rows.length ? <table className="rr-table"><thead><tr><th>บทบาท</th><th>จำนวนผู้ใช้ที่พบ</th><th>บัญชีที่มีบทบาทนี้</th></tr></thead><tbody>{rows.map(({ role, users: members }) => <tr key={String(role.role_id ?? role.role_name)}><td><b>{label(role.display_name ?? role.role_name)}</b><small>ID {label(role.role_id)}</small></td><td>{members.length}</td><td>{members.map(user => label(user.username)).join(", ")}</td></tr>)}</tbody></table> : <Empty>ยังไม่มีข้อมูลบทบาทจากบัญชีผู้ใช้</Empty>}
  </> }));
  chunks(groupRows, 8).forEach((rows, index) => sections.push({ title: "กลุ่มและสมาชิก", subtitle: `การจัดกลุ่มบัญชีผู้ใช้งาน${index ? " · ต่อ" : ""}`, content: <>
    <p className="rr-explanation">ชื่อสมาชิกจับคู่จากรหัส users ในข้อมูล Groups กับ id ในข้อมูล Users หากจับคู่ไม่ได้จะแสดงรหัสที่ได้รับ</p>
    {groups?.error && <Empty>{groups.error}</Empty>}
    {rows.length ? <table className="rr-table"><thead><tr><th>กลุ่ม / แหล่งที่มา</th><th>สมาชิกตาม API</th><th>สมาชิกที่ระบุ</th><th>ทรัพยากรที่แนบกับกลุ่ม</th></tr></thead><tbody>{rows.map((row, i) => <tr key={String(row.group_id ?? i)}><td><b>{label(row.group_display_name ?? row.group_name)}</b><small>{label(row.source)}</small></td><td>{label(row.member_count)}</td><td>{Array.isArray(row.users) ? ids(row.users).map(id => { const user = userRows.find(user => String(user.id) === String(id)); return user ? label(user.username) : "ID " + label(id); }).join(", ") || "ไม่มีสมาชิกในรายการ" : "ไม่ระบุ"}</td><td>{["assets", "apps", "application_credentials"].map(key => <small key={key}>{key}: {Array.isArray(row[key]) ? ids(row[key]).length : "ไม่ระบุ"}</small>)}</td></tr>)}</tbody></table> : !groups?.error && <Empty>API ไม่ส่งรายการกลุ่ม</Empty>}
    <p className="rr-explanation">จำนวนทรัพยากรในหน้านี้เป็นรายการที่แนบกับแต่ละกลุ่มเท่านั้น ไม่ใช่จำนวนทรัพยากรทั้งหมดหรือสิทธิ์ทั้งหมดของสมาชิก</p>
  </> }));
  const receivedDetails = report?.details.filter(detail => detail.row) ?? [];
  const typeCounts = new Map<string, number>();
  for (const detail of receivedDetails) {
    const key = detail.kind + " / " + label(detail.row?.resource_sub_type ?? detail.row?.asset_type ?? detail.row?.app_type);
    typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1);
  }
  chunks([...typeCounts], 14).forEach((rows, index) => sections.push({ title: "ประเภทและสถานะทรัพยากรที่ได้รับ", subtitle: `สรุปเฉพาะรายละเอียดที่ API ดึงสำเร็จ${index ? " · ต่อ" : ""}`, content: <>
    <p>ได้รับรายละเอียด <b>{receivedDetails.length}</b> รายการ · เปิดใช้งาน {receivedDetails.filter(d => d.row?.active === true).length} · ปิดใช้งาน {receivedDetails.filter(d => d.row?.active === false).length} · ไม่ระบุสถานะ {receivedDetails.filter(d => typeof d.row?.active !== "boolean").length}</p>
    <p className="rr-explanation">นับจากรหัสที่เลือกและ API รายการรวมที่ดึงได้ ไม่ใช่จำนวน Resources ทั้งระบบ การเปิดใช้งานเป็นค่าการตั้งค่า active ไม่ยืนยันว่าเครื่องออนไลน์</p>
    {rows.length ? <table className="rr-table"><thead><tr><th>หมวด / ประเภทตาม API</th><th>จำนวนที่ได้รับ</th></tr></thead><tbody>{rows.map(([type, count]) => <tr key={type}><td>{type}</td><td>{count}</td></tr>)}</tbody></table> : <Empty>ยังไม่ได้รับรายละเอียดทรัพยากร</Empty>}
  </> }));
  const capabilityRows = [...roles.values()].flatMap(({ role }) => {
    const categories = new Map<string, { enabled: number; disabled: number }>();
    for (const item of booleanCapabilities(role.capabilities)) {
      const category = item.path.split(".")[0];
      const counts = categories.get(category) ?? { enabled: 0, disabled: 0 };
      counts[item.enabled ? "enabled" : "disabled"]++; categories.set(category, counts);
    }
    return [...categories].map(([category, counts]) => ({ role, category, ...counts }));
  });
  chunks(capabilityRows, 14).forEach((rows, index) => sections.push({ title: "ความสามารถของบทบาทที่ได้รับ", subtitle: `สิทธิ์ที่แนบมากับข้อมูล Users${index ? " · ต่อ" : ""}`, content: <>
    <p className="rr-explanation">นับเฉพาะค่า true/false ใน role.capabilities ตามหมวด API ข้อมูลนี้เป็นสิทธิ์ของบทบาทผู้ใช้ ไม่ใช่ OAuth scope และไม่ยืนยันการจัดสรรเครื่อง</p>
    {rows.length ? <table className="rr-table"><thead><tr><th>บทบาท</th><th>หมวดตาม API</th><th>อนุญาต</th><th>ไม่อนุญาต</th></tr></thead><tbody>{rows.map(row => <tr key={label(row.role.role_id) + row.category}><td>{label(row.role.display_name ?? row.role.role_name)}</td><td>{row.category}</td><td>{row.enabled}</td><td>{row.disabled}</td></tr>)}</tbody></table> : <Empty>API ไม่ส่งค่า capabilities ที่อ่านได้</Empty>}
  </> }));
  for (const [kind, title] of [["Asset", "รายละเอียดเครื่องและอุปกรณ์"], ["App", "รายละเอียดแอปพลิเคชันและฐานข้อมูล"], ["WebApp", "รายละเอียด Web Applications"]] as const) {
    const selected = report?.details.filter(detail => detail.kind === kind) ?? [];
    if (!selected.length) continue;
    chunks(selected, 12).forEach((rows, index) => sections.push({ title, subtitle: `ข้อมูลสดจาก API รายรายการ${index ? " · ต่อ" : ""}`, content: <>
      <p className="rr-explanation">ดึงรายละเอียดตามรหัสที่เลือก หรือรหัสที่ได้รับจากรายการ Resources ตัวเลขนี้ไม่ยืนยันว่าครบทั้งระบบ</p>
      <table className="rr-table"><thead><tr><th>รหัส / ชื่อ</th><th>ประเภท</th><th>Host / IP</th><th>Port / สถานะ</th></tr></thead><tbody>{rows.map(detail => <tr key={detail.requestedId}><td><b>{detail.row ? resourceName(detail.row) : "ยังไม่ได้รับรายละเอียด"}</b><small>ID {detail.requestedId} · HTTP {detail.status ?? "ไม่ทราบ"}</small></td><td>{detail.row ? label(detail.row.resource_sub_type ?? detail.row.asset_type ?? detail.row.app_type) : "—"}</td><td>{detail.row ? label(detail.row.ip_host ?? detail.row.host) : "—"}</td><td>{detail.row ? <>{label(detail.row.port)}<small>{detail.row.active === true ? "เปิดใช้งาน" : detail.row.active === false ? "ปิดใช้งาน" : "ไม่ระบุสถานะ"}</small></> : detail.error}</td></tr>)}</tbody></table>
      <p className="rr-explanation">รายงานหน้านี้ยังไม่มีข้อมูลการจัดสรรผู้ใช้หรือผู้รับผิดชอบของเครื่อง หาก API ความสัมพันธ์ยังดึงไม่ได้</p>
    </> }));
  }
  chunks(report?.allocations ?? [], 10).forEach((rows, index) => sections.push({ title: "ผู้มีสิทธิ์เข้าถึงทรัพยากร", subtitle: `ตรวจการจัดสรรจาก API ของแต่ละรายการ${index ? " · ต่อ" : ""}`, content: <>
    <p className="rr-explanation">ตรวจจาก Asset/App ที่ได้รับรายละเอียดจริง แม้รายการ Resources รวมยังดึงไม่ได้ ผู้มีสิทธิ์เข้าถึงไม่ยืนยันว่าเป็นผู้รับผิดชอบเครื่อง</p>
    {rows.length ? <table className="rr-table"><thead><tr><th>ทรัพยากร</th><th>ผลตรวจ / ความครบถ้วน</th><th>ผู้ใช้ที่ API ระบุ</th></tr></thead><tbody>{rows.map(item => {
      const detail = receivedDetails.find(detail => detail.kind === item.kind && detail.requestedId === item.resourceId);
      const names = item.dataset.rows.map(row => {
        const nested = row.user && typeof row.user === "object" ? row.user as Row : undefined;
        const id = row.user_id ?? nested?.id ?? row.id;
        const user = userRows.find(user => String(user.id) === String(id));
        return label(row.username ?? nested?.username ?? user?.username ?? id);
      });
      return <tr key={item.kind + item.resourceId}><td><b>{detail?.row ? resourceName(detail.row) : item.kind}</b><small>{item.kind} ID {item.resourceId}</small></td><td>HTTP {item.dataset.status ?? "—"}<small>{item.dataset.error ? item.dataset.rows.length ? "ได้รับบางส่วน แต่ดึงต่อไม่สำเร็จ" : "ยังไม่ได้รับรายการ" : item.dataset.complete ? "ครบตาม API" : "ข้อมูลบางส่วน"}</small></td><td>{names.join(", ") || (item.dataset.error ? "ยังไม่ทราบ" : item.dataset.complete ? "API ส่งรายการว่าง" : "ยังไม่มีรายการที่ยืนยัน")}</td></tr>;
    })}</tbody></table> : <Empty>ยังไม่มี Asset/App ที่ใช้ตรวจการจัดสรรได้</Empty>}
  </> }));
  for (const source of report?.sources ?? []) {
    const rows = sourceRows(source.data);
    const columns = [...new Set((rows ?? []).flatMap(row => Object.keys(row)))].filter(key => (rows ?? []).some(row => typeof row[key] !== "object")).slice(0, 6);
    chunks(rows ?? [], 12).forEach((items, index) => sections.push({ title: source.name, subtitle: `ข้อมูลเพิ่มเติมและผลการดึง API${index ? " · ต่อ" : ""}`, content: <>
      <p>ผลตรวจ: <b>HTTP {source.status ?? "—"}</b> · {source.ok ? "ได้รับ JSON" : "ยังไม่ได้รับข้อมูล"}</p>
      {!source.ok ? <div className="rr-status"><b>ยังสรุปจำนวนและรายละเอียดหมวดนี้ไม่ได้</b><p>{source.error}</p><p>{source.status === 403 ? "ทีม PAM ต้องตรวจว่า endpoint นี้รองรับ Client Credentials และสิทธิ์ของ client ที่ใช้หรือไม่" : source.status === 500 ? "ทีม PAM ต้องตรวจ server log และพารามิเตอร์ของคำขอ OAuth นี้" : "ทีม PAM ต้องยืนยัน endpoint ของรุ่นที่ติดตั้ง"}</p></div> : items.length && columns.length ? <table className="rr-table"><thead><tr>{columns.map(key => <th key={key}>{key}</th>)}</tr></thead><tbody>{items.map((row, i) => <tr key={i}>{columns.map(key => <td key={key}>{label(row[key])}</td>)}</tr>)}</tbody></table> : <Empty>{rows?.length === 0 ? "API ส่งรายการว่างในคำขอนี้" : "ได้รับ JSON แต่ยังไม่มีโครงสร้างรายการที่ยืนยันได้ ดูข้อมูลที่ปิดบังฟิลด์ลับผ่านดาวน์โหลด JSON"}</Empty>}
      <p className="rr-explanation">{source.endpoint}</p><p className="rr-explanation">ผลรายการหมวดนี้มาจากคำขอที่ระบุ ยังไม่ยืนยันการดึงครบทุกหน้า ฟิลด์อื่นที่ได้รับอยู่ในไฟล์ JSON ที่ดาวน์โหลดได้</p>
    </> }));
  }
  chunks(resources?.rows ?? [], 15).forEach((rows, index) => sections.push({ title: "ทรัพยากรและการเข้าถึง", subtitle: `เครื่อง แอปพลิเคชัน และข้อมูลการจัดสรร${index ? " · ต่อ" : ""}`, content: <>
    {resources?.error && <div className="rr-status"><b>ยังไม่ได้รับรายการทรัพยากร</b><p>ระบบ PAM ตอบ HTTP {resources.status ?? "ไม่ทราบ"} จึงยังสรุปจำนวน ประเภท และบัญชีที่เข้าถึงแต่ละเครื่องไม่ได้</p><p>ข้อมูลส่วนนี้ยังไม่ครบสำหรับใช้ตัดสินใจด้านการจัดสรรเครื่อง</p></div>}
    {rows.length ? <table className="rr-table"><thead><tr><th>ทรัพยากร</th><th>ประเภท</th><th>Host / IP</th><th>ผู้ใช้ที่ API ระบุ</th></tr></thead><tbody>{rows.map((row, i) => { const key = label(row.resource_type) + ":" + label(row.id); const linked = source?.assignments.filter(item => item.resourceKey === key) ?? []; return <tr key={String(row.id ?? i)}><td>{resourceName(row)}</td><td>{label(row.resource_type)}<small>{label(row.resource_sub_type)}</small></td><td>{label(row.ip_host ?? row.host ?? row.ip_address)}</td><td>{linked.length ? linked.map(item => item.username).join(", ") : source?.allocationComplete ? "ไม่มีรายการที่ API ส่งกลับ" : "ยังดึงไม่ครบ"}</td></tr>; })}</tbody></table> : !resources?.error && <Empty>{resources?.complete ? "API ส่งรายการว่าง" : "ยังไม่มีรายการทรัพยากร"}</Empty>}
    <p className="rr-explanation">ข้อมูลการจัดสรรบอกความสัมพันธ์ที่ API ส่งมา การระบุผู้รับผิดชอบต้องมีข้อมูลผู้ดูแลโดยตรงเพิ่มเติม</p>
  </> }));
  chunks(report?.checks ?? [], 12).forEach((checks, index) => sections.push({ title: "ความครบถ้วนและแหล่งข้อมูล", subtitle: "รายละเอียดสำหรับผู้ตรวจสอบรายงานและทีมระบบ" + (index ? " · ต่อ" : ""), content: <>
    <p className="rr-explanation">ตรวจ GET เท่านั้น สถานะสำเร็จไม่ได้ยืนยันว่า POST, PUT หรือ DELETE ใช้งานได้ครบทุกฟังก์ชัน</p>
    <table className="rr-table ex-checks"><thead><tr><th>แหล่งข้อมูล</th><th>ผลทดสอบ</th><th>Endpoint</th></tr></thead><tbody>{checks.map((check, i) => <tr key={i}><td>{check.name}</td><td>{check.status ? "HTTP " + check.status : "เชื่อมต่อไม่ได้"}<small>{check.ok ? "ได้รับ JSON" : "ดึงไม่สำเร็จ"}</small></td><td>{check.endpoint}</td></tr>)}</tbody></table>
    <p className="rr-explanation">500: เซิร์ฟเวอร์ประมวลผลไม่สำเร็จ ต้องตรวจพารามิเตอร์และ log · 403: ปฏิเสธสิทธิ์ · 404: ไม่พบ URL ที่ทดสอบ</p>
  </> }));
  return <main className="rr-canvas ex-canvas">
    <div className="rr-toolbar no-print"><div><b>PAM REPORT</b><span>รายงานสำหรับผู้บริหาร · A4</span></div><div><button className="button primary" onClick={refresh} disabled={busy}>{busy ? "กำลังดึงข้อมูล…" : "ดึงข้อมูลใหม่"}</button><button className="button quiet" onClick={download} disabled={!report}>ดาวน์โหลด JSON</button><button className="button dark" onClick={() => window.print()} disabled={!report}>พิมพ์ / PDF</button></div></div>
    <details className="ex-selection no-print"><summary>เลือกรหัสทรัพยากรเพื่อดึงรายละเอียดจาก API</summary><p>ใช้รหัสที่ตรวจจากระบบจริง คั่นด้วย comma เมื่อ API รายการรวมยังดึงไม่ได้ หน้านี้จะรายงานเฉพาะรหัสที่เลือก</p><form action="/" method="get"><label>Asset IDs<input name="assets" defaultValue={report?.selection.assets.join(",") ?? ""} /></label><label>Application IDs<input name="applications" defaultValue={report?.selection.applications.join(",") ?? ""} /></label><label>WebApp IDs<input name="webApps" defaultValue={report?.selection.webApps.join(",") ?? ""} /></label><button className="button primary">ดึงรายละเอียด</button></form></details>
    {error && <p className="rr-alert" role="alert">{error}</p>}
    {!report ? <article className="rr-sheet"><Empty>ยังไม่มีข้อมูลสำหรับรายงาน กรุณาดึงข้อมูลใหม่</Empty></article> : sections.map((section, i) => <article className="rr-sheet ex-sheet" key={i}>
      <header className="rr-header"><div><span className="rr-kicker">PRIVILEGED ACCESS MANAGEMENT</span><h1>{section.title}</h1><p>{section.subtitle}</p></div><span className="rr-badge">PAM<br/>REPORT</span></header>
      <div className="rr-meta"><div><small>ระบบ</small><b>{source?.baseUrl || "ไม่ระบุ"}</b></div><div><small>ดึงข้อมูลเมื่อ</small><b>{time}</b></div></div>
      <div className="ex-content">{section.content}</div>
      <div className="rr-footnote">ข้อมูลจาก API ณ เวลาที่ระบุ · “—” หมายถึงไม่ทราบค่า · รายงานไม่แสดงรหัสผ่านหรือ Access Token</div>
      <footer className="rr-footer"><span>PAM · INTERNAL REPORT</span><span>หน้า {i + 1} / {sections.length}</span></footer>
    </article>)}
  </main>;
}
