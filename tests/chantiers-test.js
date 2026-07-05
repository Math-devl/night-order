// ============================================================================
// CHANTIERS-TEST — bout-en-bout du FLUX MOBILE (flush beacon, dates serveur à
// cheval sur minuit, synchro prévision bidirectionnelle, cycle validation →
// annulation → restauration).
//
// ⚠️  STRUCTURELLEMENT LIÉE À J+1 RÉEL : le flux mobile écrit sur le J+1
//     calculé CÔTÉ SERVEUR (aucune injection de date possible). Cette suite ne
//     PEUT PAS cibler 2099. Sa protection est donc « abort-plutôt-qu'écraser » :
//       • assertNotServiceHours : refus 18 h–00 h (ALLOW_SERVICE=1 pour forcer).
//       • guardEmpty sur J+1/J+2 : si une donnée réelle existe déjà (commande,
//         brouillon, prévision) → ABORT immédiat, AUCUNE écriture ni suppression.
//         (C'est ce garde qui aurait empêché l'incident du 05/07.)
//       • Nettoyage par snapshot-restore : ne supprime QUE les lignes créées par
//         le test (le snapshot de départ étant vide, garanti par guardEmpty).
//     À NE LANCER QUE HORS SERVICE, sur un lendemain encore vierge.
//     Résiduel : une validation réelle CONCURRENTE pendant l'exécution reste
//     possible — d'où l'obligation de ne jamais lancer pendant le service.
// ============================================================================

const { chromium } = require('playwright');
const emps = require('./emps.json');
const adminEmp = emps.find(e => e.is_admin);
const { key: SB_KEY, session } = require('./admin-session.json');
const {
  makeDb, todayStr, addDays,
  guardEmpty, snapshot, restoreToSnapshot, assertNotServiceHours,
} = require('./test-guard');

const db = makeDb();

// J+1 / J+2 réels (mêmes dates que celles calculées côté serveur par l'app).
const J1 = addDays(todayStr(), 1);
const J2 = addDays(todayStr(), 2);
const NEAR_TABLES = ['daily_orders', 'inventory_drafts', 'daily_forecast'];
let initialSnap = null; // capturé après guardEmpty (donc vide) — base du nettoyage sûr

