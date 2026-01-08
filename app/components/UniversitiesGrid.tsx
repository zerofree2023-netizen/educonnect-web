'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type University = {
  id: string;
  name: string;
  city?: string | null;
  tag?: string | null;
  created_at?: string | null;
  image_url?: string | null;
};

const Card = ({ u, onApply }: { u: University; onApply: () => void }) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-lg overflow-hidden">
      <div className="h-36 w-full bg-white/10">
        {u.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.image_url} alt={u.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-white/40 text-sm">
            No image
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-white">{u.name}</div>
            {u.city && <div className="text-sm text-white/70 mt-1">{u.city}</div>}
          </div>

          {u.tag && (
            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/20">
              {u.tag}
            </span>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onApply}
            className="w-full px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

export default function UniversitiesGrid() {
  const router = useRouter();

  const [rows, setRows] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ✅ 重要：客户端 fetch，用相对路径，不要写 localhost
  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch('/api/universities', { cache: 'no-store' });
        const text = await res.text();
        const json = text ? JSON.parse(text) : null;

        if (!res.ok) {
          throw new Error(json?.error || `Failed to load universities (${res.status})`);
        }

        if (alive) setRows(Array.isArray(json) ? json : []);
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Network error');
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const list = useMemo(() => rows || [], [rows]);

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#050B1A] to-[#050B1A] py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h2 className="text-3xl font-extrabold text-white">Universities</h2>

          <button
            onClick={() => location.reload()}
            className="px-4 py-2 rounded-full bg-white/10 text-white border border-white/10 hover:bg-white/15 transition"
          >
            Refresh
          </button>
        </div>

        {loading && <div className="text-white/70">Loading…</div>}
        {err && (
          <div className="rounded-xl border border-red-400/20 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
            {err}
          </div>
        )}

        {!loading && !err && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {list.map((u) => (
                <Card
                  key={u.id}
                  u={u}
                  onApply={() => router.push(`/apply?uni=${encodeURIComponent(u.name)}`)}
                />
              ))}
            </div>

            {list.length === 0 && (
              <div className="mt-10 text-white/70">
                No universities yet. Add rows in Supabase, then refresh.
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}