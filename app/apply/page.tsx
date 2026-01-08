'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi',
  'Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo (Congo-Brazzaville)','Costa Rica',"Côte d’Ivoire",'Croatia','Cuba','Cyprus','Czechia',
  'Democratic Republic of the Congo','Denmark','Djibouti','Dominica','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia',
  'Fiji','Finland','France',
  'Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana',
  'Haiti','Honduras','Hungary',
  'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan',
  'Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg',
  'Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Macedonia','Norway',
  'Oman',
  'Pakistan','Palau','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar',
  'Romania','Russia','Rwanda',
  'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Vanuatu','Vatican City','Venezuela','Vietnam',
  'Yemen',
  'Zambia','Zimbabwe',
];

const SORTED_COUNTRIES = [...COUNTRIES].sort((a, b) => a.localeCompare(b));

const inputClass =
  'w-full rounded-xl bg-white/10 border border-white/10 px-4 py-2 text-white placeholder:text-white/40 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30';

const selectClass =
  'w-full rounded-xl bg-white/10 border border-white/10 px-4 py-2 text-white outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30';

export default function ApplyPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const uni = useMemo(() => sp.get('uni') || '', [sp]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  const [nationality, setNationality] = useState('');
  const [nationalityOther, setNationalityOther] = useState('');
  const [currentCountry, setCurrentCountry] = useState('');
  const [currentCountryOther, setCurrentCountryOther] = useState('');

  const [degree, setDegree] = useState('');

  // ✅ 改：目前所学专业（输入框）
  const [major, setMajor] = useState('');

  // ✅ 新增：中国所学专业（志愿）1/2/3
  const [chinaMajor1, setChinaMajor1] = useState('');
  const [chinaMajor2, setChinaMajor2] = useState('');
  const [chinaMajor3, setChinaMajor3] = useState('');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!uni) return setErr('Missing university');
    if (!fullName.trim()) return setErr('Full name is required');

    const finalNationality =
      nationality === 'Other' ? (nationalityOther || '').trim() : nationality;
    const finalCurrentCountry =
      currentCountry === 'Other' ? (currentCountryOther || '').trim() : currentCountry;

    if (nationality === 'Other' && !finalNationality) return setErr('Please specify your nationality');
    if (currentCountry === 'Other' && !finalCurrentCountry) return setErr('Please specify your current country');

    setLoading(true);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          university: uni,
          full_name: fullName,
          email,
          whatsapp,
          nationality: finalNationality,
          current_country: finalCurrentCountry,
          degree,

          // ✅ 当前专业（原来 major 下拉框）
          major,

          // ✅ 志愿1/2/3
          china_major_1: chinaMajor1,
          china_major_2: chinaMajor2,
          china_major_3: chinaMajor3,
        }),
      });

      const data = await res.json();
      if (!res.ok) setErr(data?.error || 'Submit failed');
      else setMsg('✅ Submitted successfully!');
    } catch (e: any) {
      setErr(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="min-h-screen bg-gradient-to-b from-[#050B1A] to-[#050B1A] px-4 py-12">
      <div className="max-w-xl mx-auto">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-lg p-6 sm:p-8">
          <h1 className="text-3xl font-extrabold text-white">Apply</h1>

          <div className="mt-3 text-white/70">
            Selected University:
            <div className="mt-1 text-white font-semibold">{uni}</div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Full Name *">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                placeholder="Your full name"
              />
            </Field>

            <Field label="Email">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@email.com"
              />
            </Field>

            <Field label="WhatsApp">
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={inputClass}
                placeholder="+86 138..."
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nationality">
                <select
                  value={nationality}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNationality(v);
                    if (v !== 'Other') setNationalityOther('');
                  }}
                  className={selectClass}
                >
                  <option value="" className="text-black">Select nationality</option>
                  {SORTED_COUNTRIES.map((c) => (
                    <option key={c} value={c} className="text-black">{c}</option>
                  ))}
                  <option value="Other" className="text-black">Other</option>
                </select>

                {nationality === 'Other' && (
                  <input
                    value={nationalityOther}
                    onChange={(e) => setNationalityOther(e.target.value)}
                    className={`${inputClass} mt-2`}
                    placeholder="Please specify your nationality"
                  />
                )}
              </Field>

              <Field label="Current Country/Region">
                <select
                  value={currentCountry}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCurrentCountry(v);
                    if (v !== 'Other') setCurrentCountryOther('');
                  }}
                  className={selectClass}
                >
                  <option value="" className="text-black">Select current country</option>
                  {SORTED_COUNTRIES.map((c) => (
                    <option key={c} value={c} className="text-black">{c}</option>
                  ))}
                  <option value="Other" className="text-black">Other</option>
                </select>

                {currentCountry === 'Other' && (
                  <input
                    value={currentCountryOther}
                    onChange={(e) => setCurrentCountryOther(e.target.value)}
                    className={`${inputClass} mt-2`}
                    placeholder="Please specify your current country"
                  />
                )}
              </Field>
            </div>

            <Field label="Degree">
              <select value={degree} onChange={(e) => setDegree(e.target.value)} className={selectClass}>
                <option value="" className="text-black">Select degree</option>
                <option value="Bachelor" className="text-black">Bachelor</option>
                <option value="Master" className="text-black">Master</option>
                <option value="PhD" className="text-black">PhD</option>
                <option value="Language Program" className="text-black">Language Program</option>
              </select>
            </Field>

            {/* ✅ 目前所学专业：输入框 */}
            <Field label="Major (Current)">
              <input
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                className={inputClass}
                placeholder="e.g. Computer Science"
              />
            </Field>

            {/* ✅ 中国所学专业（志愿）1/2/3 */}
            <div className="space-y-4">
              <Field label="Preferred Major in China (Choice 1)">
                <input
                  value={chinaMajor1}
                  onChange={(e) => setChinaMajor1(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. MBBS / Business / Engineering"
                />
              </Field>

              <Field label="Preferred Major in China (Choice 2)">
                <input
                  value={chinaMajor2}
                  onChange={(e) => setChinaMajor2(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </Field>

              <Field label="Preferred Major in China (Choice 3)">
                <input
                  value={chinaMajor3}
                  onChange={(e) => setChinaMajor3(e.target.value)}
                  className={inputClass}
                  placeholder="Optional"
                />
              </Field>
            </div>

            {err && <ErrorBox>{err}</ErrorBox>}
            {msg && <SuccessBox>{msg}</SuccessBox>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full px-4 py-2 rounded-xl bg-white/10 text-white border border-white/10 hover:bg-white/15 transition"
              >
                Back Home
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm text-white/70 mb-1">{label}</div>
      {children}
    </label>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-red-400/20 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
      {children}
    </div>
  );
}

function SuccessBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">
      {children}
    </div>
  );
}