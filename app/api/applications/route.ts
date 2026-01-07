import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ✅ GET /api/applications  (列表)
export async function GET() {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data: data ?? [] }, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

// ✅ POST /api/applications (提交申请)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = supabaseAdmin();

    const { data, error } = await supabase
      .from('applications')
      .insert([
        {
          university_name: body.university_name,
          full_name: body.full_name,
          email: body.email,
          whatsapp: body.whatsapp,
          nationality: body.nationality,
          current_country: body.current_country,
          degree: body.degree,
          majors: body.majors,
          china_major_1: body.china_major_1,
          china_major_2: body.china_major_2,
          china_major_3: body.china_major_3,
          status: body.status ?? 'Submitted',
        },
      ])
      .select('*')
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ data }, { status: 200 });
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}