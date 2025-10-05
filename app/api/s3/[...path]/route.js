export const runtime = 'edge';

export async function GET(request, { params }) {
  const key = params.path?.join('/') || '';
  if (!key) return new Response('Missing object key', { status: 400 });

  const env = {
    BUCKET_NAME: process.env.BUCKET_NAME,
    S3_REGION: process.env.S3_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN: process.env.AWS_SESSION_TOKEN,
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    ALLOWED_FOLDERS: process.env.ALLOWED_FOLDERS, 
  };

  const {
    BUCKET_NAME,
    S3_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN,
    S3_ENDPOINT,
    ALLOWED_FOLDERS,
  } = env;
  
  const allowedFolders = (ALLOWED_FOLDERS || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);
    console.log(allowedFolders)

  if (allowedFolders.length === 0) {
    return new Response('Server misconfigured: ALLOWED_FOLDERS is empty', {
      status: 500,
    });
  }

  const firstSegment = key.split('/')[0];
  if (!allowedFolders.includes(firstSegment)) {
    return new Response('Access denied: invalid folder', { status: 403 });
  }

  const method = 'GET';
  const service = 's3';
  const host = new URL(S3_ENDPOINT).host;

  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  const amzDate =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    'T' +
    `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}` +
    'Z';
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${S3_REGION}/${service}/aws4_request`;
  const signedHeaders = 'host';

  const paramsQuery = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${AWS_ACCESS_KEY_ID}/${credentialScope}`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', '43200'],
    ['X-Amz-SignedHeaders', signedHeaders],
  ];

  if (AWS_SESSION_TOKEN) {
    paramsQuery.push(['X-Amz-Security-Token', AWS_SESSION_TOKEN]);
  }

  paramsQuery.sort((a, b) => a[0].localeCompare(b[0]));

  function encodeRFC3986(str, keepSlash = false) {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
      .replace(/%2F/g, keepSlash ? '/' : '%2F');
  }

  const canonicalQuery = paramsQuery
    .map(([k, v]) => `${encodeRFC3986(k)}=${encodeRFC3986(v)}`)
    .join('&');

  const canonicalUri = `/${BUCKET_NAME}/${encodeRFC3986(key, true)}`;
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

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

  const signingKey = await getSignatureKey(
    AWS_SECRET_ACCESS_KEY,
    dateStamp,
    S3_REGION,
    service,
  );
  const signature = await hmacHex(signingKey, stringToSign);

  const signedUrl =
    `${S3_ENDPOINT}/${BUCKET_NAME}/${encodeRFC3986(key, true)}?` +
    canonicalQuery +
    `&X-Amz-Signature=${signature}`;

  const s3Resp = await fetch(signedUrl);
  if (!s3Resp.ok)
    return new Response('File not found or access denied', { status: 404 });

  return new Response(s3Resp.body, {
    status: 200,
    headers: {
      'Content-Type':
        s3Resp.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000',
      'Accept-Ranges': 'bytes',
    },
  });
}

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
function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
