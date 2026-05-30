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
  const { title, body, url, target, excludeEmployee } = await req.json();

  let employeeIds: string[] = [];

  if (target === 'all') {
    const { data: employees, error } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('is_active', true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    employeeIds = (employees ?? []).map((e: { id: string }) => e.id);
    if (excludeEmployee) employeeIds = employeeIds.filter(id => id !== excludeEmployee);
  } else {
    const { data: admins, error } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq('is_admin', true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    employeeIds = (admins ?? []).map((a: { id: string }) => a.id);
  }

  if (!employeeIds.length) return NextResponse.json({ ok: true, sent: 0 });

  const { data: subs, error: subError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('subscription, endpoint')
    .in('employee_id', employeeIds);

  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 });
  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 });

  const payload = JSON.stringify({ title, body, url });
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

  return NextResponse.json({ ok: true, sent });
}
