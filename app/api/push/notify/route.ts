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

  // Récupérer les IDs des employés admin
  const { data: admins, error: adminError } = await supabaseAdmin
    .from('employees')
    .select('id')
    .eq('is_admin', true);

  if (adminError) {
    console.error('[push/notify] admin query error:', adminError.message);
    return NextResponse.json({ error: adminError.message }, { status: 500 });
  }

  const adminIds = admins?.map(a => a.id) ?? [];
  console.log('[push/notify] admin ids:', adminIds.length);

  if (!adminIds.length) return NextResponse.json({ ok: true, sent: 0 });

  // Récupérer leurs abonnements push
  const { data: subs, error: subError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription, endpoint')
    .in('employee_id', adminIds);

  if (subError) {
    console.error('[push/notify] subscriptions query error:', subError.message);
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  console.log('[push/notify] subscriptions found:', subs?.length ?? 0);

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 });

  const payload = JSON.stringify({ title, body });
  let sent = 0;

  await Promise.allSettled(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload);
        sent++;
      } catch (err) {
        console.error('[push/notify] send error, removing subscription:', (err as Error).message);
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
      }
    })
  );

  console.log('[push/notify] sent:', sent);
  return NextResponse.json({ ok: true, sent });
}
