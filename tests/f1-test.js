// ============================================================================
// F1-TEST — ajout/édition d'inventaire côté admin (upsertInventoryOnly) :
// ligne zéro-commande créée, éditable, doublon → édition, aucune écriture
// commande / brouillon / prévision.
//
// BLINDAGE (voir test-guard.js) :
//   • Cible EXCLUSIVEMENT des dates factices 2099 (via la modale « Ajouter un
//     inventaire », dont la date est explicite). Jamais de date proche.
//   • guardEmpty avant écriture ; safeDeleteFake au nettoyage ; garde service.
//   • T5 prouve que la base réelle (colonnes commande, morning_reception) est
//     strictement identique avant/après.
// NE PAS lancer pendant le service.
// ============================================================================

const { chromium } = require('playwright');
const {
  makeDb, FAKE, frSoir,
  assertFakeDate, guardEmpty, safeDeleteFake, assertNotServiceHours,
} = require('./test-guard');
const { key: SB_KEY, session } = require('./admin-session.json');

const db = makeDb();

const CMD_COLS = ['burgers_prevus', 'frites_blanchir', 'frites_commander', 'viande_total', 'boeuf', 'gras', 'buns_commander'];
const results = [];
function report(name, ok, detail) {
  results.push([name, ok]);
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ' — ' + detail}`);
}

async function openInventaireTab(page) {
  await page.goto('http://localhost:3199/admin');
  await page.waitForSelector('header button:has-text("Historique")', { timeout: 15000 });
  await page.click('header button:has-text("Historique")');
  await page.click('.jv-tabs--segmented button:has-text("Inventaire")');
  await page.waitForFunction(() => !document.body.innerText.includes('Chargement'), { timeout: 10000 });
}

async function fillAddModal(page, soirDate, vals) {
  await page.locator('thead button:has-text("+ Ajouter")').first().click();
  await page.waitForSelector('text=Ajouter un inventaire');
  const modal = page.locator('.jv-dialog:has-text("Ajouter un inventaire")');
  await modal.locator('input[type="date"]').fill(soirDate);
  const inputs = modal.locator('input[type="number"]');
  // ordre INVENTORY_FIELDS : frites_fraiches, frites_blanchies, boules, pct_gras, buns
  if (vals.ff !== undefined) await inputs.nth(0).fill(String(vals.ff));
  if (vals.fb !== undefined) await inputs.nth(1).fill(String(vals.fb));
  if (vals.boules !== undefined) await inputs.nth(2).fill(String(vals.boules));
  if (vals.buns !== undefined) await inputs.nth(4).fill(String(vals.buns));
  await modal.locator('button:has-text("+ Ajouter")').click();
}

(async () => {
  assertNotServiceHours();

  // paires soir → livraison, factices 2099
  const SOIR1 = FAKE.SOIR_A, LIV1 = FAKE.LIV_A;   // T1 / T4 doublon
  const SOIR2 = FAKE.SOIR_B, LIV2 = FAKE.LIV_B;   // T2 ligne J+2 existante
  [LIV1, LIV2].forEach(d => assertFakeDate(d, 'f1 cible'));

  // ── Garde anti-écrasement sur toutes les cibles 2099 ──
  await guardEmpty(db, ['daily_orders', 'inventory_drafts', 'daily_forecast', 'morning_reception'], [LIV1, LIV2], 'f1');

  // ── Snapshots avant : agrégats commande + morning_reception + brouillons ──
  const { data: ordersBefore } = await db.from('daily_orders').select('*').order('date');
  const { data: recBefore } = await db.from('morning_reception').select('*').order('date');
  const aggBefore = CMD_COLS.map(c => Math.round(ordersBefore.reduce((s, o) => s + (o[c] || 0), 0) * 100) / 100);
  const exportableBefore = ordersBefore.filter(o => o.burgers_prevus > 0).length;
  const { data: draftBefore } = await db.from('inventory_drafts').select('*').order('date');

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await page.goto('http://localhost:3199/admin');
    await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SB_KEY, session]);

    // ═══ T1. Ajout sur date factice vierge (soir 2099-01-10 → livraison 2099-01-11) ═══
    await openInventaireTab(page);
    await fillAddModal(page, SOIR1, { ff: 12, fb: 4, boules: 25, buns: 33 });
    await page.waitForTimeout(2500);
    const { data: created } = await db.from('daily_orders').select('*').eq('date', LIV1).maybeSingle();
    const zeroCmd = created && CMD_COLS.every(c => created[c] === 0);
    const rowVisible = await page.waitForFunction((label) => {
      return [...document.querySelectorAll('td')].some(td => td.textContent.trim() === label);
    }, frSoir(LIV1), { timeout: 8000 }).then(() => true).catch(() => false);
    report('T1a. Date factice vierge → ligne créée zéro-commande, visible dans le bon mois (2099)',
      !!created && zeroCmd && created.frites_fraiches === 12 && created.boules_restantes === 25 && rowVisible,
      `created=${JSON.stringify(created)} visible=${rowVisible}`);

    // éditable via la modale existante
    const row = page.locator(`tr:has(td:text-is("${frSoir(LIV1)}"))`).first();
    await row.locator('button:has-text("Modifier")').click();
    await page.waitForSelector("text=Modifier l'inventaire");
    const editModal = page.locator('.jv-dialog:has-text("Modifier l\'inventaire")');
    await editModal.locator('input').nth(2).fill('28');
    await editModal.locator('button:has-text("Enregistrer")').click();
    await page.waitForTimeout(2000);
    const { data: edited } = await db.from('daily_orders').select('boules_restantes').eq('date', LIV1).maybeSingle();
    report('T1b. Ligne ajoutée éditable via la modale existante (boules 25 → 28)', edited?.boules_restantes === 28, JSON.stringify(edited));

    // export/dashboard : agrégats commande et nb de lignes exportables inchangés
    const { data: ordersMid } = await db.from('daily_orders').select('*');
    const aggMid = CMD_COLS.map(c => Math.round(ordersMid.reduce((s, o) => s + (o[c] || 0), 0) * 100) / 100);
    const exportableMid = ordersMid.filter(o => o.burgers_prevus > 0).length;
    report('T1c. Export Excel / dashboard inchangés (agrégats commande identiques, lignes exportables identiques)',
      JSON.stringify(aggBefore) === JSON.stringify(aggMid) && exportableBefore === exportableMid,
      `avant=${aggBefore}/${exportableBefore} après=${aggMid}/${exportableMid}`);

    // ═══ T2. Ajout sur date à ligne buns J+2 existante (factice 2099) ═══
    await db.from('daily_orders').insert({
      date: LIV2, day_name: 'Mardi', burgers_prevus: 0,
      frites_fraiches: 0, frites_blanchies: 0, boules_restantes: 0, pct_gras: 26.5, buns_restants: 0,
      frites_blanchir: 0, frites_commander: 0, viande_total: 0, boeuf: 0, gras: 0,
      buns_commander: 250, validated_at: new Date().toISOString(),
    });
    await page.reload();
    await page.click('header button:has-text("Historique")');
    await page.click('.jv-tabs--segmented button:has-text("Inventaire")');
    await page.waitForFunction(() => !document.body.innerText.includes('Chargement'), { timeout: 10000 });
    await fillAddModal(page, SOIR2, { ff: 8, boules: 15 });
    await page.waitForTimeout(2500);
    const { data: j2rows } = await db.from('daily_orders').select('*').eq('date', LIV2);
    report('T2. Ligne buns J+2 existante → update sans doublon, buns_commander 250 intact',
      j2rows.length === 1 && j2rows[0].buns_commander === 250 && j2rows[0].frites_fraiches === 8 && j2rows[0].boules_restantes === 15,
      JSON.stringify(j2rows));

    // ═══ T3. L'ajout d'inventaire n'écrit JAMAIS dans inventory_drafts ═══
    const { data: draftsAfterAdds } = await db.from('inventory_drafts').select('*').order('date');
    report('T3. Ajouts d\'inventaire admin → inventory_drafts strictement inchangé (brouillons du soir non affectés)',
      JSON.stringify(draftBefore) === JSON.stringify(draftsAfterAdds),
      `avant=${draftBefore.length} après=${draftsAfterAdds.length}`);

    // ═══ T4. Tentative de doublon → redirection vers l'édition, pas de 2ᵉ ligne ═══
    await page.reload();
    await page.click('header button:has-text("Historique")');
    await page.click('.jv-tabs--segmented button:has-text("Inventaire")');
    await page.waitForFunction(() => !document.body.innerText.includes('Chargement'), { timeout: 10000 });
    await fillAddModal(page, SOIR1, { ff: 99 }); // date qui a déjà un inventaire (T1)
    const editOpened = await page.waitForSelector("text=Modifier l'inventaire", { timeout: 5000 }).then(() => true).catch(() => false);
    await page.locator('.jv-dialog button:has-text("Annuler")').click().catch(() => {});
    await page.waitForTimeout(1500);
    const { data: dupRows } = await db.from('daily_orders').select('id,frites_fraiches').eq('date', LIV1);
    report('T4. Doublon → modale d\'édition ouverte à la place, pas de 2ᵉ ligne, valeurs intactes (frites 12)',
      editOpened && dupRows.length === 1 && dupRows[0].frites_fraiches === 12,
      `edit=${editOpened} rows=${JSON.stringify(dupRows)}`);
  } finally {
    await browser.close();
  }

  // ═══ T5. Base réelle strictement identique (nettoyage FAKE uniquement) ═══
  await safeDeleteFake(db, ['morning_reception', 'inventory_drafts', 'daily_forecast', 'daily_orders'], [LIV1, LIV2]);
  const { data: ordersAfter } = await db.from('daily_orders').select('*').order('date');
  const { data: recAfter } = await db.from('morning_reception').select('*').order('date');
  const cmdIdentical = JSON.stringify(ordersBefore.map(o => CMD_COLS.map(c => o[c]).concat(o.id))) ===
                       JSON.stringify(ordersAfter.map(o => CMD_COLS.map(c => o[c]).concat(o.id)));
  const recIdentical = JSON.stringify(recBefore) === JSON.stringify(recAfter);
  report('T5. Après nettoyage : daily_orders (colonnes commande, ligne à ligne) et morning_reception strictement identiques',
    cmdIdentical && recIdentical, `cmd=${cmdIdentical} rec=${recIdentical}`);

  const { data: leftover } = await db.from('daily_orders').select('id').in('date', [LIV1, LIV2]);
  const { data: leftDrafts } = await db.from('inventory_drafts').select('id').in('date', [LIV1, LIV2]);
  console.log(`Nettoyage : lignes test 2099 restantes=${leftover.length}, drafts 2099=${leftDrafts.length}`);
  process.exit(results.every(([, ok]) => ok) && leftover.length === 0 ? 0 : 1);
})().catch(e => { console.error('ERREUR:', e.message); process.exit(1); });
