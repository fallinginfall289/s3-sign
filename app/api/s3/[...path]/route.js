import { createSignedS3Url } from '@/lib/utils/aws-signature';

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
    ALLOWED_FOLDERS,
  } = process.env;

  const allowedFolders = (ALLOWED_FOLDERS || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  const firstSegment = key.split('/')[0];
  if (!allowedFolders.includes(firstSegment)) {
    return new Response('Access denied: invalid folder', { status: 403 });
  }

  const signedUrl = await createSignedS3Url({
    bucket: BUCKET_NAME,
    key,
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN,
  });

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
