import { Agent, buildConnector } from 'undici';
import { checkServerIdentity } from 'node:tls';
import { createHash, timingSafeEqual } from 'node:crypto';

export function verifyPamCertificate(cert, hostname, expectedPin, now = Date.now()) {
  const normalized = expectedPin.replace(/:/g, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized) || !cert.raw) throw new Error('PAM certificate fingerprint is invalid');
  const actual = createHash('sha256').update(cert.raw).digest();
  if (!timingSafeEqual(actual, Buffer.from(normalized, 'hex'))) throw new Error('PAM certificate fingerprint does not match');
  const identityError = checkServerIdentity(hostname, cert);
  if (identityError) throw identityError;
  const from = Date.parse(cert.valid_from), to = Date.parse(cert.valid_to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || now < from || now > to) throw new Error('PAM certificate is outside its validity period');
}
let dispatcher;
let dispatcherKey;
export function pamFetch(url, init) {
  const pin = process.env.PAM_TLS_CERT_SHA256?.trim();
  if (!pin) return globalThis.fetch(url, init);
  const expected = new URL(process.env.PAM_BASE_URL);
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.origin !== expected.origin) throw new Error('PAM certificate pin is restricted to the configured HTTPS origin');
  const key = expected.origin + ':' + pin;
  if (!dispatcher || dispatcherKey !== key) {
    if (dispatcher) void dispatcher.close();
    const connector = buildConnector({ rejectUnauthorized: false, maxCachedSessions: 0, timeout: 20000 });
    dispatcher = new Agent({ connect(options, callback) {
      if (options.hostname !== expected.hostname || options.protocol !== 'https:') { callback(new Error('PAM TLS origin mismatch'), null); return; }
      // No HTTP request is released until the user-verified leaf, hostname and dates match.
      connector(options, (error, socket) => {
        if (error) { callback(error, null); return; }
        try { verifyPamCertificate(socket.getPeerCertificate(), expected.hostname, pin); }
        catch (validationError) { socket.destroy(); callback(validationError, null); return; }
        callback(null, socket);
      });
    } });
    dispatcherKey = key;
  }
  return globalThis.fetch(url, { ...init, dispatcher });
}
