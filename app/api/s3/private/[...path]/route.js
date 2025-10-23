import { createSignedS3Url } from '@/lib/utils/aws-signature';
import { verifyJwtHS256 } from '@/lib/utils/jwt';

export const runtime = 'edge';

export async function GET(request, { params }) {
  const p = await params;
  const key = p.path?.join('/') || '';
  if (!key) return new Response('Missing object key', { status: 400 });

  const {
    BUCKET_NAME,
    S3_REGION,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN,
    S3_ENDPOINT,
    JWT_SECRET,
    PRESIGN_EXPIRES,
    PRIVATE_FOLDERS,
  } = process.env;

  const privateFolders = (PRIVATE_FOLDERS || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  const firstSegment = key.split('/')[0];
  if (!privateFolders.includes(firstSegment)) {
    return new Response('Access denied: invalid folder', { status: 403 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return new Response('Missing token', { status: 401 });

  let payload;
  try {
    payload = await verifyJwtHS256(token, JWT_SECRET);
  } catch {
    return new Response('Invalid or expired token', { status: 403 });
  }

  if (payload.sub !== key) {
    return new Response('Scope mismatch', { status: 403 });
  }

  const signedUrl = await createSignedS3Url({
    bucket: BUCKET_NAME,
    key,
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN,
    expires: Number(PRESIGN_EXPIRES || 43200),
  });

  const s3Res = await fetch(signedUrl);
  if (!s3Res.ok) {
    console.error(`[S3 ERROR] ${s3Res.status} ${s3Res.statusText}`);
    return new Response('File not found or access denied', { status: 404 });
  }

  const headers = new Headers(s3Res.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(s3Res.body, {
    status: s3Res.status,
    headers,
  });
}
