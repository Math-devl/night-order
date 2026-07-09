// Test du correctif hasInventory (affichage inventaire à 0) — ÉCRITURES SUR
// DATES FACTICES 2099 UNIQUEMENT, via les garde-fous tests/. Ne touche jamais
// une date réelle. Vérifie le filtre exact expédié dans helpers.ts.
const { makeDb, FAKE, guardEmpty, safeDeleteFake, assertFakeDate } = require('./test-guard');

// MIROIR EXACT de components/admin/historique/helpers.ts:hasInventory
const hasInventory = (o) => {
  const n = (v) => (typeof v === 'number' ? v : parseFloat(String(v ?? '')) || 0);
  const anyInventory =
    n(o.frites_fraiches) > 0 || n(o.frites_blanchies) > 0 ||
    n(o.boules_restantes) > 0 || n(o.buns_restants) > 0;
  if (anyInventory) return true;
  const anyCommand =
    n(o.frites_commander) > 0 || n(o.viande_total) > 0 || n(o.boeuf) > 0 ||
    n(o.gras) > 0 || n(o.buns_commander) > 0;
  return n(o.burgers_prevus) > 0 || !anyCommand;
};

const base = (date, over) => ({
  date, day_name: 'Test', burgers_prevus: 0,
  frites_fraiches: 0, frites_blanchies: 0, boules_restantes: 0, pct_gras: 26.5, buns_restants: 0,
  frites_blanchir: 0, frites_commander: 0, viande_total: 0, boeuf: 0, gras: 0, buns_commander: 0,
  validated_at: new Date().toISOString(), ...over,
});

const db = makeDb();
const D = [FAKE.LIV_A, FAKE.LIV_B, FAKE.LIV_C, FAKE.LIV_D];

// 4 profils réels
const cases = [
  { date: FAKE.LIV_A, label: 'ajout manuel INVENTAIRE À 0 (bp=0, inv=0, cmd=0)', over: {}, expect: true },
  { date: FAKE.LIV_B, label: 'tout vendu / validé (bp=110, inv=0, cmd>0)', over: { burgers_prevus: 110, frites_commander: 35, viande_total: 15, boeuf: 11, gras: 4, buns_commander: 90 }, expect: true },
  { date: FAKE.LIV_C, label: 'buns J+2 logistique (bp=0, inv=0, buns_commander>0)', over: { buns_commander: 140 }, expect: false },
  { date: FAKE.LIV_D, label: 'nuit normale (inventaire > 0)', over: { burgers_prevus: 100, frites_fraiches: 12, boules_restantes: 40, buns_restants: 30 }, expect: true },
];

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : '  — ' + detail}`);
  if (!ok) failures++;
}

(async () => {
  D.forEach(d => assertFakeDate(d, 'hasinventory-zero'));
  await guardEmpty(db, ['daily_orders'], D, 'hasinventory-zero');
  await safeDeleteFake(db, ['daily_orders'], D); // filet (au cas où)

  // Écriture des 4 profils
  for (const c of cases) {
    const { error } = await db.from('daily_orders').insert(base(c.date, c.over));
    if (error) { check('insert ' + c.label, false, error.message); }
  }

  // Relecture + application du filtre expédié
  const { data } = await db.from('daily_orders').select('*').in('date', D);
  const byDate = Object.fromEntries(data.map(r => [r.date, r]));
  for (const c of cases) {
    const row = byDate[c.date];
    const got = hasInventory(row);
    check(`${c.label} → affichée=${got} (attendu ${c.expect})`, got === c.expect,
      `frites_fraiches=${row.frites_fraiches} buns_cmd=${row.buns_commander} bp=${row.burgers_prevus}`);
  }

  // Éditabilité : une ligne affichée est dans orders.filter(hasInventory) →
  // rendue par InventaireMonthBlock avec le bouton Modifier → onEdit(o).
  const shown = data.filter(hasInventory).map(r => r.date).sort();
  const expectedShown = cases.filter(c => c.expect).map(c => c.date).sort();
  check('ensemble affiché = {manuel-0, tout-vendu, normale} (buns J+2 exclue) ⇒ toutes éditables',
    JSON.stringify(shown) === JSON.stringify(expectedShown), `affichées=${shown.join(',')}`);

  // Non-régression : la ligne buns J+2 n'apparaît jamais
  check('non-régression buns J+2 masquée', !shown.includes(FAKE.LIV_C), 'LIV_C visible à tort');

  // Nettoyage
  await safeDeleteFake(db, ['daily_orders'], D);
  const { data: left } = await db.from('daily_orders').select('id').in('date', D);
  check('nettoyage 2099 complet', (left || []).length === 0, `${(left || []).length} lignes restantes`);

  console.log(failures ? `\n❌ ${failures} échec(s)` : '\n✅ Tous les cas verts');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error('ERREUR:', e.message); process.exit(1); });
