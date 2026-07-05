import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { localDateStr } from '@/lib/dates';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);


// Sans date explicite, la clé est J+1 calculée côté serveur (comme le brouillon
// d'inventaire) : un client resté ouvert à cheval sur minuit ne peut plus lire
// ni écrire la prévision du mauvais soir.
function deliveryDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? deliveryDateStr();

  const { data, error } = await supabaseAdmin
    .from('daily_forecast')
    .select('burgers_prevus, extra_boules_boeuf')
    .eq('date', date)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

export async function POST(req: NextRequest) {
  const { date: explicitDate, burgers_prevus, extra_boules_boeuf, employee_id } = await req.json();
  if (burgers_prevus == null && extra_boules_boeuf == null) {
    return NextResponse.json({ error: 'burgers_prevus ou extra_boules_boeuf requis' }, { status: 400 });
  }
  const date = explicitDate ?? deliveryDateStr();

  // Lecture-fusion : un POST qui n'envoie qu'un des deux champs ne doit pas
  // écraser l'autre. Fenêtre de course acceptée : entre cette lecture et
  // l'upsert, un autre POST peut écrire l'autre champ et sera écrasé par la
  // ligne complète (dernier écrivain gagne). Compromis assumé : petite équipe,
  // débounce 800 ms côté client, deux champs rarement modifiés au même instant.
  const { data: existing } = await supabaseAdmin
    .from('daily_forecast')
    .select('burgers_prevus, extra_boules_boeuf')
    .eq('date', date)
    .maybeSingle();

  const { error } = await supabaseAdmin
    .from('daily_forecast')
    .upsert(
      {
        date,
        burgers_prevus: burgers_prevus ?? existing?.burgers_prevus ?? 0,
        extra_boules_boeuf: extra_boules_boeuf ?? existing?.extra_boules_boeuf ?? 0,
        updated_by: employee_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'date' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Source de vérité unique : si une commande planifiée (non validée) existe pour
  // cette date, son burgers_prevus reflète la prévision — l'admin voit le même
  // chiffre que le mobile. On ne touche JAMAIS une commande validée (brouillon
  // 'validated') ni les quantités commandées. L'extra bœuf est une entrée de
  // calcul, pas une prévision de volume : il ne se synchronise pas ici.
  if (burgers_prevus == null) return NextResponse.json({ ok: true, date });

  const { data: order } = await supabaseAdmin
    .from('daily_orders')
    .select('id')
    .eq('date', date)
    .maybeSingle();
  if (order) {
    const { data: draft } = await supabaseAdmin
      .from('inventory_drafts')
      .select('status')
      .eq('date', date)
      .maybeSingle();
    if (draft?.status !== 'validated') {
      await supabaseAdmin.from('daily_orders').update({ burgers_prevus }).eq('id', order.id);
    }
  }

  return NextResponse.json({ ok: true, date });
}
