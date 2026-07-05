import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { localDateStr } from '@/lib/dates';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('inventory_drafts')
    .select('*')
    .eq('date', date)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { employeeId, inventory, burgersPrevus } = body;

  if (!employeeId) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('is_active', true)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: 'Accès révoqué.' }, { status: 403 });
  }

  // La date de livraison (J+1) est calculée côté serveur, jamais reçue du client,
  // avec la même logique que save-order — évite toute désynchronisation à minuit.
  const delivery = new Date();
  delivery.setDate(delivery.getDate() + 1);
  const deliveryDate = localDateStr(delivery);

  const { error } = await supabaseAdmin
    .from('inventory_drafts')
    .upsert(
      {
        date: deliveryDate,
        frites_fraiches: String(inventory?.fritesFraiches ?? ''),
        frites_blanchies: String(inventory?.fritesBlanchies ?? ''),
        boules_restantes: String(inventory?.boulesRestantes ?? ''),
        pct_gras: String(inventory?.pctGras ?? ''),
        buns_restants: String(inventory?.bunsRestants ?? ''),
        buns_jeter: String(inventory?.bunsJeter ?? ''),
        buns_j2: String(inventory?.bunsJ2 ?? ''),
        burgers_prevus: String(burgersPrevus ?? ''),
        status: 'draft',
        updated_by: employeeId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'date' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, date: deliveryDate });
}
