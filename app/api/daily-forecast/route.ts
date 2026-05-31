import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('daily_forecast')
    .select('burgers_prevus')
    .eq('date', date)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

export async function POST(req: NextRequest) {
  const { date, burgers_prevus, employee_id } = await req.json();
  if (!date || burgers_prevus == null) {
    return NextResponse.json({ error: 'date and burgers_prevus required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('daily_forecast')
    .upsert(
      { date, burgers_prevus, updated_by: employee_id ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'date' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
