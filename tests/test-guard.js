// ============================================================================
// GARDE-FOUS PARTAGÉS DES SUITES DE TEST
//
// ⚠️  CONTEXTE : il n'existe qu'UN SEUL projet Supabase (celui de PRODUCTION,
//     via .env.local). Les tests s'exécutent donc sur la base RÉELLE.
//     localhost protège le CODE, pas les DONNÉES.
//
// ⚠️  NE JAMAIS lancer une suite PENDANT LE SERVICE (18 h – 00 h). Un membre
//     de l'équipe peut valider la commande du lendemain à tout moment ; une
//     suite qui écrit/supprime sur J+1 écraserait cette donnée réelle
//     (incident du 05/07 : un DELETE aveugle a effacé la commande validée).
//
// Deux régimes de protection, selon la nature de la suite :
//   • Suites « chemin admin » (dates explicites) → ciblent EXCLUSIVEMENT des
//     dates factices 2099 (assertFakeDate + guardEmpty + safeDeleteFake).
//   • Suites « flux mobile » (date = J+1 calculé côté serveur, non
//     redirigeable) → guardEmpty sur J+1/J+2 : si une donnée réelle existe,
//     ABORT ; nettoyage par snapshot-restore (ne supprime que ce que le test
//     a créé, ne touche jamais une ligne préexistante).
// ============================================================================

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Lit les variables d'environnement Supabase. Priorité à process.env (CI),
// sinon parse .env.local à la racine du dépôt (gitignoré — jamais committé).
// Variables attendues : NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (+ NEXT_PUBLIC_SUPABASE_ANON_KEY pour la génération des fixtures).
function loadEnv() {
  const env = { ...process.env };
  const envPath = path.join(__dirname, '..', '.env.local'); // tests/ → racine dépôt
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      if (!line.includes('=')) continue;
      const k = line.slice(0, line.indexOf('=')).trim();
      const v = line.slice(line.indexOf('=') + 1).trim();
      if (env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

function makeDb() {
  const env = loadEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Variables Supabase manquantes : définir NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (process.env ou .env.local).');
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

// ── Dates factices centralisées : année 2099, hors de toute exploitation.
//    L'app ne crée jamais de ligne au-delà de J+2 → ces dates sont vierges
//    par construction. Chaque paire soir→livraison respecte livraison = soir+1.
const FAKE = {
  SOIR_A: '2099-01-10', LIV_A: '2099-01-11',   // f1 T1 / doublon
  SOIR_B: '2099-02-08', LIV_B: '2099-02-09',   // f1 T2 (ligne J+2 existante)
  SOIR_C: '2099-03-14', LIV_C: '2099-03-15',   // step4 (ordre synthétique + inventaire)
  SOIR_D: '2099-04-11', LIV_D: '2099-04-12',   // réserve / preuve d'abort
};
const ALL_FAKE = Object.values(FAKE);

const DAY_MS = 86400000;
const FR_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayNameFr(dateStr) {
  return FR_DAYS[new Date(dateStr + 'T00:00:00').getDay()];
}
// libellé « soir » tel qu'affiché par l'admin : formatDate(inventaireDateStr(date)) = date-1
function frSoir(livDate) {
  const d = new Date(livDate + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Garde 1 : interdit toute date proche (aujourd'hui ± 60 j) ; impose le jeu FAKE.
function assertFakeDate(date, ctx = '') {
  const t = new Date(todayStr() + 'T00:00:00').getTime();
  const d = new Date(date + 'T00:00:00').getTime();
  if (Math.abs(d - t) <= 60 * DAY_MS) {
    throw new Error(`GARDE-FOU: date proche interdite « ${date} »${ctx ? ' (' + ctx + ')' : ''} — fenêtre ±60 j. Cibler une date FAKE 2099.`);
  }
  if (!ALL_FAKE.includes(date)) {
    throw new Error(`GARDE-FOU: date « ${date} »${ctx ? ' (' + ctx + ')' : ''} hors du jeu FAKE 2099 centralisé.`);
  }
}

// ── Garde 2 : anti-écrasement. Avant toute écriture, les dates doivent être
//    VIERGES dans chaque table. Sinon → ABORT, aucune écriture.
async function guardEmpty(db, tables, dates, label = '') {
  for (const table of tables) {
    const { data, error } = await db.from(table).select('*').in('date', dates);
    if (error) throw new Error(`GARDE-FOU: lecture ${table} impossible : ${error.message}`);
    if (data && data.length) {
      throw new Error(
        `GARDE-FOU ABORT${label ? ' [' + label + ']' : ''}: ${data.length} ligne(s) déjà présente(s) dans ${table} sur ${dates.join(', ')}` +
        ` — écriture refusée (donnée potentiellement RÉELLE). Ne pas lancer pendant/après le service.`
      );
    }
  }
}

// ── Garde 3a : suppression sûre sur dates FAKE uniquement. Refuse toute date
//    hors-FAKE (empêche structurellement un DELETE sur une date réelle).
async function safeDeleteFake(db, tables, dates) {
  for (const date of dates) {
    if (!ALL_FAKE.includes(date)) {
      throw new Error(`GARDE-FOU: safeDeleteFake refuse « ${date} » (non-FAKE) — suppression annulée.`);
    }
  }
  for (const table of tables) {
    await db.from(table).delete().in('date', dates);
  }
}

// ── Garde 3b : snapshot / restore pour les dates PROCHES (flux mobile, J+1).
//    Capture l'état avant ; à la fin, ne supprime QUE les lignes absentes du
//    snapshot (créées par le test) et ré-upsert les lignes préexistantes.
async function snapshot(db, tables, dates) {
  const snap = {};
  for (const t of tables) {
    const { data } = await db.from(t).select('*').in('date', dates);
    snap[t] = data || [];
  }
  return snap;
}
async function restoreToSnapshot(db, snap, dates) {
  for (const table of Object.keys(snap)) {
    const keepIds = new Set(snap[table].map(r => r.id));
    const { data: now } = await db.from(table).select('*').in('date', dates);
    for (const r of (now || [])) {
      if (!keepIds.has(r.id)) await db.from(table).delete().eq('id', r.id); // créée par le test
    }
    // ré-injection à l'identique des lignes préexistantes (sécurité si modifiées)
    for (const r of snap[table]) {
      const conflict = (table === 'inventory_drafts' || table === 'daily_forecast' || table === 'daily_orders') ? 'date' : 'id';
      await db.from(table).upsert(r, { onConflict: conflict });
    }
  }
}

// ── Garde 4 : refus pendant la plage de service (18 h – 00 h).
//    Contournement explicite via ALLOW_SERVICE=1 (déconseillé, journalisé).
function assertNotServiceHours() {
  const h = new Date().getHours();
  const inService = h >= 18; // 18 h → minuit
  if (inService) {
    if (process.env.ALLOW_SERVICE === '1') {
      console.warn(`⚠️  GARDE-FOU service contournée (ALLOW_SERVICE=1) — il est ${h}h. À n'utiliser que hors service réel.`);
    } else {
      throw new Error(`GARDE-FOU: il est ${h}h — plage de SERVICE (18 h–00 h). Suite bloquée. (ALLOW_SERVICE=1 pour forcer, déconseillé.)`);
    }
  }
}

module.exports = {
  makeDb, FAKE, ALL_FAKE, DAY_MS,
  todayStr, addDays, dayNameFr, frSoir,
  assertFakeDate, guardEmpty, safeDeleteFake, snapshot, restoreToSnapshot, assertNotServiceHours,
};
