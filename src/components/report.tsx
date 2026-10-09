"use client";
import { useState } from "react";
import { apis, documentation, type ApiId } from "@/lib/catalog";

type Result = { data?: unknown; fetchedAt?: string; error?: string; upstreamStatus?: number };
type Config = { ready: boolean; missing: string[]; baseUrl: string; clientIdConfigured: boolean; secretConfigured: boolean; customerConfigured: boolean };
function records(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["results", "data", "items", "users", "assets", "roles", "groups", "apps", "tickets", "systemusers"]) {
      if (Array.isArray(obj[key])) return obj[key];
      if (obj[key] && typeof obj[key] === "object") {
        const nested = records(obj[key]); if (nested.length) return nested;
      }
    }
    return [data];
  }
  return data == null ? [] : [data];
}
function cell(value: unknown) {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
function DataTable({ data }: { data: unknown }) {
  const rows = records(data);
  if (!rows.length) return <div className="empty-box">API ส่งรายการว่างกลับมา</div>;
  const objects = rows.filter(row => row && typeof row === "object" && !Array.isArray(row)) as Record<string, unknown>[];
  if (objects.length !== rows.length) return <pre className="json-box">{JSON.stringify(data, null, 2)}</pre>;
  const columns = Array.from(new Set(objects.flatMap(Object.keys))).slice(0, 6);
  return <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map(key => <th key={key}>{key}</th>)}</tr></thead><tbody>{objects.map((row, index) => <tr key={index}>{columns.map(key => <td key={key}>{cell(row[key])}</td>)}</tr>)}</tbody></table><p className="table-caption">{rows.length} รายการใน response นี้ · แสดง {columns.length} คอลัมน์แรก · ดูข้อมูลทั้งหมดได้ใน JSON</p></div>;
}
export default function Report({ config }: { config: Config }) {
  const [active, setActive] = useState<ApiId>("users");
  const [results, setResults] = useState<Partial<Record<ApiId, Result>>>({});
  const [busy, setBusy] = useState<ApiId | "all" | null>(null);
  const [tab, setTab] = useState<"report" | "reference" | "setup">("report");
  const [json, setJson] = useState(false);
  const [allPrint, setAllPrint] = useState(false);
  const api = apis.find(item => item.id === active)!;
  const result = results[active];
  const success = Object.values(results).filter(item => item.data !== undefined).length;
  async function load(id: ApiId) {
    try {
      const response = await fetch("/api/pam/" + id, { cache: "no-store" });
      const payload = await response.json();
      const value: Result = response.ok ? payload : { error: payload.error || "ไม่สามารถอ่านข้อมูลได้", upstreamStatus: payload.upstreamStatus };
      setResults(previous => ({ ...previous, [id]: value }));
    } catch { setResults(previous => ({ ...previous, [id]: { error: "เชื่อมต่อแอปไม่สำเร็จ กรุณาลองใหม่" } })); }
  }
  async function refresh(all = false) {
    setBusy(all ? "all" : active);
    try { if (all) { for (const item of apis) await load(item.id); } else await load(active); } finally { setBusy(null); }
  }
  function print(all: boolean) {
    setAllPrint(all);
    setTimeout(() => window.print(), 150);
  }
  function sheet(item: typeof apis[number], number: number) {
    const itemResult = results[item.id];
    return <article className="sheet" key={item.id}>
      <div className="sheet-top"><span className="eyebrow">PRIVILEGED ACCESS MANAGEMENT</span><span className="doc-number">PAM / {String(number).padStart(2, "0")}</span></div>
      <header className="report-heading"><div><span className="report-kicker">รายงานข้อมูล API</span><h1>{item.thai}</h1><p>{item.name} · {item.description}</p></div><div className="report-mark">P<span>AM</span><small>DATA REPORT</small></div></header>
      <div className="report-meta"><div><span>แหล่งข้อมูล</span><strong>{config.baseUrl || "ยังไม่ได้ตั้งค่า"}</strong></div><div><span>เวลาที่ดึงข้อมูล</span><strong>{itemResult?.fetchedAt ? new Date(itemResult.fetchedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", hour12: false }) + " (UTC+7)" : "ยังไม่ได้ดึงข้อมูล"}</strong></div></div>
      <div className="endpoint-line"><b>GET</b><code>{item.path}</code></div>
      <div className="section-label"><h2>ข้อมูล{item.thai}</h2><span>{itemResult?.data !== undefined ? records(itemResult.data).length + " รายการใน response" : "รอข้อมูล"}</span></div>
      {itemResult?.error ? <div className="error-box"><b>ยังดึงข้อมูลไม่สำเร็จ</b><p>{itemResult.error}</p></div> : itemResult?.data !== undefined ? <DataTable data={itemResult.data} /> : <div className="empty-box"><div className="empty-icon">↳</div><h3>พร้อมสำหรับข้อมูลของคุณ</h3><p>{config.ready ? "กดดึงข้อมูลเพื่อสร้างรายงานจาก PAM" : "กรอก Client Secret และ Customer ID ใน .env.local แล้วรีสตาร์ตแอป"}</p><small>หน้านี้ยังไม่มีข้อมูลจากระบบจริง</small></div>}
      {json && itemResult?.data !== undefined && <details className="json-detail no-print" open><summary>JSON response (ปิดบังข้อมูลลับแล้ว)</summary><pre className="json-box">{JSON.stringify(itemResult.data, null, 2)}</pre></details>}
      <div className="report-note"><b>หมายเหตุของรายงาน</b><p>ข้อมูลตาม response ที่ได้รับจาก API ณ เวลาที่ระบุ อาจเป็นเพียงหน้าหนึ่งของรายการหาก API ใช้ pagination ข้อมูลลับถูกปิดบังก่อนแสดงผล</p>{item.id === "system-users" && <p>System Users คือบัญชีสำหรับเข้าเครื่อง ไม่ใช่รายชื่อบุคคลผู้รับผิดชอบเครื่อง</p>}</div>
      <footer className="sheet-footer"><span>PAM API REPORT · INTERNAL</span><span>{item.scope}</span><span>{String(number).padStart(2, "0")}</span></footer>
    </article>;
  }
  return <div className="app-shell">
    <aside className="sidebar no-print"><a className="brand" href="/"><span className="brand-icon">P</span><span>PAM<span className="brand-sub">API WORKSPACE</span></span></a><div className="sidebar-label">ข้อมูลและรายงาน <span>07</span></div><nav>{apis.map((item, index) => <button key={item.id} onClick={() => { setActive(item.id); setTab("report"); }} className={"nav-item " + (active === item.id && tab === "report" ? "selected" : "")}><span className="nav-number">{String(index + 1).padStart(2, "0")}</span><span>{item.thai}<small>{item.name}</small></span><span className={"nav-dot " + (results[item.id]?.data !== undefined ? "done" : "")} /></button>)}</nav><div className="sidebar-bottom"><span className="sidebar-label">การเชื่อมต่อ</span><div className="connection"><i className={config.ready ? "green" : ""}/><span>{config.ready ? "ตั้งค่าครบ · ยังต้องทดสอบ" : "รอการตั้งค่า"}<small>pam3.lab2.trac</small></span></div><button className="text-button" onClick={() => setTab("setup")}>ตั้งค่าการเชื่อมต่อ ↗</button></div></aside>
    <main className="main"><header className="topbar no-print"><div><span className="breadcrumb">Workspace / PAM</span><h2>{tab === "report" ? "รายงานและข้อมูล" : tab === "reference" ? "คู่มือ API" : "ตั้งค่าการเชื่อมต่อ"}</h2></div><div className="top-actions"><button className="button quiet" onClick={() => setTab("reference")}>API Reference ↗</button><span className="local-badge">LOCAL WORKSPACE</span></div></header>
      <div className="workspace no-print"><div className="workspace-title"><div><span className="eyebrow">YOUR ACCESS, DOCUMENTED.</span><h2>ข้อมูลที่ชัดเจน พร้อมเป็นเอกสาร</h2><p>อ่านข้อมูลจาก PAM ทั้ง 7 หมวด และจัดรูปแบบรายงาน A4</p></div><div className="workspace-total"><strong>{String(success).padStart(2,"0")}<span>/ 07</span></strong><small>หมวดที่ดึงข้อมูลสำเร็จ</small></div></div>
        <div className="toolbar"><div className="tabs">{([["report","รายงาน"],["reference","API Reference"],["setup","การเชื่อมต่อ"]] as const).map(([id,label])=><button className={tab===id?"active":""} key={id} onClick={()=>setTab(id)}>{label}</button>)}</div>{tab==="report" && <div className="toolbar-actions"><button className="button quiet" disabled={!!busy || !config.ready} onClick={()=>refresh(true)}>{busy==="all"?"กำลังดึงทั้ง 7 หมวด…":"ดึงทั้ง 7 หมวด"}</button><button className="button primary" disabled={!!busy || !config.ready} onClick={()=>refresh()}>{busy && busy!=="all"?"กำลังดึงข้อมูล…":"↻ ดึงข้อมูล"}</button></div>}</div>
        {!config.ready && <div className="setup-banner"><span>◌</span><p><b>ยังไม่ได้เชื่อมต่อ PAM</b> เติม {config.missing.join(", ")} ใน .env.local แล้วรีสตาร์ตแอป</p><button onClick={()=>setTab("setup")}>ดูวิธีตั้งค่า →</button></div>}
      </div>
      {tab==="report" && <><div className="paper-controls no-print"><span>DOCUMENT PREVIEW <b>A4 · 210 × 297 mm</b></span><div><label><input type="checkbox" checked={json} onChange={event=>setJson(event.target.checked)}/> ดู JSON</label><button className="button quiet" onClick={()=>print(true)}>พิมพ์ทั้ง 7 หมวด</button><button className="button dark" onClick={()=>print(false)}>พิมพ์ / บันทึก PDF</button></div></div><div className={"paper-stack " + (allPrint ? "print-all" : "")}><div className="active-sheet">{sheet(api, apis.indexOf(api)+1)}</div><div className="extra-sheets">{apis.filter(item=>item.id!==active).map(item=>sheet(item,apis.indexOf(item)+1))}</div></div></>}
      {tab==="reference" && <section className="content-panel no-print"><span className="eyebrow">API REFERENCE</span><h2>7 หมวดสำหรับ OAuth Client Credentials</h2><p>Endpoint และ method ตามเอกสารผู้ผลิต ยังต้องยืนยันกับเวอร์ชันที่ติดตั้ง แอปนี้เรียก GET เพื่ออ่านข้อมูลเท่านั้น</p><div className="reference-table"><table><thead><tr><th>หมวด</th><th>Endpoint / Scope สำหรับอ่าน</th><th>Methods</th></tr></thead><tbody>{apis.map(item=><tr key={item.id}><td><b>{item.name}</b><small>{item.thai}</small></td><td><code>{item.path}</code><small>{item.scope}</small></td><td>{item.methods.map(method=><span className={"method "+(method==="GET"?"get":"")} key={method}>{method}</span>)}</td></tr>)}</tbody></table></div><div className="info-card"><h3>การยืนยันตัวตน</h3><p>POST /pam/apps/autheticate/oauth/token-generation/</p><p>Body: grant_type, client_id, client_secret, customer</p><p>คำขออ่านข้อมูลส่ง header: <code>Authorize: Bearer &lt;token&gt;</code> ตามเอกสาร</p><p>Token เก็บในหน่วยความจำฝั่งเซิร์ฟเวอร์และไม่ส่งให้เบราว์เซอร์</p></div><a className="text-link" href={documentation} target="_blank" rel="noreferrer">เปิดเอกสาร miniOrange PAM ↗</a></section>}
      {tab==="setup" && <section className="content-panel no-print"><span className="eyebrow">CONNECTION SETUP</span><h2>เชื่อมต่อ PAM ของคุณ</h2><p>แก้ไขไฟล์ .env.local ในโฟลเดอร์โปรเจกต์ ค่า credentials ใช้เฉพาะฝั่งเซิร์ฟเวอร์</p><div className="config-list">{[["Base URL",config.baseUrl||"ยังไม่ตั้งค่า",Boolean(config.baseUrl)],["Client ID","ตั้งค่าใน .env.local",config.clientIdConfigured],["Client Secret","กรอกเองใน .env.local",config.secretConfigured],["Customer ID","รหัสองค์กร/tenant ของ PAM",config.customerConfigured]].map(([name,description,ready])=><div key={String(name)}><span><b>{name}</b><small>{description}</small></span><span className={"status-pill "+(ready?"ready":"")}>{ready?"ตั้งค่าแล้ว":"รอกรอก"}</span></div>)}</div><pre className="setup-code">{'PAM_BASE_URL=https://pam3.lab2.trac\nPAM_CLIENT_ID=cbdbd3faf65f4400a8f45b29f540d244\nPAM_CLIENT_SECRET=ใส่ Secret ของคุณ\nPAM_CUSTOMER_ID=ใส่ Customer ID จริง'}</pre><div className="info-card"><h3>Customer ID คืออะไร?</h3><p>รหัสองค์กร/tenant ที่ใช้ขอ OAuth token ไม่ใช่ชื่อผู้ใช้ รหัสเครื่อง หรือ Client ID เอกสารระบุ 10001 เป็นตัวอย่างเท่านั้น หากยังหาไม่พบ ให้ขอจากผู้ติดตั้งหรือผู้ดูแล PAM</p><h3>ใบรับรอง HTTPS ของระบบภายใน</h3><p>หากพบ certificate error ให้ใช้ CA ขององค์กร โดยตั้ง NODE_EXTRA_CA_CERTS เป็น path ของไฟล์ CA แบบ PEM ก่อนเริ่ม Node.js แอปยังคงตรวจสอบใบรับรอง HTTPS</p><h3>อ่านข้อมูลใครเข้าเครื่องไหน</h3><p>Users, Assets และ System Users เป็นคนละรายการ API ในคู่มือนี้ยังไม่มี endpoint สำหรับความสัมพันธ์การจัดสรรสิทธิ์ จึงไม่สรุปความสัมพันธ์จากชื่อบัญชี</p></div><p className="setup-footnote">หลังแก้ไข .env.local ให้หยุดเซิร์ฟเวอร์แล้วเริ่มใหม่ด้วย npm run dev</p></section>}
    </main>
  </div>;
}
