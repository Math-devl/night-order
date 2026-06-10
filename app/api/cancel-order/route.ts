import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function DELETE(req: NextRequest) {
  const { employeeId } = await req.json();
  if (!employeeId) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('id, is_admin, is_active')
    .eq('id', employeeId)
    .maybeSingle();

  if (!employee || !employee.is_active) {
    return NextResponse.json({ error: 'Accès révoqué.' }, { status: 403 });
  }
  if (!employee.is_admin) {
    return NextResponse.json({ error: 'Réservé aux administrateurs.' }, { status: 403 });
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = localDateStr(tomorrow);

  const j2 = new Date();
  j2.setDate(j2.getDate() + 2);
  const j2Date = localDateStr(j2);

  const { data: order } = await supabaseAdmin
    .from('daily_orders')
    .select('*')
    .eq('date', tomorrowDate)
    .gt('burgers_prevus', 0)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Aucune commande à annuler.' }, { status: 404 });
  }

  const { data: j2Row } = await supabaseAdmin
    .from('daily_orders')
    .select('id, burgers_prevus, buns_commander')
    .eq('date', j2Date)
    .maybeSingle();

  const bunsJ2Value = j2Row && j2Row.burgers_prevus === 0 ? j2Row.buns_commander : 0;

  const restored = {
    inventory: {
      fritesFraiches: String(order.frites_fraiches ?? 0),
      fritesBlanchies: String(order.frites_blanchies ?? 0),
      boulesRestantes: String(order.boules_restantes ?? 0),
      pctGras: String(order.pct_gras ?? 26.5),
      bunsRestants: String(order.buns_restants ?? 0),
      bunsJeter: '',
      bunsJ2: bunsJ2Value > 0 ? String(bunsJ2Value) : '',
    },
    forecast: {
      burgersPrevus: String(order.burgers_prevus),
      extraBoulesBoeuf: '',
    },
  };

  await supabaseAdmin.from('morning_reception').delete().eq('order_id', order.id);

  const { error } = await supabaseAdmin.from('daily_orders').delete().eq('id', order.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (j2Row && j2Row.burgers_prevus === 0) {
    await supabaseAdmin.from('daily_orders').delete().eq('id', j2Row.id);
  }

  return NextResponse.json({ ok: true, restored });
}
