import fs from 'node:fs/promises';
let tests=await fs.readFile('tests/pam.test.mjs','utf8');tests=tests.replace('https://pam.test/pam/apps/users/user/"','https://pam.test/pam/apps/users/user/?page=1&page_size=100&search=&filter_by="');await fs.writeFile('tests/pam.test.mjs',tests);
await fs.writeFile('tests/pam-transport.test.mjs',`import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyPamCertificate,pamFetch} from '../src/lib/pam-transport.mjs';
const raw=Buffer.from('certificate fixture');const pin=createHash('sha256').update(raw).digest('hex');
const cert={raw,subject:{CN:'pam.test'},subjectaltname:'DNS:pam.test',valid_from:'Jan 1 2026 GMT',valid_to:'Jan 1 2027 GMT'};const now=Date.UTC(2026,9,8);
test('Pinned certificate checks fingerprint, hostname and validity',()=>{
 assert.doesNotThrow(()=>verifyPamCertificate(cert,'pam.test',pin,now));
 assert.throws(()=>verifyPamCertificate(cert,'pam.test','0'.repeat(64),now),/does not match/);
 assert.throws(()=>verifyPamCertificate(cert,'other.test',pin,now),/Hostname/);
 assert.throws(()=>verifyPamCertificate(cert,'pam.test',pin,Date.UTC(2028,0,1)),/validity/);
});
test('Pinned transport refuses another origin before sending HTTP',()=>{
 const previous={pin:process.env.PAM_TLS_CERT_SHA256,base:process.env.PAM_BASE_URL};
 process.env.PAM_TLS_CERT_SHA256=pin;process.env.PAM_BASE_URL='https://pam.test';
 try{assert.throws(()=>pamFetch('https://other.test/',{}),/restricted/);assert.throws(()=>pamFetch('http://pam.test/',{}),/restricted/);}
 finally{if(previous.pin===undefined)delete process.env.PAM_TLS_CERT_SHA256;else process.env.PAM_TLS_CERT_SHA256=previous.pin;if(previous.base===undefined)delete process.env.PAM_BASE_URL;else process.env.PAM_BASE_URL=previous.base;}
});
`);
let pkg=JSON.parse(await fs.readFile('package.json','utf8'));pkg.scripts.test='node --test tests/*.test.mjs';pkg.scripts['refresh:report']='node scripts/refresh-resource-report.mjs';await fs.writeFile('package.json',JSON.stringify(pkg,null,2)+'\n');
const snap=JSON.parse(await fs.readFile('data/resources-report.latest.json','utf8'));console.log(JSON.stringify({roleFields:Object.keys(snap.users.rows[0]?.role||{}),userCount:snap.users.total}));
await fs.appendFile('README.md','\n## Resources report\n\nThe home page and /resources-report show the A4 Resources report. Click the refresh button to fetch live API data, or run npm run refresh:report. Redacted snapshots are stored locally in data/ (ignored by Git). Unknown resource totals are shown as unavailable, not zero. All Resources uses /pam/apps/resources/ with zero-based page and limit; /assets/asset/ reads one resource by asset_id. The Users endpoint needs page, page_size, search and filter_by.\n\nPAM_CUSTOMER_ID=10001 was confirmed by a successful token response. PAM_TLS_CERT_SHA256 pins the leaf certificate fingerprint supplied by the user, verifies the hostname and validity period before any HTTP request, and applies only to PAM_BASE_URL. When the server certificate changes, confirm and update the fingerprint or use the organization CA via NODE_EXTRA_CA_CERTS.\n');
console.log('Updated verification and report documentation.');
