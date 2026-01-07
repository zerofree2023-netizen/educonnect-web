import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: '' }));

  const correct = process.env.ADMIN_PASSWORD;
  if (!correct) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD not set' }, { status: 500 });
  }

  if (password !== correct) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });

  // ✅ HttpOnly Cookie：前端 JS 读不到
  res.cookies.set('admin_authed', '1', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // 本地 dev 不能用 secure，否则不写入
    secure: false,
    maxAge: 60 * 60 * 24 * 7, // 7 天
  });

  return res;
}