import {test} from 'node:test';
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
