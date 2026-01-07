'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type Application = {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;

  university_name?: string | null;

  full_name?: string | null;
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

  [key: string]: any;
};

const STATUS_OPTIONS = ['Submitted', 'Reviewing', 'Approved', 'Rejected'] as const;

export default function AdminDetailPage() {
  const router = useRouter();
  const params = useParams<{ id?: string }>();

  // ✅ 融合：优先 params.id，拿不到再从 window pathname 取
  const id = useMemo(() => {
    const pid = params?.id;
    if (typeof pid === 'string' && pid.trim()) return pid;
    return getIdFromPath();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id]);

  const [row, setRow] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function logout() {
    // ✅ 删除 cookie（简单版：覆盖为过期）
    document.cookie = `admin_authed=; Path=/; Max-Age=0`;

    // 回到登录页，并带 next（方便登录后跳回）
    const next = `/admin/${encodeURIComponent(id || '')}`;
    router.push(`/login?next=${encodeURIComponent(next)}`);
    router.refresh();
  }

  async function load() {
    if (!id) {
      setErr('Missing id in URL.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) throw new Error(json?.error || 'Failed to load application');

      const data = json?.data ?? json;
      setRow(data && typeof data === 'object' ? data : null);
    } catch (e: any) {
      setErr(e?.message || 'Load error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function updateStatus(nextStatus: string) {
    if (!row?.id) return;

    const optimisticUpdatedAt = new Date().toISOString();
    setRow((prev) => (prev ? { ...prev, status: nextStatus, updated_at: optimisticUpdatedAt } : prev));

    setSaving(true);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;

      if (!res.ok) throw new Error(json?.error || 'Update failed');

      const updated = json?.data ?? json;
      if (updated && updated.id) setRow((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (e: any) {
      alert(e?.message || 'Update failed');
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#050B1A] to-[#050B1A] px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold text-white">Application Detail</h1>
            <div className="text-white/60 mt-1 text-sm">
              <span className="mr-2">ID:</span>
              <code className="text-white/80">{id || '-'}</code>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link
              href="/admin"
              className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition"
            >
              ← Back to list
            </Link>

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
          ) : !row ? (
            <div className="p-6 text-white/70">No data.</div>
          ) : (
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={row.status || 'Submitted'} />
                    {saving && <span className="text-white/50 text-xs">Saving...</span>}
                  </div>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <Meta label="Created">{formatTime(row.created_at)}</Meta>
                    <Meta label="Updated">{formatTime(row.updated_at)}</Meta>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-white/70 text-sm">Change status</span>
                  <select
                    value={row.status || 'Submitted'}
                    onChange={(e) => updateStatus(e.target.value)}
                    className="rounded-xl bg-white/10 border border-white/10 px-4 py-2 text-white outline-none focus:border-blue-500/50"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s} className="text-black">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Divider />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card title="Applicant">
                  <Field label="Full name" value={row.full_name} />
                  <Field
                    label="Email"
                    value={row.email}
                    right={<CopyBtn value={row.email || ''} disabled={!row.email} />}
                  />
                  <Field
                    label="WhatsApp"
                    value={row.whatsapp}
                    right={<CopyBtn value={row.whatsapp || ''} disabled={!row.whatsapp} />}
                  />
                </Card>

                <Card title="University / Program">
                  <Field label="University" value={row.university_name} />
                  <Field label="Degree" value={row.degree} />
                  <Field label="Major (Current)" value={row.majors} />
                </Card>

                <Card title="Location">
                  <Field label="Nationality" value={row.nationality} />
                  <Field label="Current country" value={row.current_country} />
                </Card>

                <Card title="China Major Choices">
                  <Field label="CN Choice 1" value={row.china_major_1} />
                  <Field label="CN Choice 2" value={row.china_major_2} />
                  <Field label="CN Choice 3" value={row.china_major_3} />
                </Card>
              </div>

              <Divider />

              <details className="mt-2">
                <summary className="cursor-pointer text-white/70 hover:text-white transition">
                  Show raw JSON (debug)
                </summary>
                <pre className="mt-3 overflow-auto rounded-xl bg-black/40 border border-white/10 p-4 text-xs text-white/80">
{JSON.stringify(row, null, 2)}
                </pre>
              </details>

              <div className="mt-4 flex items-center gap-2 text-xs text-white/50">
                <span>Tip:</span>
                <code>/api/applications/[id]</code>
                <span>supports</span>
                <code>GET</code>
                <span>&</span>
                <code>PATCH</code>
                <span>·</span>
                <span>
                  Copy ID <CopyBtn value={row.id} small />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** ---------- UI helpers ---------- */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-white font-semibold">{title}</div>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  right,
}: {
  label: string;
  value?: string | null;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-white/55 text-xs">{label}</div>
        <div className="text-white mt-0.5 break-words">{value?.toString() || '-'}</div>
      </div>
      {right ? <div className="shrink-0 mt-4">{right}</div> : null}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-white/55 text-xs">{label}</div>
      <div className="text-white mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="my-6 h-px bg-white/10" />;
}

function StatusBadge({ status }: { status: string }) {
  const { bg, text, border } = statusStyle(status);
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
        bg,
        text,
        border,
      ].join(' ')}
    >
      {status}
    </span>
  );
}

function statusStyle(status: string) {
  switch (status) {
    case 'Approved':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-200', border: 'border-emerald-500/30' };
    case 'Rejected':
      return { bg: 'bg-rose-500/15', text: 'text-rose-200', border: 'border-rose-500/30' };
    case 'Reviewing':
      return { bg: 'bg-amber-500/15', text: 'text-amber-200', border: 'border-amber-500/30' };
    case 'Submitted':
    default:
      return { bg: 'bg-sky-500/15', text: 'text-sky-200', border: 'border-sky-500/30' };
  }
}

function formatTime(v?: string | null) {
  if (!v) return '-';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function CopyBtn({
  value,
  disabled,
  small,
}: {
  value: string;
  disabled?: boolean;
  small?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      alert('Copy failed');
    }
  }

  return (
    <button
      onClick={copy}
      disabled={disabled || !value}
      className={[
        small ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
        'rounded-lg border border-white/10 bg-white/10 text-white/90 hover:bg-white/15 transition',
        disabled || !value ? 'opacity-40 cursor-not-allowed' : '',
      ].join(' ')}
      title={value || ''}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/** ✅ fallback：不依赖 next params，从 URL 取 id */
function getIdFromPath() {
  if (typeof window === 'undefined') return '';
  const parts = window.location.pathname.split('/').filter(Boolean);
  const idx = parts.indexOf('admin');
  const maybe = idx >= 0 ? parts[idx + 1] : parts[1];
  return maybe ? decodeURIComponent(maybe) : '';
}