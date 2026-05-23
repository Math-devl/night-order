import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

export interface SendRequest {
  messages: {
    supplierName: string;
    contactType: 'whatsapp' | 'whatsapp_group' | 'sms';
    to: string;
    body: string;
  }[];
}

export interface SendResult {
  supplierName: string;
  status: 'sent' | 'failed' | 'manual';
  error?: string;
}

// ─── Meta WhatsApp Cloud API ──────────────────────────────────────────────────

async function sendWhatsApp(to: string, body: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) throw new Error('Meta WhatsApp non configuré');

  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace(/[^\d]/g, ''),
      type: 'text',
      text: { body },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Meta API ${res.status}`);
  }
}

// ─── OVH SMS ─────────────────────────────────────────────────────────────────

async function sendSMS(to: string, body: string): Promise<void> {
  const appKey = process.env.OVH_APP_KEY;
  const appSecret = process.env.OVH_APP_SECRET;
  const consumerKey = process.env.OVH_CONSUMER_KEY;
  const serviceName = process.env.OVH_SMS_SERVICE;
  const sender = process.env.OVH_SMS_SENDER ?? 'NightOrder';
  if (!appKey || !appSecret || !consumerKey || !serviceName) throw new Error('OVH SMS non configuré');

  const url = `https://eu.api.ovh.com/1.0/sms/${serviceName}/jobs/`;
  const timestamp = Math.round(Date.now() / 1000);
  const bodyStr = JSON.stringify({
    message: body,
    receivers: [to],
    sender,
    noStopClause: true,
    priority: 'high',
  });

  const toSign = [appSecret, consumerKey, 'POST', url, bodyStr, timestamp].join('+');
  const signature = '$1$' + createHash('sha1').update(toSign).digest('hex');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ovh-Application': appKey,
      'X-Ovh-Consumer': consumerKey,
      'X-Ovh-Timestamp': String(timestamp),
      'X-Ovh-Signature': signature,
    },
    body: bodyStr,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OVH SMS ${res.status}: ${err}`);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { messages } = (await req.json()) as SendRequest;

  const results: SendResult[] = await Promise.all(
    messages.map(async ({ supplierName, contactType, to, body }) => {
      if (contactType === 'whatsapp_group') {
        return { supplierName, status: 'manual' as const };
      }
      try {
        if (contactType === 'sms') {
          await sendSMS(to, body);
        } else {
          await sendWhatsApp(to, body);
        }
        return { supplierName, status: 'sent' as const };
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Erreur inconnue';
        return { supplierName, status: 'failed' as const, error };
      }
    })
  );

  return NextResponse.json({ results });
}