const results = [];
function report(name, ok, detail) {
  results.push([name, ok]);
  console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ' — ' + detail}`);
}

async function login(page, code) {
  await page.goto('http://localhost:3199/mobile');
  await page.waitForSelector('text=Saisis ton code');
  for (const d of code) { await page.click('.grid.grid-cols-3 button:text-is("' + d + '")'); await page.waitForTimeout(300); }
  await page.waitForTimeout(2500);
}

// Nettoyage SÛR : restaure J+1/J+2 vers le snapshot initial (vide) → ne supprime
// que les lignes créées par le test, ne touche jamais une ligne préexistante.
async function cleanTest() {
  await restoreToSnapshot(db, initialSnap, [J1, J2]);
}

(async () => {
  assertNotServiceHours();
  // GARDE ANTI-ÉCRASEMENT : J+1/J+2 doivent être VIERGES. Sinon ABORT (donnée réelle).
  await guardEmpty(db, NEAR_TABLES, [J1, J2], 'chantiers J+1/J+2');
  initialSnap = await snapshot(db, NEAR_TABLES, [J1, J2]); // vide → base du nettoyage
  console.log(`Cibles réelles : J+1=${J1}, J+2=${J2} (vierges, vérifié).`);
  const browser = await chromium.launch();

  // ═══ BUG 1 : flush beacon ═══
  {
    const ctx = await browser.newContext();
    await ctx.route('**/api/push/**', r => r.fulfill({ status: 200, body: '{}' }));
    const page = await ctx.newPage();
    let beaconSent = false;
    page.on('request', r => { if (r.url().includes('/api/inventory-draft') && r.method() === 'POST') beaconSent = true; });
    await login(page, adminEmp.access_code);
    await page.waitForSelector('text=Inventaire du soir');
    await page.waitForTimeout(1500);

    // saisie → onglet caché immédiat (<800 ms) → hard refresh
    await page.locator('input[type="number"]').nth(0).fill('5');
    await page.waitForTimeout(250);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(300); // le beacon part
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
    await page.reload();
    await page.waitForSelector('text=Inventaire du soir');
    await page.waitForTimeout(2000);
    const v = await page.locator('input[type="number"]').nth(0).inputValue();
    const { data: d1 } = await db.from('inventory_drafts').select('frites_fraiches').eq('date', J1).maybeSingle();
    report('Bug 1 — saisie → onglet caché <800 ms → reload : beacon parti, valeur restaurée',
      beaconSent && v === '5' && d1?.frites_fraiches === '5', `beacon=${beaconSent} champ=${v} db=${JSON.stringify(d1)}`);

    // non-régression scénario B : attente 3 s → débounce normal
    await page.locator('input[type="number"]').nth(0).fill('7');
    await page.waitForTimeout(3000);
    const { data: d2 } = await db.from('inventory_drafts').select('frites_fraiches').eq('date', J1).maybeSingle();
    report('Bug 1 — non-régression : débounce normal (3 s) écrit toujours', d2?.frites_fraiches === '7', JSON.stringify(d2));
    await ctx.close();
    await cleanTest();
  }

  // ═══ BUG 2a : horloge à cheval sur minuit → plus aucune date client ═══
  {
    const ctx = await browser.newContext();
    await ctx.route('**/api/push/**', r => r.fulfill({ status: 200, body: '{}' }));
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(`${todayStr()}T23:50:00`) });
    const reqs = [];
    page.on('request', r => {
      const u = r.url();
      if (u.includes('/api/daily-forecast') || u.includes('/api/inventory-draft')) {
        reqs.push(`${r.method()} ${u.slice(u.indexOf('/api'))}${r.method() === 'POST' && u.includes('daily-forecast') ? ' body=' + r.postData() : ''}`);
      }
    });
    page.on('response', async r => {
      if (r.url().includes('/api/daily-forecast') && r.request().method() === 'POST') {
        reqs.push(`  ↳ RÉPONSE ${r.status()} ${await r.text().catch(() => '')}`);
      }
    });
    await login(page, adminEmp.access_code);
    const mountNoDate = reqs.filter(r => r.startsWith('GET')).every(r => !r.includes('date='));
    reqs.length = 0;

    await page.clock.setSystemTime(new Date(`${addDays(todayStr(), 1)}T00:10:00`));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForTimeout(1500);
    const visibleGets = reqs.filter(r => r.startsWith('GET'));
    const visibleNoDate = visibleGets.length >= 2 && visibleGets.every(r => !r.includes('date='));
    const refetchedBoth = visibleGets.some(r => r.includes('daily-forecast')) && visibleGets.some(r => r.includes('inventory-draft'));
    reqs.length = 0;

    // saisie prévision après minuit → POST sans date, serveur choisit la clé
    await page.click('button:has-text("Prévision")');
    await page.locator('input[inputmode="numeric"]').first().fill('110');
    await page.clock.runFor(2000);
    await page.waitForTimeout(3000);
    const post = reqs.find(r => r.startsWith('POST /api/daily-forecast'));
    const postNoDate = post && !post.includes('"date"');
    const { data: fRow } = await db.from('daily_forecast').select('date,burgers_prevus').eq('date', J1).maybeSingle();
    report('Bug 2a — montage + retour visible : GET forecast ET brouillon relancés, sans date client',
      mountNoDate && visibleNoDate && refetchedBoth, `mount=${mountNoDate} visible=${visibleGets.join(' | ')}`);
    report('Bug 2a — POST prévision après minuit : aucune date client, clé choisie par le serveur',
      !!postNoDate && fRow?.burgers_prevus === 110, `trace=${reqs.join(' § ')} row=${JSON.stringify(fRow)} (serveur réel = 05/07 → J+1 = 06/07)`);
    await ctx.close();
    await cleanTest();
  }

  // ═══ BUG 2b : admin pré-remplit 120 → mobile voit 120 partout, saisie possible ═══
  {
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await pageB.goto('http://localhost:3199/admin');
    await pageB.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [SB_KEY, session]);
    await pageB.reload();
    await pageB.waitForSelector('text=Interface Admin', { timeout: 15000 });
    await pageB.click('header button:has-text("Historique")');
    const rowJ1 = pageB.locator(`tr[data-date="${J1}"]`);
    await rowJ1.waitFor({ timeout: 8000 });
    await rowJ1.locator('button:has-text("Modifier")').click();
    await pageB.waitForSelector('text=Pré-remplir la commande');
    const modal = pageB.locator('.jv-dialog:has-text("Pré-remplir")');
    await modal.locator('input').nth(0).fill('120');
    await modal.locator('button:has-text("Enregistrer")').click();
    await pageB.waitForTimeout(2500);

    const { data: o1 } = await db.from('daily_orders').select('burgers_prevus').eq('date', J1).maybeSingle();
    const { data: f1 } = await db.from('daily_forecast').select('burgers_prevus').eq('date', J1).maybeSingle();
    report('Bug 2b — pré-remplissage 120 : daily_orders ET daily_forecast à 120',
      o1?.burgers_prevus === 120 && f1?.burgers_prevus === 120, `orders=${JSON.stringify(o1)} forecast=${JSON.stringify(f1)}`);

    // téléphone
    const ctxC = await browser.newContext();
    await ctxC.route('**/api/push/**', r => r.fulfill({ status: 200, body: '{}' }));
    const pageC = await ctxC.newPage();
    await login(pageC, adminEmp.access_code);
    const blocked = await pageC.isVisible('text=Inventaire déjà effectué');
    const canType = await pageC.isVisible('text=Inventaire du soir');
    await pageC.click('button:has-text("Prévision")');
    await pageC.waitForTimeout(1000);
    const prev = await pageC.locator('input[inputmode="numeric"]').first().inputValue();
    // accès à l'écran Valider par le flux normal (Voir la commande)
    await pageC.click('button:has-text("Voir la commande")');
    await pageC.waitForSelector('text=Récapitulatif', { timeout: 8000 });
    const body = await pageC.textContent('body');
    const valider = body.match(/(\d+)\s*burgers prévus/)?.[1];
    await pageC.click('button:has-text("Prévision")'); // retour
    report('Bug 2b — téléphone : saisie inventaire possible (non bloquée) + 120 sur Prévision ET Valider',
      !blocked && canType && prev === '120' && valider === '120', `blocked=${blocked} saisie=${canType} prev=${prev} valider=${valider}`);

    // mobile modifie la prévision → l'admin la voit
    await pageC.click('button:has-text("Prévision")');
    await pageC.locator('input[inputmode="numeric"]').first().fill('130');
    await pageC.waitForTimeout(2000);
    const { data: o2 } = await db.from('daily_orders').select('burgers_prevus,frites_commander').eq('date', J1).maybeSingle();
    const { data: f2 } = await db.from('daily_forecast').select('burgers_prevus').eq('date', J1).maybeSingle();
    await pageB.reload();
    await pageB.waitForSelector('text=Interface Admin');
    await pageB.click('header button:has-text("Historique")');
    // attendre la fin du chargement (le placeholder transitoire affiche « À venir »)
    await pageB.waitForFunction((j1) => {
      const tr = document.querySelector(`tr[data-date="${j1}"]`);
      return tr && !tr.textContent.includes('À venir');
    }, J1, { timeout: 10000 });
    const adminRow = await pageB.locator(`tr[data-date="${J1}"]`).textContent();
    report('Bug 2b — mobile passe à 130 → daily_forecast ET commande planifiée à 130, visible côté admin',
      f2?.burgers_prevus === 130 && o2?.burgers_prevus === 130 && adminRow.includes('130'),
      `forecast=${JSON.stringify(f2)} order=${JSON.stringify(o2)} ligneAdmin=${adminRow?.slice(0, 80)}`);
    await ctxB.close();

    // ═══ Non-régression : cycle validation → annulation → restauration ═══
    await pageC.click('button:has-text("Inventaire")');
    await pageC.locator('input[type="number"]').nth(0).fill('20');
    await pageC.locator('input[type="number"]').nth(2).fill('30');
    await pageC.locator('input[type="number"]').nth(4).fill('40');
    await pageC.waitForTimeout(1800);
    await pageC.click('text=Continuer →');
    await pageC.click('button:has-text("Voir la commande")');
    await pageC.waitForSelector('text=VALIDER LA COMMANDE');
    pageC.on('dialog', d => d.accept());
    await pageC.click('text=VALIDER LA COMMANDE');
    await pageC.waitForSelector('text=Commande validée', { timeout: 8000 });
    await pageC.waitForTimeout(1000);
    const { data: dV } = await db.from('inventory_drafts').select('status').eq('date', J1).maybeSingle();
    const { data: oV } = await db.from('daily_orders').select('burgers_prevus,frites_commander').eq('date', J1).maybeSingle();

    await pageC.reload();
    await pageC.waitForSelector('text=Inventaire déjà effectué', { timeout: 8000 });
    await pageC.click('button:has-text("Valider")');
    await pageC.waitForSelector('text=Annuler la commande');
    await pageC.click('button:has-text("Annuler la commande")');
    await pageC.waitForSelector('text=Inventaire du soir', { timeout: 8000 });
    const { data: dC } = await db.from('inventory_drafts').select('status').eq('date', J1).maybeSingle();
    await pageC.reload();
    await pageC.waitForSelector('text=Inventaire du soir');
    await pageC.waitForTimeout(1500);
    const rv = await pageC.locator('input[type="number"]').nth(0).inputValue();
    report('Non-régression — validation (validated, quantités calculées) → annulation (draft) → restauration (20)',
      dV?.status === 'validated' && oV?.burgers_prevus === 130 && oV?.frites_commander > 0 && dC?.status === 'draft' && rv === '20',
      `val=${JSON.stringify(dV)} order=${JSON.stringify(oV)} cancel=${JSON.stringify(dC)} champ=${rv}`);
    await ctxC.close();
  }

  await browser.close();
  await cleanTest();
  const { data: lo } = await db.from('daily_orders').select('id').in('date', [J1, J2]);
  const { data: ld } = await db.from('inventory_drafts').select('id');
  const { data: lf } = await db.from('daily_forecast').select('date').in('date', [J1, J2]);
  console.log(`Nettoyage : orders=${lo.length}, drafts=${ld.length}, forecasts=${lf.length}`);
  process.exit(results.every(([, ok]) => ok) ? 0 : 1);
})().catch(e => { console.error('ERREUR:', e.message); process.exit(1); });
