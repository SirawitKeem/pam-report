"use client";
import { useState } from "react";
import { label, resourceKey, resourceName, type ResourceReport } from "@/lib/resource-model";
export default function ResourceReportView({initial}:{initial:ResourceReport|null}) {
  const [report,setReport]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function refresh(){setBusy(true);setError("");try{const response=await fetch("/api/resources-report",{cache:"no-store"});const data=await response.json();if(!response.ok)throw Error(data.error||"ดึงข้อมูลไม่สำเร็จ");setReport(data);}catch(e){setReport(null);setError(e instanceof Error?e.message:"ดึงข้อมูลไม่สำเร็จ");}finally{setBusy(false);}}
  const resources=report?.resources;
  const users=report?.users;
  const assignments=report?.assignments??[];
  return <main className="rr-canvas">
    <div className="rr-toolbar no-print"><div><b>PAM REPORT</b><span>รายงาน Resources · A4</span></div><div><button className="button primary" onClick={refresh} disabled={busy}>{busy?"กำลังดึงข้อมูล…":"ดึงข้อมูลจาก API"}</button><button className="button dark" onClick={()=>window.print()}>พิมพ์ / PDF</button></div></div>
    {error&&<p className="rr-alert no-print" role="alert">{error}</p>}
    <article className="rr-sheet">
      <header className="rr-header"><div><span className="rr-kicker">PRIVILEGED ACCESS MANAGEMENT</span><h1>รายงาน Resources</h1><p>จำนวนทรัพยากร รายละเอียด และข้อมูล User ที่เกี่ยวข้อง</p></div><span className="rr-badge">API<br/>REPORT</span></header>
      <div className="rr-meta"><div><small>ระบบ</small><b>{report?.baseUrl||"https://pam3.lab2.trac"}</b></div><div><small>ดึงข้อมูลเมื่อ</small><b>{report?new Date(report.fetchedAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",hour12:false}):"ยังไม่ได้ดึงข้อมูล"}</b></div></div>
      <div className="rr-summary"><section><small>Resources ทั้งหมดตาม API</small><strong>{resources?.total??"—"}</strong><span>{resources?.total==null?"API ยังไม่ส่งจำนวนทั้งหมด":"total_resources จาก API"}</span></section><section><small>Resources ที่ดึงได้</small><strong>{resources?.rows.length??"—"}</strong><span>{resources?.error?"คำขอข้อมูลไม่สำเร็จ":resources?.complete?"ดึงรายการครบแล้ว":"ยังไม่ยืนยันว่ารายการครบ"}</span></section><section><small>ข้อมูล User–Resource</small><strong>{report?.allocationComplete?assignments.length:"—"}</strong><span>{report?.allocationComplete?"รายการความสัมพันธ์ที่ได้รับ":"ยังไม่มีข้อมูลครบสำหรับสรุป"}</span></section></div>
      <section className="rr-section"><div className="rr-section-title"><h2>01 / รายการ Resources</h2><span>{resources?.status?"HTTP "+resources.status:"รอ API"}</span></div>
        {resources?.error&&<div className="rr-status"><b>ยังไม่ได้รับรายการ Resources</b><p>{resources.error}</p><code>{resources.endpoint}</code></div>}
        {resources?.rows.length?<table className="rr-table"><thead><tr><th>Resource</th><th>ประเภท</th><th>IP / Host</th><th>Port</th><th>User ที่เกี่ยวข้องตาม API</th></tr></thead><tbody>{resources.rows.map((row,index)=>{const linked=assignments.filter(item=>item.resourceKey===resourceKey(row));return <tr key={resourceKey(row)+":"+index}><td><b>{resourceName(row)}</b><small>ID {label(row.id)}</small></td><td>{label(row.resource_type)}<small>{label(row.resource_sub_type)}</small></td><td>{label(row.ip_host??row.host??row.ip_address)}</td><td>{label(row.port)}</td><td>{linked.length?linked.map(item=>item.username).join(", "):report?.allocationComplete?"API ไม่ส่งรายการ User ที่เกี่ยวข้อง":"ยังดึงข้อมูลส่วนนี้ไม่ได้"}</td></tr>;})}</tbody></table>:!resources?.error&&<div className="rr-empty">{report&&resources?.complete?"API ส่งรายการ Resources ว่างกลับมา":"กดดึงข้อมูลจาก API เพื่อจัดทำรายงาน"}</div>}
      </section>
      <section className="rr-section"><div className="rr-section-title"><h2>02 / User และ Resources ที่เกี่ยวข้อง</h2><span>{report?.allocationComplete?"รับข้อมูลครบ":"รอข้อมูลความสัมพันธ์"}</span></div>
        {assignments.length?<table className="rr-table"><thead><tr><th>User</th><th>Resource</th><th>System User</th><th>ประเภทการจัดสรร</th></tr></thead><tbody>{assignments.map((item,index)=><tr key={index}><td>{item.username}</td><td>{resourceName(resources!.rows.find(row=>resourceKey(row)===item.resourceKey)!)}</td><td>{item.systemUser}</td><td>{item.allocationType}</td></tr>)}</tbody></table>:<div className="rr-empty">ยังไม่มีข้อมูลจาก API สำหรับระบุว่า User คนไหนเกี่ยวข้องกับ Resource ไหน</div>}
        {!!report?.allocationErrors.length&&<ul className="rr-notes">{report.allocationErrors.map((item,index)=><li key={index}>{item}</li>)}</ul>}
      </section>
      {!!users?.rows.length&&<section className="rr-section"><div className="rr-section-title"><h2>03 / Users ที่ดึงจาก API ได้</h2><span>{users.rows.length} / {users.total??"ไม่ระบุ"} รายการ · HTTP {users.status}</span></div><p className="rr-explanation">รายชื่อผู้ใช้ใน PAM ส่วนนี้ยังไม่ใช่ข้อมูลจับคู่กับ Resources</p><table className="rr-table"><thead><tr><th>ชื่อผู้ใช้</th><th>อีเมล</th><th>บทบาท</th><th>สถานะล็อกบัญชี</th></tr></thead><tbody>{users.rows.map((row,index)=><tr key={String(row.id??index)}><td>{label(row.username)}</td><td>{label(row.email)}</td><td>{label(row.role)}</td><td>{row.locked===true?"ล็อก":row.locked===false?"ไม่ล็อก":"ไม่ระบุ"}</td></tr>)}</tbody></table></section>}
      <div className="rr-footnote">รายงานแสดงข้อมูลที่ API ส่งกลับมา ณ เวลาที่ระบุ ช่อง “—” หมายถึงยังไม่ทราบค่า ข้อมูล User–Resource อ้างอิงรายการจาก API และไม่ใช้ชื่อ System User เพื่อระบุผู้ดูแล</div>
      <footer className="rr-footer"><span>PAM · INTERNAL REPORT</span><span>แหล่งข้อมูล: OAuth Client Credentials</span></footer>
      {report&&<details className="rr-json no-print"><summary>ดูข้อมูล API ที่ได้รับ (ปิดบังข้อมูลลับแล้ว)</summary><pre>{JSON.stringify(report,null,2)}</pre></details>}
    </article>
  </main>;
}
