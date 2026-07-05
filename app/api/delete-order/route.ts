import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });

  const { data: order } = await supabaseAdmin
    .from('daily_orders')
    .select('id, date')
    .eq('id', id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 });

  // Miroir de cancel-order : le brouillon repasse en 'draft' AVANT toute
  // suppression — sinon un brouillon 'validated' orphelin bloquerait la
  // saisie mobile du soir. Échec = on ne supprime pas.
  const { error: draftError } = await supabaseAdmin
    .from('inventory_drafts')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('date', order.date);
  if (draftError) {
    return NextResponse.json(
      { error: 'Suppression impossible (brouillon) : ' + draftError.message },
      { status: 500 }
    );
  }

  // Supprimer la réception liée en premier (contrainte FK)
  await supabaseAdmin.from('morning_reception').delete().eq('order_id', id);

  const { error } = await supabaseAdmin.from('daily_orders').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
