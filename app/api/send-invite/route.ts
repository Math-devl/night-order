import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email, first_name, last_name, code, is_admin } = await req.json();

  if (!first_name || !code) {
    return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const mobileUrl = `${appUrl}/mobile`;
  const adminUrl = `${appUrl}/admin`;

  // Si admin avec email : créer le compte Supabase Auth et générer le lien
  let adminInviteLink: string | null = null;
  if (is_admin && email) {
    const { data } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: adminUrl },
    });
    adminInviteLink = data?.properties?.action_link ?? null;
  }

  const adminSection = adminInviteLink ? `
      <div style="background:#FFF0F5;border-radius:16px;padding:20px;margin-bottom:24px;">
        <p style="color:#A0909A;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">Accès administrateur</p>
        <p style="color:#1A1209;font-size:13px;margin:0 0 12px;">En tant qu'administrateur, tu as accès à l'interface de gestion. Clique ci-dessous pour définir ton mot de passe admin.</p>
        <a href="${adminInviteLink}" style="display:inline-block;background:#FF4D8A;color:#fff;font-size:14px;font-weight:700;padding:12px 24px;border-radius:12px;text-decoration:none;">
          Créer mon mot de passe admin →
        </a>
        <p style="color:#A0909A;font-size:11px;margin:10px 0 0;">Lien valable 24h · Interface : <a href="${adminUrl}" style="color:#FF4D8A;">${adminUrl}</a></p>
      </div>` : '';

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FFF0F5;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:#596643;padding:32px 32px 24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:8px;">🍔</div>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 4px;">Night Order</h1>
      <p style="color:#8BA870;font-size:13px;margin:0;">Ton accès à l'application</p>
    </div>

    <div style="padding:32px;">
      <p style="color:#1A1209;font-size:15px;margin:0 0 24px;">
        Bonjour <strong>${first_name}</strong>,<br><br>
        Ton compte Night Order a été créé. Voici tout ce qu'il te faut pour accéder à l'application.
      </p>

      <div style="background:#FFF0F5;border-radius:16px;padding:20px;margin-bottom:24px;text-align:center;">
        <p style="color:#A0909A;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 4px;">Ton code d'accès app commandes</p>
        <p style="color:#FF4D8A;font-size:48px;font-weight:700;letter-spacing:0.3em;margin:0;">${code}</p>
        <p style="color:#A0909A;font-size:11px;margin:8px 0 0;">Tu pourras le modifier depuis l'onglet Compte</p>
      </div>

      <div style="background:#F5F5F5;border-radius:16px;padding:20px;margin-bottom:24px;">
        <p style="color:#1A1209;font-size:13px;font-weight:600;margin:0 0 4px;">Lien vers l'app commandes</p>
        <a href="${mobileUrl}" style="color:#FF4D8A;font-size:14px;font-weight:700;word-break:break-all;">${mobileUrl}</a>
      </div>

      ${adminSection}

      <div style="margin-bottom:12px;">
        <h2 style="color:#1A1209;font-size:15px;font-weight:700;margin:0 0 12px;">📱 Ajouter l'app à ton écran d'accueil</h2>

        <div style="border:1px solid #E8E8E8;border-radius:12px;padding:16px;margin-bottom:10px;">
          <p style="color:#1A1209;font-size:13px;font-weight:700;margin:0 0 8px;">🍎 iPhone (Safari)</p>
          <ol style="color:#555;font-size:13px;margin:0;padding-left:18px;line-height:1.7;">
            <li>Ouvre Safari et va sur le lien ci-dessus</li>
            <li>Appuie sur le bouton <strong>Partager</strong> ⎋ (en bas de l'écran)</li>
            <li>Sélectionne <strong>« Sur l'écran d'accueil »</strong></li>
            <li>Confirme en appuyant sur <strong>Ajouter</strong></li>
          </ol>
        </div>

        <div style="border:1px solid #E8E8E8;border-radius:12px;padding:16px;">
          <p style="color:#1A1209;font-size:13px;font-weight:700;margin:0 0 8px;">🤖 Android (Chrome)</p>
          <ol style="color:#555;font-size:13px;margin:0;padding-left:18px;line-height:1.7;">
            <li>Ouvre Chrome et va sur le lien ci-dessus</li>
            <li>Appuie sur le menu <strong>⋮</strong> (en haut à droite)</li>
            <li>Sélectionne <strong>« Ajouter à l'écran d'accueil »</strong></li>
            <li>Confirme en appuyant sur <strong>Ajouter</strong></li>
          </ol>
        </div>
      </div>
    </div>

    <div style="background:#F5F5F5;padding:16px 32px;text-align:center;">
      <p style="color:#A0909A;font-size:11px;margin:0;">Night Order · Ne pas répondre à cet e-mail</p>
    </div>

  </div>
</body>
</html>
`;

  const { data, error } = await resend.emails.send({
    from: 'Night Order <noreply@monsmashe.com>',
    to: email || 'mathieu.devliegher@gmail.com',
    subject: `Ton accès Night Order — code : ${code}`,
    html,
  });

  if (error) {
    console.error('[send-invite] Resend error:', JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log('[send-invite] Email sent:', data?.id);
  return NextResponse.json({ ok: true });
}
