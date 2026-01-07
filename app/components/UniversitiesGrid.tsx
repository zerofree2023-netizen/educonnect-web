'use client';

import { useRouter } from "next/navigation";

type University = {
  id: string;
  name: string;
  city?: string | null;
  tag?: string | null;
  created_at?: string | null;

  // 如果你有图片字段也可以加：
  image_url?: string | null;
};

export default function UniversitiesGrid({
  universities,
  onSelectUni,
  onBack,
}: {
  universities: University[];
  onSelectUni?: (name: string) => void;
  onBack?: () => void;
}) {
  const router = useRouter(); // ✅ 新增
  const list = universities || [];

  return (
    <section className="py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <h2 className="text-3xl font-extrabold text-white">Universities</h2>

          <div className="flex gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 rounded-full bg-white/10 text-white border border-white/10 hover:bg-white/15 transition"
              >
                Back
              </button>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {list.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-lg overflow-hidden"
            >
              {/* 图片区（可留可删） */}
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
                    onClick={() => {
                      // ✅ 优先走外部回调（如果你有），否则默认自己跳转
                      if (onSelectUni) return onSelectUni(u.name);

                      router.push(`/apply?uni=${encodeURIComponent(u.name)}`);
                    }}
                    className="w-full px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {list.length === 0 && (
          <div className="mt-10 text-white/70">
            No universities yet. Add rows in Supabase, then refresh.
          </div>
        )}
      </div>
    </section>
  );
}