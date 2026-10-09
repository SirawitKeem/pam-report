import fs from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const compile = code => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(code, { mode: 'transform' })).toString('base64');
const catalog = compile(await fs.readFile('src/lib/catalog.ts', 'utf8'));
const model = compile(await fs.readFile('src/lib/resource-model.ts', 'utf8'));
const pam = compile((await fs.readFile('src/lib/pam.ts', 'utf8')).replace('import "server-only";', '').replace('"./catalog"', JSON.stringify(catalog)).replace('"./pam-transport.mjs"', JSON.stringify(new URL('../src/lib/pam-transport.mjs', import.meta.url).href)));
const resource = compile((await fs.readFile('src/lib/resource-report.ts', 'utf8')).replace('import "server-only";', '').replace('"./pam"', JSON.stringify(pam)).replace('"./resource-model"', JSON.stringify(model)));
const executive = compile((await fs.readFile('src/lib/executive-report.ts', 'utf8')).replace('import "server-only";', '').replace('"./catalog"', JSON.stringify(catalog)).replace('"./resource-report"', JSON.stringify(resource)).replace('"./pam"', JSON.stringify(pam)));
const { fetchExecutiveReport } = await import(executive);
const { parseResourceSelection, parseReportOptions } = await import(compile(await fs.readFile('src/lib/executive-model.ts', 'utf8')));
const report = await fetchExecutiveReport(parseResourceSelection(Object.fromEntries(new URLSearchParams(process.argv[2] ?? '')), {
  assets: process.env.PAM_REPORT_ASSET_IDS,
  applications: process.env.PAM_REPORT_APPLICATION_IDS,
  webApps: process.env.PAM_REPORT_WEB_APP_IDS,
}), parseReportOptions(Object.fromEntries(new URLSearchParams(process.argv[2] ?? '')), {scanTo:process.env.PAM_REPORT_DISCOVERY_MAX_ID}));
console.log(JSON.stringify({ checkedAt: report.resourceReport.fetchedAt,
  datasets: Object.fromEntries(Object.entries({ users: report.resourceReport.users, groups: report.groups, resources: report.resourceReport.resources }).map(([name, data]) => [name, { received: data.rows.length, total: data.total, complete: data.complete, status: data.status }])),
  groupMemberships: report.groups.rows.map(group => ({ groupId: group.group_id, declared: group.member_count, receivedIds: Array.isArray(group.users) ? group.users.length : null, matchedUsers: Array.isArray(group.users) ? group.users.filter(id => report.resourceReport.users.rows.some(user => String(user.id) === String(id))).length : null })),
  details: report.details.map(detail => ({kind:detail.kind, id:detail.requestedId, status:detail.status, received:Boolean(detail.row), fields:detail.row?Object.keys(detail.row):[]})),
  ticketAutomation:report.ticketAutomation,
  sources:report.sources.map(source=>({name:source.name,status:source.status,received:source.ok})),
  allocations:report.allocations.map(item=>({kind:item.kind,id:item.resourceId,status:item.dataset.status,received:item.dataset.rows.length,complete:item.dataset.complete})),
  checks: report.checks }, null, 2));
// Show counts and diagnostics only; do not persist response datasets or credentials.
process.exit(0);
