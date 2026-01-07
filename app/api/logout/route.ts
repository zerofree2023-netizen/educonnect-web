import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // 清 cookie（覆盖同名 cookie，让它过期）
  res.cookies.set('admin_authed', '', {
    path: '/',
    maxAge: 0,
  });

  return res;
}