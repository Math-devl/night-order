export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  await navigator.serviceWorker.register('/sw.js');
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function enablePushNotifications(employeeId: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  const reg = await navigator.serviceWorker.ready;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const existing = await reg.pushManager.getSubscription();
  const sub = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
  });

  await saveSubscription(sub, employeeId);
  return true;
}

export async function registerPushSubscription(employeeId: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (!('Notification' in window)) return;

  await navigator.serviceWorker.register('/sw.js');
  const reg = await navigator.serviceWorker.ready;

  // Si déjà autorisé, re-sync l'abonnement silencieusement
  if (Notification.permission === 'granted') {
    const existing = await reg.pushManager.getSubscription();
    if (existing) { await saveSubscription(existing, employeeId); return; }
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    await saveSubscription(sub, employeeId);
  }
  // Si 'default' → on n'affiche pas la demande automatiquement (iOS l'interdit sans geste)
  // Le bouton dans CompteScreen prend le relais
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
