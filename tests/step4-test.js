// ============================================================================
// STEP4-TEST — édition d'un inventaire passé côté admin : SEULES les colonnes
// inventaire changent (aucun recalcul commande, morning_reception intacte).
//
// BLINDAGE (voir test-guard.js) :
//   • Cible EXCLUSIVEMENT une date factice 2099 (ordre synthétique créé par le
//     test), jamais une commande réelle.
//   • guardEmpty avant écriture : abort si la date 2099 n'est pas vierge.
//   • Nettoyage par safeDeleteFake : suppression impossible hors dates FAKE.
//   • assertNotServiceHours : refus 18 h–00 h (ALLOW_SERVICE=1 pour forcer).
// NE PAS lancer pendant le service.
// ============================================================================

const { chromium } = require('playwright');
const {
  makeDb, FAKE, frSoir, dayNameFr,
  assertFakeDate, guardEmpty, safeDeleteFake, assertNotServiceHours,
} = require('./test-guard');
const { key: SB_KEY, session } = require('./admin-session.json');

const db = makeDb();

const CMD_COLS = ['burgers_prevus', 'frites_blanchir', 'frites_commander', 'viande_total', 'boeuf', 'gras', 'buns_commander', 'validated_at', 'date', 'day_name'];
const INV_COLS = ['frites_fraiches', 'frites_blanchies', 'boules_restantes', 'pct_gras', 'buns_restants'];

const LIV = FAKE.LIV_C;   // 2099-03-15
const results = [];
function report(name, ok, detail) {
  results.push([name, ok]);
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ' — ' + detail}`);
}

(async () => {
  assertNotServiceHours();
  assertFakeDate(LIV, 'step4 cible');

  // ── Garde anti-écrasement puis création de l'ordre synthétique 2099 ──
  await guardEmpty(db, ['daily_orders', 'inventory_drafts', 'daily_forecast', 'morning_reception'], [LIV], 'step4');
  const synth = {
    date: LIV, day_name: dayNameFr(LIV),
    burgers_prevus: 100, frites_fraiches: 30, frites_blanchies: 12,
    boules_restantes: 10, pct_gras: 26.5, buns_restants: 8,
    frites_blanchir: 0, frites_commander: 20, viande_total: 9, boeuf: 6.6, gras: 2.4,
    buns_commander: 100, validated_at: new Date().toISOString(),
  };
  const { data: created, error: insErr } = await db.from('daily_orders').insert(synth).select().single();
  if (insErr) { console.error('Création ordre synthétique impossible :', insErr.message); process.exit(1); }
  const before = { ...created };
  console.log(`Ordre synthétique 2099 : ${LIV} (soir ${frSoir(LIV)}), id=${created.id}`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.route('**/api/push/**', route => route.fulfill({ status: 200, body: '{"ok":true}' }));
  const page = await ctx.newPage();

  try {
    // ── Login admin ──
    await page.goto('http://localhost:3199/admin');
    await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SB_KEY, session]);
    await page.reload();
    await page.waitForSelector('header button:has-text("Historique")', { timeout: 15000 });

    // ── Historique → onglet Inventaire (le mois 2099 est trié en tête) ──
    await page.click('header button:has-text("Historique")');
    await page.click('.jv-tabs--segmented button:has-text("Inventaire")');
    await page.waitForFunction(() => !document.body.innerText.includes('Chargement'), { timeout: 10000 });

    const row = page.locator(`tr:has(td:text-is("${frSoir(LIV)}"))`).first();
    await row.waitFor({ timeout: 8000 });
    await row.locator('button:has-text("Modifier")').click();
    await page.waitForSelector('text=Modifier l\'inventaire');
    const noteOk = await page.isVisible('text=ne sont pas recalculées');
    report('Note « correction pure, pas de recalcul » visible dans la modale', noteOk, '');

    // frites_fraiches → +7, boules_restantes → +3
    const newFrites = Math.round((before.frites_fraiches + 7) * 10) / 10;
    const newBoules = before.boules_restantes + 3;
    const modal = page.locator('.jv-dialog:has-text("Modifier l\'inventaire")');
    await modal.locator('input').nth(0).fill(String(newFrites));
    await modal.locator('input').nth(2).fill(String(newBoules));
    await modal.locator('button:has-text("Enregistrer")').click();
    await page.waitForTimeout(2500);

    // ── Affichage mis à jour ──
    const rowText = await page.locator(`tr:has(td:text-is("${frSoir(LIV)}"))`).first().textContent();
    report('Liste mise à jour à l\'écran (nouvelles valeurs visibles)',
      rowText.includes(String(newBoules)) && rowText.includes(newFrites.toFixed(1)), `ligne="${rowText}"`);

    // ── Vérif base : SEULES les colonnes inventaire ont changé ──
    const { data: after } = await db.from('daily_orders').select('*').eq('id', created.id).single();
    const { data: recAfter } = await db.from('morning_reception').select('*').eq('order_id', created.id).maybeSingle();
    const cmdIdentical = CMD_COLS.every(c => JSON.stringify(before[c]) === JSON.stringify(after[c]));
    const invChanged = after.frites_fraiches === newFrites && after.boules_restantes === newBoules;
    const invUntouchedIntact = after.frites_blanchies === before.frites_blanchies &&
      after.pct_gras === before.pct_gras && after.buns_restants === before.buns_restants;
    report('Base : colonnes commande strictement identiques', cmdIdentical,
      CMD_COLS.filter(c => JSON.stringify(before[c]) !== JSON.stringify(after[c])).join(','));
    report('Base : colonnes inventaire modifiées comme attendu (autres intactes)', invChanged && invUntouchedIntact,
      `after=${JSON.stringify(INV_COLS.reduce((a, c) => ({ ...a, [c]: after[c] }), {}))}`);
    report('Base : aucune morning_reception créée par l\'édition (reste nulle)', recAfter === null,
      `after=${JSON.stringify(recAfter)}`);

    // ── Vue Commandes inchangée ──
    await page.click('.jv-tabs--segmented button:has-text("Commandes")');
    await page.waitForFunction(() => !document.body.innerText.includes('Chargement'), { timeout: 8000 });
    const cmdRow = await page.locator(`tr[data-date="${LIV}"]`).first().textContent();
    const cmdViewOk = cmdRow.includes(String(before.burgers_prevus)) && cmdRow.includes(before.frites_commander.toFixed(1));
    report('Vue Commandes inchangée (mêmes valeurs commande affichées)', cmdViewOk, `ligne="${cmdRow}"`);

    await page.screenshot({ path: 'step4-inventaire.png', fullPage: false });
  } finally {
    await browser.close();
  }

  // ── Nettoyage : suppression sûre (dates FAKE uniquement) ──
  await safeDeleteFake(db, ['morning_reception', 'inventory_drafts', 'daily_forecast', 'daily_orders'], [LIV]);
  const { data: leftover } = await db.from('daily_orders').select('id').eq('date', LIV);
  console.log(`Nettoyage : lignes 2099 restantes=${leftover.length}`);

  process.exit(results.every(([, ok]) => ok) && leftover.length === 0 ? 0 : 1);
})().catch(e => { console.error('ERREUR SCRIPT:', e.message); process.exit(1); });
