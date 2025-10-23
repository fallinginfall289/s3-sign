export async function createSignedS3Url({
  bucket,
  key,
  region,
  endpoint,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  expires = 43200, // 12h
}) {
  const method = 'GET';
  const service = 's3';
  const host = new URL(endpoint).host;

  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const amzDate =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    'T' +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}` +
    'Z';
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const signedHeaders = 'host';

  const paramsQuery = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${accessKeyId}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expires)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ];

  if (sessionToken) {
    paramsQuery.push(['X-Amz-Security-Token', sessionToken]);
  }

  paramsQuery.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalUri = `/${bucket}/${encodeRFC3986(key, true)}`;
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalQuery = paramsQuery
    .map(([k, v]) => `${encodeRFC3986(k)}=${encodeRFC3986(v)}`)
    .join('&');

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const hashedCanonicalRequest = await sha256(canonicalRequest);
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = await hmacHex(signingKey, stringToSign);

  const signedUrl =
    `${endpoint}/${bucket}/${encodeRFC3986(key, true)}?` +
    canonicalQuery +
    `&X-Amz-Signature=${signature}`;

  return signedUrl;
}

// === Internal helpers ===
async function sha256(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return hex(buf);
}
async function hmacRaw(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}
async function hmacHex(key, data) {
  return hex(await hmacRaw(key, data));
}
async function getSignatureKey(secret, date, region, service) {
  const kDate = await hmacRaw(new TextEncoder().encode('AWS4' + secret), date);
  const kRegion = await hmacRaw(kDate, region);
  const kService = await hmacRaw(kRegion, service);
  return hmacRaw(kService, 'aws4_request');
}
function encodeRFC3986(str, keepSlash = false) {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/g, keepSlash ? '/' : '%2F');
}
function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
