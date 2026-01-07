import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    if (!id || id === 'undefined' || id === '{uuid}' || id.startsWith('<')) {
      return Response.json({ error: 'Invalid id' }, { status: 400 });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    if (!data) return Response.json({ error: 'Not found' }, { status: 404 });

    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    if (!id || id === 'undefined' || id === '{uuid}' || id.startsWith('<')) {
      return Response.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const status = body?.status;

    if (!status) return Response.json({ error: 'Missing status' }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from('applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e?.message || 'Server error' }, { status: 500 });
  }
}