import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // 清掉登录 cookie（你之前用的是 admin_authed）
  res.cookies.set('admin_authed', '', {
    path: '/',
    maxAge: 0,
  });

  return res;
}