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

export async function notifyDeliveryDiscrepancy(params: {
  date: string;
  isoDate?: string;
  fritesCmd: number; fritesRecues: number;
  boeufCmd: number;  boeufRecu: number;
  grasCmd: number;   grasRecu: number;
  bunsCmd: number;   bunsRecus: number;
}): Promise<void> {
  const { date, isoDate, fritesCmd, fritesRecues, boeufCmd, boeufRecu, grasCmd, grasRecu, bunsCmd, bunsRecus } = params;

  const ecartFrites = Math.round((fritesRecues - fritesCmd) * 10) / 10;
  const ecartBoeuf  = Math.round((boeufRecu - boeufCmd) * 1000) / 1000;
  const ecartGras   = Math.round((grasRecu  - grasCmd)  * 1000) / 1000;
  const ecartBuns   = bunsRecus - bunsCmd;

  const hasFrites = Math.abs(ecartFrites) > 0.1;
  const hasBoeuf  = Math.abs(ecartBoeuf)  > 0.05;
  const hasGras   = Math.abs(ecartGras)   > 0.05;
  const hasBuns   = Math.abs(ecartBuns)   >= 1;

  if (!hasFrites && !hasBoeuf && !hasGras && !hasBuns) return;

  const fmt = (v: number) => (v > 0 ? '+' : '') + v;
  const lines: string[] = [];
  if (hasFrites) lines.push(`Frites : commandé ${fritesCmd} kg → reçu ${fritesRecues} kg (${fmt(ecartFrites)} kg)`);
  if (hasBoeuf)  lines.push(`Bœuf : commandé ${boeufCmd} kg → reçu ${boeufRecu} kg (${fmt(ecartBoeuf)} kg)`);
  if (hasGras)   lines.push(`Gras : commandé ${grasCmd} kg → reçu ${grasRecu} kg (${fmt(ecartGras)} kg)`);
  if (hasBuns)   lines.push(`Buns : commandé ${bunsCmd} → reçu ${bunsRecus} (${fmt(ecartBuns)})`);

  const url = isoDate ? `/admin?tab=historique&date=${isoDate}` : '/admin?tab=historique';
  await fetch('/api/push/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: `⚠️ Écart livraison — ${date}`, body: lines.join('\n'), url }),
  });
}

export async function notifyOrderValidated(params: {
  dayName: string;
  burgers: number;
  frites: number;
  viande: number;
  buns: number;
}): Promise<void> {
  const { dayName, burgers, frites, viande, buns } = params;
  await fetch('/api/push/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `✅ Commande validée — ${dayName} soir`,
      body: `${burgers} burgers · ${frites} kg frites · ${viande} kg viande · ${buns} buns`,
      url: '/admin?tab=historique',
    }),
  });
}

export async function notifyReceptionSaved(date: string): Promise<void> {
  await fetch('/api/push/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `📦 Livraison confirmée — ${date}`,
      body: 'Les quantités reçues ont été enregistrées.',
      url: '/admin?tab=historique',
    }),
  });
}

export async function notifyNewPrepTask(taskText: string, excludeEmployeeId?: string): Promise<void> {
  await fetch('/api/push/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '📋 Nouvelle tâche préparation',
      body: taskText,
      url: '/mobile?screen=preparation',
      target: 'all',
      excludeEmployee: excludeEmployeeId,
    }),
  });
}

/** @deprecated use notifyDeliveryDiscrepancy */
export async function notifyMeatDiscrepancy(params: {
  date: string;
  boeufCmd: number; boeufRecu: number;
  grasCmd: number;  grasRecu: number;
}): Promise<void> {
  await notifyDeliveryDiscrepancy({
    date: params.date,
    fritesCmd: 0, fritesRecues: 0,
    boeufCmd: params.boeufCmd, boeufRecu: params.boeufRecu,
    grasCmd: params.grasCmd, grasRecu: params.grasRecu,
    bunsCmd: 0, bunsRecus: 0,
  });
}
