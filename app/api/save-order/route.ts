import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FR_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { employeeId, inventory, forecast, orders, bunsJ2 } = body;

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

  const delivery = new Date();
  delivery.setDate(delivery.getDate() + 1);
  const deliveryDate = localDateStr(delivery);
  const deliveryDayName = FR_DAYS[delivery.getDay()];

  const { data: existing } = await supabaseAdmin
    .from('daily_orders').select('id, buns_commander').eq('date', deliveryDate).maybeSingle();

  const orderData = {
    date: deliveryDate,
    day_name: deliveryDayName,
    burgers_prevus: parseInt(forecast.burgersPrevus),
    frites_fraiches: parseFloat(inventory.fritesFraiches) || 0,
    frites_blanchies: parseFloat(inventory.fritesBlanchies) || 0,
    boules_restantes: parseInt(inventory.boulesRestantes) || 0,
    pct_gras: parseFloat(inventory.pctGras) || 26.5,
    buns_restants: parseInt(inventory.bunsRestants) || 0,
    frites_blanchir: orders.fritesABlanchir,
    frites_commander: orders.fritesACommander,
    viande_total: orders.viandeTotal,
    boeuf: orders.boeuf,
    gras: orders.gras,
    buns_commander: existing?.buns_commander ?? 0,
    validated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabaseAdmin.from('daily_orders').update(orderData).eq('id', existing.id)
    : await supabaseAdmin.from('daily_orders').insert(orderData);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (bunsJ2 > 0) {
    const j2 = new Date();
    j2.setDate(j2.getDate() + 2);
    const j2Date = localDateStr(j2);
    const j2Day = FR_DAYS[j2.getDay()];

    const { data: j2Existing } = await supabaseAdmin
      .from('daily_orders').select('id, burgers_prevus').eq('date', j2Date).maybeSingle();

    if (!j2Existing) {
      await supabaseAdmin.from('daily_orders').insert({
        date: j2Date, day_name: j2Day,
        burgers_prevus: 0, frites_fraiches: 0, frites_blanchies: 0,
        boules_restantes: 0, pct_gras: 26.5, buns_restants: 0,
        frites_blanchir: 0, frites_commander: 0, viande_total: 0,
        boeuf: 0, gras: 0, buns_commander: bunsJ2,
        validated_at: new Date().toISOString(),
      });
    } else if (j2Existing.burgers_prevus === 0) {
      await supabaseAdmin.from('daily_orders').update({ buns_commander: bunsJ2 }).eq('id', j2Existing.id);
    }
  }

  return NextResponse.json({ ok: true });
}
