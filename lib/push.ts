export async function registerPushSubscription(employeeId: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // Déjà abonné — on s'assure que c'est bien enregistré côté serveur
    await saveSubscription(existing, employeeId);
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  });

  await saveSubscription(sub, employeeId);
}

async function saveSubscription(sub: PushSubscription, employeeId: string): Promise<void> {
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), employee_id: employeeId }),
  });
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export async function notifyMeatDiscrepancy(params: {
  date: string;
  boeufCmd: number; boeufRecu: number;
  grasCmd: number;  grasRecu: number;
}): Promise<void> {
  const { date, boeufCmd, boeufRecu, grasCmd, grasRecu } = params;
  const ecartBoeuf = Math.round((boeufRecu - boeufCmd) * 1000) / 1000;
  const ecartGras  = Math.round((grasRecu  - grasCmd)  * 1000) / 1000;

  const hasBoeuf = Math.abs(ecartBoeuf) > 0.05;
  const hasGras  = Math.abs(ecartGras)  > 0.05;
  if (!hasBoeuf && !hasGras) return;

  const lines: string[] = [`⚠️ Écart viande — livraison du ${date}`];
  if (hasBoeuf) lines.push(`Bœuf : commandé ${boeufCmd} kg → reçu ${boeufRecu} kg (${ecartBoeuf > 0 ? '+' : ''}${ecartBoeuf} kg)`);
  if (hasGras)  lines.push(`Gras : commandé ${grasCmd} kg → reçu ${grasRecu} kg (${ecartGras > 0 ? '+' : ''}${ecartGras} kg)`);

  await fetch('/api/push/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '⚠️ Écart livraison viande', body: lines.slice(1).join('\n') }),
  });
}
