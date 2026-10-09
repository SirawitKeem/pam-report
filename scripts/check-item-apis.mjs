import fs from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
const compile = code => 'data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(code, { mode: 'transform' })).toString('base64');
const catalog = compile(await fs.readFile('src/lib/catalog.ts', 'utf8'));
const pam = compile((await fs.readFile('src/lib/pam.ts', 'utf8')).replace('import "server-only";', '').replace('"./catalog"', JSON.stringify(catalog)).replace('"./pam-transport.mjs"', JSON.stringify(new URL('../src/lib/pam-transport.mjs', import.meta.url).href)));
const model = compile(await fs.readFile('src/lib/resource-model.ts', 'utf8'));
const resource = compile((await fs.readFile('src/lib/resource-report.ts', 'utf8')).replace('import "server-only";', '').replace('"./pam"', JSON.stringify(pam)).replace('"./resource-model"', JSON.stringify(model)));
const { readPamEndpoint } = await import(pam);
const { dataset } = await import(resource);
const { parseResourceSelection } = await import(compile(await fs.readFile('src/lib/executive-model.ts', 'utf8')));
const params = Object.fromEntries(new URLSearchParams(process.argv[2] ?? ''));
const selection = parseResourceSelection(params, {
  assets: process.env.PAM_REPORT_ASSET_IDS,
  applications: process.env.PAM_REPORT_APPLICATION_IDS,
  webApps: process.env.PAM_REPORT_WEB_APP_IDS,
});
// Extra IDs must be supplied from actual inventory, never guessed or scanned.
const extraIds = key => parseResourceSelection({ assets: params[key] }).assets;
const systemUsers = extraIds('systemUsers');
const tickets = extraIds('tickets');
const users = await dataset('/pam/apps/users/user/?page=1&page_size=100&search=&filter_by=', 'results', 'count', 1);
const groups = await dataset('/pam/apps/groups/groups/?page=0&limit=100&search=&filter_by=', 'groups', 'totalGroups', 0);
const roleIds = [...new Set(users.rows.map(user => user.role?.role_id))].filter(id => Number.isInteger(id) && id > 0).slice(0, 50);
const probes = [
  ...selection.assets.map(id => ({ name: 'Asset', id, path: `/pam/apps/assets/asset/?asset_id=${id}&is_clone=false`, recordKey: 'asset' })),
  ...selection.applications.map(id => ({ name: 'App', id, path: `/pam/apps/apps/app/?app_id=${id}&is_clone=false`, recordKey: 'app' })),
  ...selection.webApps.map(id => ({ name: 'WebApp', id, path: `/pam/apps/web_apps/web_app/?web_app_id=${id}&is_clone=false`, recordKey: 'web_app' })),
  ...groups.rows.filter(group => Number.isInteger(group.group_id) && group.group_id > 0).slice(0, 50).map(group => ({ name: 'Group', id: group.group_id, path: `/pam/apps/groups/group/?group_id=${group.group_id}`, idKey: 'group_id' })),
  // role_id is a diagnostic hypothesis; a successful matched response is required to validate it.
  ...roleIds.map(id => ({ name: 'Role (parameter under verification)', id, path: `/pam/apps/roles/role/?role_id=${id}`, idKey: 'role_id' })),
  ...systemUsers.map(id => ({ name: 'System User', id, path: `/pam/apps/assets/systemuser/?system_user_id=${id}` })),
  ...tickets.map(id => ({ name: 'Ticket', id, path: `/pam/apps/ticket/tickets/?ticket_id=${id}` })),
];
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), usersStatus: users.status, groupsStatus: groups.status,
  skipped: [
    ...(!systemUsers.length ? ['System User details: no inventory IDs supplied'] : []),
    ...(!tickets.length ? ['Ticket details: no inventory IDs supplied'] : []),
    'Certificate details: no verified detail URL and inventory IDs available',
  ] }));
for (const probe of probes) {
  try {
    const result = await readPamEndpoint(probe.path);
    const data = result.data;
    const row = probe.recordKey ? data?.[probe.recordKey] : data;
    const matchedId = probe.recordKey || probe.idKey ? Boolean(row && String(row[probe.idKey ?? 'id']) === String(probe.id)) : null;
    console.log(JSON.stringify({ name: probe.name, id: probe.id, endpoint: probe.path, status: result.upstreamStatus,
      matchedId, fields: row && typeof row === 'object' ? Object.keys(row) : [],
      note: matchedId === null ? 'Response identity contract not yet verified' : undefined }));
  } catch (error) {
    console.log(JSON.stringify({ name: probe.name, id: probe.id, endpoint: probe.path, status: error.upstreamStatus, error: error.message }));
  }
}
// Metadata only: never persist API records, credentials or tokens.
process.exit(0);
