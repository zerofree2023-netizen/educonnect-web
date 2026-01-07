'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const next = sp.get('next') || '/admin';

  function login() {
    // ✅ 写入登录 cookie（7 天）
    document.cookie = `admin_authed=1; path=/; max-age=${60 * 60 * 24 * 7}`;

    // ✅ 回到原来要去的页面
    router.replace(next);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#050B1A] text-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-8">
        <h1 className="text-2xl font-bold">Admin Login</h1>
        <p className="text-white/60 text-sm mt-2">Demo login (sets cookie)</p>

        <button
          onClick={login}
          className="mt-6 w-full rounded-xl bg-blue-600 py-2 font-semibold hover:bg-blue-700 transition"
        >
          Login
        </button>
      </div>
    </main>
  );
}