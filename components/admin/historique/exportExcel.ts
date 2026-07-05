import { DailyOrder, MorningReception } from '@/lib/db';

export async function exportExcel(orders: DailyOrder[], receptionsMap: Record<string, MorningReception>, label: string) {
  // Import dynamique : xlsx-js-style accède à `document` au chargement du module,
  // il ne peut pas être importé au niveau du module sous peine de planter le SSR.
  const XLSXStyle = (await import('xlsx-js-style')).default;
  const dataOrders = [...orders]
    .filter(o => o.burgers_prevus > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Arrondi 1 décimale pour éviter les erreurs flottantes (ex: 3.1+1.4 = 4.499...)
  const r1 = (n: number) => Math.round(n * 10) / 10;

  const C_HDR_KAKI  = '596643';
  const C_HDR_PINK  = 'FF4D8A';
  const C_SUBHDR    = '496035';
  const C_ROW       = 'FFFFFF';
  const C_ROW_ALT   = 'F4F4F2';
  const C_ROW_WE    = 'E8EBE5';
  const C_TOTAL_BG  = '496035';
  const C_ECART_BG  = '3D4E2B';
  const C_TEXT      = '2A2A2A';
  const C_TEXT_DIM  = 'AAAAAA';
  const C_TEXT_HDR  = 'FFFFFF';
  const C_TEXT_SUB  = 'C8D4B0';
  const C_TEXT_TOT  = 'F5EFA0';
  const C_RED       = 'CC2222';
  const C_GREEN     = '3A8A3A';
  const C_BORD_HDR  = '8BA870';
  const C_BORD_DATA = 'D4D9CE';

  const bdr = (c: string) => ({ style: 'thin', color: { rgb: c } });
  const border = (c: string) => ({ top: bdr(c), bottom: bdr(c), left: bdr(c), right: bdr(c) });

  const hdrCell = (v: string, bg: string, fontColor = C_TEXT_HDR, bold = true, sz = 10) => ({
    v, t: 's' as const,
    s: {
      fill: { fgColor: { rgb: bg } },
      font: { bold, color: { rgb: fontColor }, sz },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: border(C_BORD_HDR),
    },
  });

  const dataCell = (v: string | number, t: 's' | 'n', bg: string, fontColor: string, align = 'right') => ({
    v, t,
    s: {
      fill: { fgColor: { rgb: bg } },
      font: { color: { rgb: fontColor } },
      alignment: { horizontal: align, vertical: 'center' },
      border: border(C_BORD_DATA),
    },
  });

  const totCell = (v: string | number, fontColor = C_TEXT_TOT) => ({
    v,
    t: (typeof v === 'number' ? 'n' : 's') as 's' | 'n',
    s: {
      fill: { fgColor: { rgb: C_TOTAL_BG } },
      font: { bold: true, color: { rgb: fontColor }, sz: 10 },
      alignment: { horizontal: typeof v === 'number' ? 'right' : 'center', vertical: 'center' },
      border: border(C_BORD_HDR),
    },
  });

  const ecartColor = (v: number) => v < 0 ? C_RED : v > 0 ? C_GREEN : C_TEXT_DIM;
  const ecartCell = (v: string | number) => ({
    v,
    t: (typeof v === 'number' ? 'n' : 's') as 's' | 'n',
    s: {
      fill: { fgColor: { rgb: C_ECART_BG } },
      font: { bold: typeof v === 'number', color: { rgb: typeof v === 'number' ? ecartColor(v) : C_TEXT_DIM } },
      alignment: { horizontal: typeof v === 'number' ? 'right' : 'center', vertical: 'center' },
      border: border(C_BORD_HDR),
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ws: Record<string, any> = {};

  ws['!cols'] = [14, 18, 15, 15, 15, 15, 11, 11].map(w => ({ wch: w }));
  ws['!rows'] = [{ hpt: 22 }, { hpt: 18 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },
    { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } },
    { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } },
    { s: { r: 0, c: 6 }, e: { r: 0, c: 7 } },
  ];

  ws['A1'] = hdrCell('Date', C_HDR_KAKI);
  ws['B1'] = hdrCell('Jour', C_HDR_KAKI);
  ws['C1'] = hdrCell('Frites', C_HDR_PINK);
  ws['D1'] = { v: '', t: 's', s: { fill: { fgColor: { rgb: C_HDR_PINK } }, border: border(C_BORD_HDR) } };
  ws['E1'] = hdrCell('Viande', C_HDR_PINK);
  ws['F1'] = { v: '', t: 's', s: { fill: { fgColor: { rgb: C_HDR_PINK } }, border: border(C_BORD_HDR) } };
  ws['G1'] = hdrCell('Buns', C_HDR_PINK);
  ws['H1'] = { v: '', t: 's', s: { fill: { fgColor: { rgb: C_HDR_PINK } }, border: border(C_BORD_HDR) } };

  ws['A2'] = { v: '', t: 's', s: { fill: { fgColor: { rgb: C_HDR_KAKI } }, border: border(C_BORD_HDR) } };
  ws['B2'] = { v: '', t: 's', s: { fill: { fgColor: { rgb: C_HDR_KAKI } }, border: border(C_BORD_HDR) } };
  ws['C2'] = hdrCell('Commandé (kg)', C_SUBHDR, C_TEXT_SUB, false, 9);
  ws['D2'] = hdrCell('Livré (kg)',     C_SUBHDR, C_TEXT_SUB, false, 9);
  ws['E2'] = hdrCell('Commandé (kg)', C_SUBHDR, C_TEXT_SUB, false, 9);
  ws['F2'] = hdrCell('Livré (kg)',     C_SUBHDR, C_TEXT_SUB, false, 9);
  ws['G2'] = hdrCell('Commandé',      C_SUBHDR, C_TEXT_SUB, false, 9);
  ws['H2'] = hdrCell('Livré',         C_SUBHDR, C_TEXT_SUB, false, 9);

  dataOrders.forEach((o, idx) => {
    const reception = receptionsMap[o.id];
    const row = idx + 3;
    const isWeekend = o.day_name === 'Samedi' || o.day_name === 'Dimanche';
    const bg = isWeekend ? C_ROW_WE : idx % 2 === 0 ? C_ROW : C_ROW_ALT;

    const d = new Date(o.date + 'T00:00:00');
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    const fritesLivrees = reception != null ? reception.frites_recues : null;
    const viandeLivree  = reception != null ? r1(reception.viande_recue_boeuf + reception.viande_recue_gras) : null;
    const bunsLivres    = reception != null ? reception.buns_recus : null;

    ws[`A${row}`] = dataCell(dateStr,            's', bg, C_TEXT, 'center');
    ws[`B${row}`] = dataCell(o.day_name,          's', bg, C_TEXT, 'left');
    ws[`C${row}`] = dataCell(o.frites_commander,  'n', bg, C_TEXT);
    ws[`D${row}`] = fritesLivrees !== null
      ? dataCell(fritesLivrees, 'n', bg, r1(fritesLivrees) < r1(o.frites_commander) ? C_RED : C_TEXT)
      : dataCell('—', 's', bg, C_TEXT_DIM, 'center');
    ws[`E${row}`] = dataCell(o.viande_total,      'n', bg, C_TEXT);
    ws[`F${row}`] = viandeLivree !== null
      ? dataCell(viandeLivree, 'n', bg, viandeLivree < r1(o.viande_total) ? C_RED : C_TEXT)
      : dataCell('—', 's', bg, C_TEXT_DIM, 'center');
    ws[`G${row}`] = dataCell(o.buns_commander,    'n', bg, C_TEXT);
    ws[`H${row}`] = bunsLivres !== null
      ? dataCell(bunsLivres, 'n', bg, bunsLivres < o.buns_commander ? C_RED : C_TEXT)
      : dataCell('—', 's', bg, C_TEXT_DIM, 'center');
  });

  // ── Totaux ───────────────────────────────────────────────────────────────────
  const totalFritesCmd = r1(dataOrders.reduce((s, o) => s + o.frites_commander, 0));
  const totalViandeCmd = r1(dataOrders.reduce((s, o) => s + o.viande_total, 0));
  const totalBunsCmd   = dataOrders.reduce((s, o) => s + o.buns_commander, 0);

  const ordersWithRec  = dataOrders.filter(o => receptionsMap[o.id] != null);
  const totalFritesLiv = r1(ordersWithRec.reduce((s, o) => s + receptionsMap[o.id].frites_recues, 0));
  const totalViandeLiv = r1(ordersWithRec.reduce((s, o) => s + r1(receptionsMap[o.id].viande_recue_boeuf + receptionsMap[o.id].viande_recue_gras), 0));
  const totalBunsLiv   = ordersWithRec.reduce((s, o) => s + receptionsMap[o.id].buns_recus, 0);

  // Commandé uniquement sur les commandes avec réception (base de calcul de l'écart)
  const recFritesCmd   = r1(ordersWithRec.reduce((s, o) => s + o.frites_commander, 0));
  const recViandeCmd   = r1(ordersWithRec.reduce((s, o) => s + o.viande_total, 0));
  const recBunsCmd     = ordersWithRec.reduce((s, o) => s + o.buns_commander, 0);

  const hasRec   = ordersWithRec.length > 0;
  const totalRow = dataOrders.length + 3;
  const ecartRow = dataOrders.length + 4;

  ws[`A${totalRow}`] = totCell('TOTAL');
  ws[`B${totalRow}`] = totCell(`${dataOrders.length} commande${dataOrders.length > 1 ? 's' : ''}`, C_TEXT_SUB);
  ws[`C${totalRow}`] = totCell(totalFritesCmd);
  ws[`D${totalRow}`] = hasRec ? totCell(totalFritesLiv) : totCell('—', C_TEXT_DIM);
  ws[`E${totalRow}`] = totCell(totalViandeCmd);
  ws[`F${totalRow}`] = hasRec ? totCell(totalViandeLiv) : totCell('—', C_TEXT_DIM);
  ws[`G${totalRow}`] = totCell(totalBunsCmd);
  ws[`H${totalRow}`] = hasRec ? totCell(totalBunsLiv) : totCell('—', C_TEXT_DIM);

  // Écart = livré − commandé (sur les commandes ayant une réception)
  ws[`A${ecartRow}`] = ecartCell('ÉCART');
  ws[`B${ecartRow}`] = ecartCell(`sur ${ordersWithRec.length} livraison${ordersWithRec.length > 1 ? 's' : ''}`);
  ws[`C${ecartRow}`] = ecartCell('—');
  ws[`D${ecartRow}`] = hasRec ? ecartCell(r1(totalFritesLiv - recFritesCmd)) : ecartCell('—');
  ws[`E${ecartRow}`] = ecartCell('—');
  ws[`F${ecartRow}`] = hasRec ? ecartCell(r1(totalViandeLiv - recViandeCmd)) : ecartCell('—');
  ws[`G${ecartRow}`] = ecartCell('—');
  ws[`H${ecartRow}`] = hasRec ? ecartCell(totalBunsLiv - recBunsCmd) : ecartCell('—');

  ws['!ref'] = `A1:H${ecartRow}`;

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Historique');
  XLSXStyle.writeFile(wb, `night-order-${label}.xlsx`);
}
