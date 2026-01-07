import UniversitiesGrid from "./components/UniversitiesGrid";

type University = {
  id: string;
  name: string;
  city?: string | null;
  tag?: string | null;
  created_at?: string | null;
};

async function getUniversities(): Promise<University[]> {
  // ✅ 开发环境先用这个写法最稳
  const res = await fetch("http://localhost:3000/api/universities", {
    cache: "no-store",
  });

  if (!res.ok) return [];
  return res.json();
}

export default async function Home() {
  const universities = await getUniversities();

  return (
    <div className="min-h-screen bg-slate-950">
      <UniversitiesGrid universities={universities} />
    </div>
  );
}