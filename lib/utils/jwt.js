export async function verifyJwtHS256(token, secret) {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) throw new Error('Malformed JWT');

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
    );

    const ok = await crypto.subtle.verify(
        'HMAC',
        key,
        b64urlToU8(s),
        new TextEncoder().encode(`${h}.${p}`)
    );
    if (!ok) throw new Error('Bad signature');

    const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp || payload.exp * 1000 < Date.now())
        throw new Error('Expired');
    return payload;
}

function b64urlToU8(b64url) {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    return Uint8Array.from([...bin].map((c) => c.charCodeAt(0)));
}
