import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { title, body } = await req.json();

  // Uniquement les abonnés dont l'employé est admin
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription, employees!inner(is_admin)')
    .eq('employees.is_admin', true);
  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 });

  const payload = JSON.stringify({ title, body });
  let sent = 0;

  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch {
        // Subscription expirée — on la supprime
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', row.subscription.endpoint);
      }
    })
  );

  return NextResponse.json({ ok: true, sent });
}
