'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type ApplicationRow = {
  id: string;
  created_at?: string | null;
  university_name?: string | null;

  full_name: string;
  email?: string | null;
  whatsapp?: string | null;

  nationality?: string | null;
  current_country?: string | null;

  degree?: string | null;
  majors?: string | null;

  china_major_1?: string | null;
  china_major_2?: string | null;
  china_major_3?: string | null;

  status?: string | null;
};

const STATUS_OPTIONS = ['Submitted', 'Reviewing', 'Approved', 'Rejected'] as const;

export default function AdminPage() {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  async function load() {
      async function logout() {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login?next=/admin';
    }
  }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/applications', { cache: 'no-store' });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) throw new Error(json?.error || 'Failed to load applications');

      // 兼容两种返回：[{...}] 或 {data:[...]}
      const list = Array.isArray(json) ? json : json?.data;
      setRows(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || 'Load error');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    // 乐观更新
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok) throw new Error(json?.error || 'Update failed');
    } catch (e: any) {
      alert(e?.message || 'Update failed');
      load(); // 回滚：重新拉
    }
  }

  // ✅ 这里就是“步骤2”应该放的位置：在 return 之前，组件函数内部
  async function logout() {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    return rows
      .filter((r) => (statusFilter === 'ALL' ? true : (r.status || 'Submitted') === statusFilter))
      .filter((r) => {
        if (!keyword) return true;
        const blob = [
          r.full_name,
          r.email,
          r.whatsapp,
          r.university_name,
          r.nationality,
          r.current_country,
          r.degree,
          r.majors,
          r.china_major_1,
          r.china_major_2,
          r.china_major_3,
          r.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(keyword);
      })
      .sort((a, b) => (a.created_at && b.created_at ? (a.created_at < b.created_at ? 1 : -1) : 0));
  }, [rows, q, statusFilter]);

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#050B1A] to-[#050B1A] px-4 py-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold text-white">Admin — Applications</h1>
            <div className="text-white/60 mt-1 text-sm">
              Total: {rows.length} · Showing: {filtered.length}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name / email / uni / major..."
              className="w-[280px] max-w-full rounded-xl bg-white/10 border border-white/10 px-4 py-2 text-white placeholder:text-white/40 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl bg-white/10 border border-white/10 px-4 py-2 text-white outline-none focus:border-blue-500/50"
            >
              <option value="ALL" className="text-black">
                All status
              </option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s} className="text-black">
                  {s}
                </option>
              ))}
            </select>

            <button
              onClick={load}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
            >
              Refresh
            </button>

            <button
              onClick={logout}
              className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white font-semibold hover:bg-white/15 transition"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-6 text-white/70">Loading...</div>
          ) : err ? (
            <div className="p-6 text-red-200">
              <div className="font-semibold">Load failed</div>
              <div className="mt-1 text-sm text-red-200/80">{err}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-white/70">No applications.</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-[1300px] w-full text-sm">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <Th>Time</Th>
                    <Th>Full name</Th>
                    <Th>Email</Th>
                    <Th>WhatsApp</Th>
                    <Th>University</Th>
                    <Th>Nationality</Th>
                    <Th>Current country</Th>
                    <Th>Degree</Th>
                    <Th>Major (Current)</Th>
                    <Th>CN Choice 1</Th>
                    <Th>CN Choice 2</Th>
                    <Th>CN Choice 3</Th>
                    <Th>Status</Th>
                    <Th>View</Th>
                  </tr>
                </thead>

                <tbody className="text-white">
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-white/10 hover:bg-white/5">
                      <Td>{formatTime(r.created_at)}</Td>
                      <Td className="font-semibold">{r.full_name}</Td>
                      <Td>{r.email || '-'}</Td>
                      <Td>{r.whatsapp || '-'}</Td>
                      <Td>{r.university_name || '-'}</Td>
                      <Td>{r.nationality || '-'}</Td>
                      <Td>{r.current_country || '-'}</Td>
                      <Td>{r.degree || '-'}</Td>
                      <Td>{r.majors || '-'}</Td>
                      <Td>{r.china_major_1 || '-'}</Td>
                      <Td>{r.china_major_2 || '-'}</Td>
                      <Td>{r.china_major_3 || '-'}</Td>

                      <Td>
                        <select
                          value={r.status || 'Submitted'}
                          onChange={(e) => updateStatus(r.id, e.target.value)}
                          className="rounded-lg bg-white/10 border border-white/10 px-3 py-1.5 text-white outline-none focus:border-blue-500/50"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s} className="text-black">
                              {s}
                            </option>
                          ))}
                        </select>
                      </Td>

                      <Td>
                        <Link
                          href={`/admin/${r.id}`}
                          className="inline-flex items-center rounded-lg bg-white/10 border border-white/10 px-3 py-1.5 hover:bg-white/15 transition"
                        >
                          View
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-white/40 text-xs mt-3">
          Tip: status changes call <code>/api/applications/[id]</code> with PATCH.
        </div>
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 whitespace-nowrap ${className}`}>{children}</td>;
}

function formatTime(v?: string | null) {
  if (!v) return '-';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}