'use client';

import { useEffect, useState, useCallback, useRef, Fragment } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchOrders, updateOrder, deleteOrder, insertManualOrder, fetchSuppliers, fetchReceptions, saveReception, updateReception, verifyReception, syncReceptionCommanded, DailyOrder, MorningReception } from '@/lib/db';
import { notifyDeliveryDiscrepancy } from '@/lib/push';
import { Supplier, Product } from '@/lib/types';

type Prices = { frites: number | null; viande: number | null; buns: number | null };

function getSupplierPrices(suppliers: Supplier[]): Prices {
  const get = (product: Product) => {
    const active = suppliers.filter(s => s.product === product && s.is_active);
    return (active.find(s => s.is_primary) ?? active[0])?.price ?? null;
  };
  return { frites: get('frites'), viande: get('viande'), buns: get('buns') };
}

function calcCost(orders: DailyOrder[], prices: Prices): { total: number | null; breakdown: string } {
  let total = 0; let hasAny = false; const parts: string[] = [];
  const add = (price: number | null, qty: number, label: string) => {
    if (price == null) return;
    const c = price * qty; total += c; hasAny = true;
    parts.push(`${label} ${c.toFixed(0)} €`);
  };
  add(prices.frites, orders.reduce((s, o) => s + o.frites_commander, 0), 'Frites');
  add(prices.viande, orders.reduce((s, o) => s + o.viande_total, 0), 'Viande');
  add(prices.buns, orders.reduce((s, o) => s + o.buns_commander, 0), 'Buns');
  return { total: hasAny ? total : null, breakdown: parts.join(' · ') };
}

type EditableField = keyof Omit<DailyOrder, 'id' | 'date' | 'day_name' | 'validated_at'>;
type OrderRow = DailyOrder & { isPlaceholder?: boolean };

const FR_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildUpcomingPlaceholders(orders: DailyOrder[]): OrderRow[] {
  const existingDates = new Set(orders.map(o => o.date));
  const placeholders: OrderRow[] = [];
  for (let offset = 0; offset <= 2; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const date = localDateStr(d);
    if (!existingDates.has(date)) {
      placeholders.push({
        id: `placeholder-${date}`, date,
        day_name: FR_DAYS[d.getDay()],
        burgers_prevus: 0, frites_fraiches: 0, frites_blanchies: 0,
        boules_restantes: 0, pct_gras: 26.5, buns_restants: 0,
        frites_blanchir: 0, frites_commander: 0, viande_total: 0,
        boeuf: 0, gras: 0, buns_commander: 0,
        validated_at: '', isPlaceholder: true,
      });
    }
  }
  return placeholders;
}

const EDITABLE_FIELDS: { key: EditableField; label: string; unit?: string }[] = [
  { key: 'burgers_prevus', label: 'Burgers prévus' },
  { key: 'frites_commander', label: 'Frites à commander', unit: 'kg' },
  { key: 'boeuf', label: 'Bœuf à commander', unit: 'kg' },
  { key: 'gras', label: 'Gras à commander', unit: 'kg' },
  { key: 'buns_commander', label: 'Buns commandés' },
];

function groupByMonth(orders: OrderRow[]): Record<string, OrderRow[]> {
  return orders.reduce((acc, o) => {
    const key = o.date.slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {} as Record<string, OrderRow[]>);
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

const fmt1 = (n: number) => n.toFixed(1);

function daysInMonthFromKey(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function exportExcel(orders: DailyOrder[], receptionsMap: Record<string, MorningReception>, label: string) {
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

function ExportModal({ orders, monthKeys, receptionsMap, onClose }: { orders: DailyOrder[]; monthKeys: string[]; receptionsMap: Record<string, MorningReception>; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Grouper les mois par année
  const byYear: Record<string, string[]> = {};
  for (const key of monthKeys) {
    const year = key.slice(0, 4);
    if (!byYear[year]) byYear[year] = [];
    byYear[year].push(key);
  }
  const years = Object.keys(byYear).sort().reverse();

  function toggleMonth(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleYear(year: string) {
    const yearMonths = byYear[year];
    const allIn = yearMonths.every(k => selected.has(k));
    setSelected(prev => {
      const next = new Set(prev);
      yearMonths.forEach(k => allIn ? next.delete(k) : next.add(k));
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev => prev.size === monthKeys.length ? new Set() : new Set(monthKeys));
  }

  async function doExport() {
    const toExport = selected.size === 0 || selected.size === monthKeys.length
      ? orders
      : orders.filter(o => selected.has(o.date.slice(0, 7)));
    const label = selected.size === 0 || selected.size === monthKeys.length
      ? 'historique-complet'
      : Array.from(selected).sort().join('_');
    await exportExcel(toExport, receptionsMap, label);
    onClose();
  }

  const allSelected = selected.size === monthKeys.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-white font-bold text-lg mb-1">Export Excel</h3>
        <p className="text-[#8BA870] text-sm mb-4">Sélectionne les mois à exporter</p>

        <button
          onClick={toggleAll}
          className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold mb-3 border transition-colors ${
            allSelected ? 'bg-[#FF4D8A]/20 border-[#FF4D8A]/50 text-[#FF4D8A]' : 'border-[#6B7A50] text-[#C8D4B0] hover:bg-[#496035]'
          }`}
        >
          {allSelected ? '✓ ' : ''}Tout l'historique ({orders.length} commandes)
        </button>

        <div className="space-y-3 max-h-72 overflow-y-auto mb-4">
          {years.map(year => {
            const yearMonths = byYear[year];
            const allYearSelected = yearMonths.every(k => selected.has(k));
            const someYearSelected = yearMonths.some(k => selected.has(k));
            const yearCount = yearMonths.reduce((s, k) => s + orders.filter(o => o.date.slice(0, 7) === k).length, 0);

            return (
              <div key={year}>
                <button
                  onClick={() => toggleYear(year)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold border transition-colors flex items-center justify-between mb-1 ${
                    allYearSelected ? 'bg-[#FF4D8A]/20 border-[#FF4D8A]/50 text-[#FF4D8A]'
                    : someYearSelected ? 'bg-[#FF4D8A]/10 border-[#FF4D8A]/30 text-[#FF4D8A]/80'
                    : 'border-[#6B7A50] text-white hover:bg-[#496035]'
                  }`}
                >
                  <span>{allYearSelected ? '✓ ' : someYearSelected ? '– ' : ''}{year}</span>
                  <span className="text-xs font-normal opacity-70">{yearCount} commandes</span>
                </button>

                <div className="pl-3 space-y-1">
                  {yearMonths.map(key => {
                    const count = orders.filter(o => o.date.slice(0, 7) === key).length;
                    const isSelected = selected.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleMonth(key)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-sm border transition-colors flex items-center justify-between ${
                          isSelected ? 'bg-[#FF4D8A]/20 border-[#FF4D8A]/50 text-[#FF4D8A]' : 'border-[#6B7A50] text-[#C8D4B0] hover:bg-[#496035]'
                        }`}
                      >
                        <span>{isSelected ? '✓ ' : ''}{monthLabel(key)}</span>
                        <span className="text-xs opacity-70">{count} soir{count > 1 ? 's' : ''}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#6B7A50] text-[#C8D4B0] text-sm font-medium hover:bg-[#496035]">
            Annuler
          </button>
          <button
            onClick={doExport}
            className="flex-1 py-2.5 rounded-xl bg-[#FF4D8A] text-white text-sm font-bold hover:bg-[#E03070] transition-colors"
          >
            ↓ Télécharger
          </button>
        </div>
      </div>
    </div>
  );
}

function AddOrderModal({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
  const today = localDateStr(new Date());
  const [date, setDate] = useState(today);
  const [values, setValues] = useState({ burgers_prevus: '', frites_commander: '', viande_total: '', pct_gras: '26.5', buns_commander: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(v => ({ ...v, [k]: e.target.value }));

  const handleSave = async () => {
    const burgers = parseInt(values.burgers_prevus);
    const frites  = parseFloat(values.frites_commander);
    const viande  = parseFloat(values.viande_total);
    const pct     = parseFloat(values.pct_gras) || 26.5;
    const buns    = parseInt(values.buns_commander);
    if (!date || [burgers, frites, viande, buns].some(n => isNaN(n))) {
      setErr('Tous les champs sont requis.'); return;
    }
    const gras  = Math.round(viande * pct / 100 * 10) / 10;
    const boeuf = Math.round((viande - gras) * 10) / 10;
    setSaving(true);
    const { error } = await insertManualOrder({ date, burgers_prevus: burgers, frites_commander: frites, viande_total: viande, boeuf, gras, buns_commander: buns });
    setSaving(false);
    if (error) { setErr(error); return; }
    onSave();
  };

  const fields: { key: keyof typeof values; label: string; unit?: string; type?: string }[] = [
    { key: 'burgers_prevus',  label: 'Burgers prévus' },
    { key: 'frites_commander', label: 'Frites commandées', unit: 'kg' },
    { key: 'viande_total',    label: 'Viande totale',     unit: 'kg' },
    { key: 'pct_gras',        label: '% gras',            unit: '%' },
    { key: 'buns_commander',  label: 'Buns commandés' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-white font-bold text-lg mb-1">Ajouter une commande</h3>
        <p className="text-[#C8D4B0] text-sm mb-4">Saisie manuelle</p>
        <div className="space-y-3 mb-5">
          <div className="flex items-center justify-between gap-4">
            <label className="text-[#C8D4B0] text-sm flex-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-40 bg-[#FFF0F5] text-[#1A1209] text-right rounded-lg px-3 py-1.5 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
          </div>
          {fields.map(({ key, label, unit }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <label className="text-[#C8D4B0] text-sm flex-1">{label}</label>
              <div className="flex items-center gap-1">
                <input type="number" value={values[key]} onChange={set(key)}
                  className="w-24 bg-[#FFF0F5] text-[#1A1209] text-right rounded-lg px-3 py-1.5 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
                  placeholder="0" />
                {unit && <span className="text-[#8BA870] text-xs w-6">{unit}</span>}
              </div>
            </div>
          ))}
        </div>
        {err && <p className="text-red-400 text-xs mb-3">{err}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#6B7A50] text-[#C8D4B0] text-sm font-medium hover:bg-[#496035]">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#FF4D8A] text-white text-sm font-bold hover:bg-[#E03070] disabled:opacity-50 transition-colors">
            {saving ? 'Enregistrement…' : '+ Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ order, onSave, onClose }: { order: DailyOrder; onSave: (u: Partial<DailyOrder>) => void; onClose: () => void }) {
  const [values, setValues] = useState<Partial<DailyOrder>>({});

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-white font-bold text-lg mb-1">Modifier la commande</h3>
        <p className="text-[#C8D4B0] text-sm mb-4">{formatDate(order.date)} — {order.burgers_prevus} burgers</p>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {EDITABLE_FIELDS.map(({ key, label, unit }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <label className="text-[#C8D4B0] text-sm flex-1">{label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  defaultValue={order[key] as number}
                  onChange={(e) => setValues((v) => ({ ...v, [key]: parseFloat(e.target.value) }))}
                  className="w-24 bg-[#FFF0F5] text-[#1A1209] text-right rounded-lg px-3 py-1.5 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
                />
                {unit && <span className="text-[#8BA870] text-xs w-6">{unit}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#6B7A50] text-[#C8D4B0] text-sm font-medium hover:bg-[#496035]">
            Annuler
          </button>
          <button onClick={() => onSave(values)} className="flex-1 py-2.5 rounded-xl bg-[#FF4D8A] text-white text-sm font-bold hover:bg-[#E03070]">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function EditReceptionModal({ reception, onSave, onClose }: {
  reception: MorningReception;
  onSave: (values: { frites_recues: number; viande_recue_boeuf: number; viande_recue_gras: number; buns_recus: number }) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState({
    frites_recues: reception.frites_recues,
    viande_recue_boeuf: reception.viande_recue_boeuf,
    viande_recue_gras: reception.viande_recue_gras,
    buns_recus: reception.buns_recus,
  });

  const fields: { key: keyof typeof values; label: string; cmd: number; unit: string }[] = [
    { key: 'frites_recues', label: 'Frites reçues', cmd: reception.frites_commander, unit: 'kg' },
    { key: 'viande_recue_boeuf', label: 'Bœuf reçu', cmd: reception.viande_boeuf_commande, unit: 'kg' },
    { key: 'viande_recue_gras', label: 'Gras reçu', cmd: reception.viande_gras_commande, unit: 'kg' },
    { key: 'buns_recus', label: 'Buns reçus', cmd: reception.buns_commander, unit: '' },
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-white font-bold text-lg mb-1">Modifier la livraison</h3>
        <p className="text-[#C8D4B0] text-sm mb-4">{formatDate(reception.date)}</p>
        <div className="space-y-3 mb-5">
          {fields.map(({ key, label, cmd, unit }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <label className="text-[#C8D4B0] text-sm">{label}</label>
                <p className="text-[#6B7A50] text-xs">Commandé : {cmd}{unit ? ' ' + unit : ''}</p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={values[key]}
                  onChange={(e) => setValues(v => ({ ...v, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-24 bg-[#FFF0F5] text-[#1A1209] text-right rounded-lg px-3 py-1.5 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
                />
                {unit && <span className="text-[#8BA870] text-xs w-6">{unit}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#6B7A50] text-[#C8D4B0] text-sm font-medium hover:bg-[#496035]">
            Annuler
          </button>
          <button onClick={() => onSave(values)} className="flex-1 py-2.5 rounded-xl bg-[#FF4D8A] text-white text-sm font-bold hover:bg-[#E03070]">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function AddReceptionModal({ order, onSave, onClose }: {
  order: DailyOrder;
  onSave: () => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState({
    frites: order.frites_commander,
    boeuf: order.boeuf,
    gras: order.gras,
    buns: order.buns_commander,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fields: { key: keyof typeof values; label: string; cmd: number; unit: string }[] = [
    { key: 'frites', label: 'Frites reçues',  cmd: order.frites_commander, unit: 'kg' },
    { key: 'boeuf',  label: 'Bœuf reçu',      cmd: order.boeuf,            unit: 'kg' },
    { key: 'gras',   label: 'Gras reçu',       cmd: order.gras,             unit: 'kg' },
    { key: 'buns',   label: 'Buns reçus',      cmd: order.buns_commander,   unit: '' },
  ];

  const handleSave = async () => {
    setSaving(true);
    const { error } = await saveReception(order, values);
    setSaving(false);
    if (error) { setErr(error); return; }
    const d = new Date(order.date + 'T00:00:00');
    const dateLabel = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    notifyDeliveryDiscrepancy({
      date: dateLabel,
      isoDate: order.date,
      fritesCmd: order.frites_commander, fritesRecues: values.frites,
      boeufCmd: order.boeuf, boeufRecu: values.boeuf,
      grasCmd: order.gras,   grasRecu: values.gras,
      bunsCmd: order.buns_commander, bunsRecus: values.buns,
    }).catch(() => {});
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-white font-bold text-lg mb-1">Saisir la livraison</h3>
        <p className="text-[#C8D4B0] text-sm mb-4">{formatDate(order.date)} — {order.burgers_prevus} burgers</p>
        <div className="space-y-3 mb-5">
          {fields.map(({ key, label, cmd, unit }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <label className="text-[#C8D4B0] text-sm">{label}</label>
                <p className="text-[#6B7A50] text-xs">Commandé : {cmd}{unit ? ' ' + unit : ''}</p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={values[key]}
                  onChange={(e) => setValues(v => ({ ...v, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-24 bg-[#FFF0F5] text-[#1A1209] text-right rounded-lg px-3 py-1.5 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
                />
                {unit && <span className="text-[#8BA870] text-xs w-6">{unit}</span>}
              </div>
            </div>
          ))}
        </div>
        {err && <p className="text-red-400 text-xs mb-3">{err}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#6B7A50] text-[#C8D4B0] text-sm font-medium hover:bg-[#496035]">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#FF4D8A] text-white text-sm font-bold hover:bg-[#E03070] disabled:opacity-50 transition-colors">
            {saving ? 'Enregistrement…' : '📦 Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 w-full max-w-xs shadow-xl">
        <p className="text-white text-base font-medium mb-5 text-center">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-[#6B7A50] text-[#C8D4B0] text-sm font-medium hover:bg-[#496035]">
            Annuler
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-[#FF4D8A] hover:bg-[#E03070] text-white text-sm font-bold transition-colors">
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

function EcartChip({ value, unit = '' }: { value: number; unit?: string }) {
  const isNeg = value < 0;
  const isZero = value === 0;
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
      isNeg ? 'bg-red-500/20 text-red-400' : isZero ? 'bg-[#6B7A50]/30 text-[#8BA870]' : 'bg-green-500/20 text-green-400'
    }`}>
      {value > 0 ? '+' : ''}{value}{unit}
    </span>
  );
}

function ReceptionPanel({ r, onEdit, onVerify }: { r: MorningReception; onEdit: () => void; onVerify: () => void }) {
  const rows = [
    { label: 'Frites', cmd: r.frites_commander, recu: r.frites_recues, ecart: r.ecart_frites, unit: ' kg' },
    { label: 'Bœuf',  cmd: r.viande_boeuf_commande, recu: r.viande_recue_boeuf, ecart: r.ecart_boeuf, unit: ' kg' },
    { label: 'Gras',  cmd: r.viande_gras_commande,  recu: r.viande_recue_gras,  ecart: r.ecart_gras,  unit: ' kg' },
    { label: 'Buns',  cmd: r.buns_commander, recu: r.buns_recus, ecart: r.ecart_buns, unit: '' },
  ];
  return (
    <tr>
      <td colSpan={6} className="px-4 pb-3 pt-0 bg-[#3D4E2B]">
        <div className="rounded-xl border border-[#6B7A50] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#2E3D1F] text-[#8BA870]">
                <th className="text-left px-3 py-1.5 font-bold uppercase tracking-wider">📦 Livraison reçue</th>
                <th className="text-right px-3 py-1.5">Commandé</th>
                <th className="text-right px-3 py-1.5">Reçu</th>
                <th className="text-right px-3 py-1.5">Écart</th>
                <th className="px-3 py-1.5">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={onEdit} className="text-[#8BA870] hover:text-[#FF4D8A] border border-[#6B7A50] hover:border-[#FF4D8A]/40 px-2 py-0.5 rounded-md transition-colors">
                      Modifier
                    </button>
                    {!r.is_verified && (
                      <button onClick={onVerify} className="text-green-400 hover:text-green-300 border border-green-600/50 hover:border-green-400 px-2 py-0.5 rounded-md transition-colors font-bold">
                        ✓ Vérifier
                      </button>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className="border-t border-[#496035]">
                  <td className="px-3 py-1.5 text-[#C8D4B0] font-medium">{row.label}</td>
                  <td className="px-3 py-1.5 text-right text-[#8BA870]">{row.cmd}{row.unit}</td>
                  <td className="px-3 py-1.5 text-right text-white font-bold">{row.recu}{row.unit}</td>
                  <td className="px-3 py-1.5 text-right"><EcartChip value={row.ecart} unit={row.unit} /></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function MonthBlock({ monthKey, orders, prices, receptionsMap, onEdit, onDelete, onEditReception, onAddReception, onVerifyReception, onAdd, highlightDate }: {
  monthKey: string;
  orders: OrderRow[];
  prices: Prices;
  receptionsMap: Record<string, MorningReception>;
  highlightDate?: string | null;
  onEdit: (o: DailyOrder) => void;
  onDelete: (id: string) => void;
  onEditReception: (r: MorningReception) => void;
  onAddReception: (o: DailyOrder) => void;
  onVerifyReception: (id: string) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [expandedReception, setExpandedReception] = useState<string | null>(null);

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#596643] rounded-xl border border-[#6B7A50] hover:bg-[#496035] transition-colors"
      >
        <span className="text-[#F5EFA0] font-bold text-sm uppercase tracking-wider">{monthLabel(monthKey)}</span>
        <div className="flex items-center gap-3">
          <span className="text-[#8BA870] text-xs">{orders.filter(o => !o.isPlaceholder && o.burgers_prevus > 0).length}/{daysInMonthFromKey(monthKey)} jours</span>
          <span className="text-[#8BA870] text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="mt-1 overflow-x-auto rounded-xl border border-[#6B7A50]">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="bg-[#496035] text-[#8BA870] text-xs uppercase">
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-right px-3 py-2.5">Burgers prévus</th>
                <th className="text-right px-3 py-2.5">Frites cmd</th>
                <th className="text-right px-3 py-2.5">Viande</th>
                <th className="text-right px-3 py-2.5">Buns</th>
                <th className="px-3 py-2.5 text-right">
                  <button
                    onClick={onAdd}
                    className="bg-[#FF4D8A] hover:bg-[#E03070] text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-colors normal-case tracking-normal"
                  >
                    + Ajouter
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const reception = receptionsMap[o.id];
                const isExpanded = expandedReception === o.id;
                return (
                  <Fragment key={o.id}>
                    <tr data-date={o.date} className={`border-t border-[#6B7A50] ${'isPlaceholder' in o && o.isPlaceholder ? 'bg-[#3D4E2B]/60 opacity-60' : highlightDate === o.date ? 'bg-[#FF4D8A]/20 border-l-4 border-l-[#FF4D8A]' : i % 2 === 0 ? 'bg-[#596643]' : 'bg-[#4D5A39]'} hover:bg-[#496035] transition-colors`}>
                      <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {formatDate(o.date)}
                          {'isPlaceholder' in o && o.isPlaceholder && (
                            <span className="text-[10px] bg-[#6B7A50]/40 text-[#8BA870] border border-[#6B7A50] px-1.5 py-0.5 rounded-full font-bold">
                              À venir
                            </span>
                          )}
                          {reception ? (
                            <button
                              onClick={() => setExpandedReception(isExpanded ? null : o.id)}
                              title={reception.is_verified ? 'Livraison vérifiée' : 'Voir la livraison reçue'}
                              className={`text-xs px-1.5 py-0.5 rounded-md border transition-colors ${
                                isExpanded
                                  ? 'bg-[#F5EFA0]/20 border-[#F5EFA0]/50 text-[#F5EFA0]'
                                  : 'border-[#6B7A50] text-[#8BA870] hover:text-[#F5EFA0] hover:border-[#F5EFA0]/50'
                              }`}
                            >
                              {reception.is_verified ? '✅' : '📦'}
                            </button>
                          ) : (!('isPlaceholder' in o && o.isPlaceholder) && o.burgers_prevus > 0 && (
                            <button
                              onClick={() => onAddReception(o)}
                              title="Saisir la livraison reçue"
                              className="text-xs px-1.5 py-0.5 rounded-md border border-dashed border-[#6B7A50]/60 text-[#6B7A50] hover:border-[#8BA870] hover:text-[#8BA870] transition-colors"
                            >
                              📦
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#FF4D8A] font-bold">
                        {o.burgers_prevus === 0 ? <span className="text-[#6B7A50]">—</span> : o.burgers_prevus}
                      </td>
                      <td className="px-3 py-2.5 text-right text-white">
                        {o.burgers_prevus === 0 ? <span className="text-[#6B7A50]">—</span> : `${fmt1(o.frites_commander)} kg`}
                      </td>
                      <td className="px-3 py-2.5 text-right text-white">
                        {o.burgers_prevus === 0 ? <span className="text-[#6B7A50]">—</span> : `${fmt1(o.viande_total)} kg`}
                      </td>
                      <td className="px-3 py-2.5 text-right text-white">{o.buns_commander}</td>
                      <td className="px-3 py-2.5">
                        {!('isPlaceholder' in o && o.isPlaceholder) && (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => onEdit(o)} className="text-[#C8D4B0] hover:text-[#FF4D8A] text-xs px-2 py-1 rounded-lg border border-[#6B7A50] hover:border-[#FF4D8A]/40 transition-colors">
                              Modifier
                            </button>
                            <button onClick={() => onDelete(o.id)} className="text-[#8BA870] hover:text-red-400 text-xs px-2 py-1 rounded-lg border border-[#6B7A50] hover:border-red-400/40 transition-colors" title="Supprimer">
                              ✕
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {isExpanded && reception && <ReceptionPanel r={reception} onEdit={() => onEditReception(reception)} onVerify={() => onVerifyReception(reception.id)} />}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              {(() => {
                const real = orders.filter(o => !('isPlaceholder' in o && o.isPlaceholder));
                const { total, breakdown } = calcCost(real, prices);
                return (<>
              <tr className="border-t-2 border-[#6B7A50] bg-[#3D4E2B]">
                <td className="px-4 py-2.5 text-[#F5EFA0] text-xs font-bold uppercase tracking-wider">Total {monthLabel(monthKey)}</td>
                <td className="px-3 py-2.5 text-right text-[#FF4D8A] font-bold">{real.reduce((s, o) => s + o.burgers_prevus, 0)}</td>
                <td className="px-3 py-2.5 text-right text-white font-bold">{fmt1(real.reduce((s, o) => s + o.frites_commander, 0))} kg</td>
                <td className="px-3 py-2.5 text-right text-white font-bold">{fmt1(real.reduce((s, o) => s + o.viande_total, 0))} kg</td>
                <td className="px-3 py-2.5 text-right text-white font-bold">{real.reduce((s, o) => s + o.buns_commander, 0)}</td>
                <td></td>
              </tr>
              {total !== null ? (
              <tr className="bg-[#2E3D1F] border-t border-[#6B7A50]">
                <td className="px-4 py-2 text-[#F5EFA0] text-xs font-bold">💶 Coût estimé</td>
                <td colSpan={4} className="px-3 py-2 text-right">
                  <span className="text-white font-bold">{total.toFixed(2)} €</span>
                  <span className="text-[#8BA870] text-xs ml-2">({breakdown})</span>
                </td>
                <td></td>
              </tr>) : null}
              </>);
              })()}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default function HistoriqueSection() {
  const searchParams = useSearchParams();
  const highlightDate = searchParams.get('date') ?? null;

  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receptionsMap, setReceptionsMap] = useState<Record<string, MorningReception>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DailyOrder | null>(null);
  const [editingReception, setEditingReception] = useState<MorningReception | null>(null);
  const [addingReception, setAddingReception] = useState<DailyOrder | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const didScrollRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [data, sup] = await Promise.all([fetchOrders(), fetchSuppliers()]);
      setOrders(data);
      setSuppliers(sup);
    } catch {
      setError('Impossible de charger l\'historique. Vérifiez la connexion Supabase.');
      setLoading(false);
      return;
    }
    try {
      const receptions = await fetchReceptions();
      const map: Record<string, MorningReception> = {};
      receptions.forEach(r => { map[r.order_id] = r; });
      setReceptionsMap(map);
    } catch {
      // La table morning_reception n'existe pas encore — on continue sans
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!highlightDate || loading || didScrollRef.current) return;
    const el = document.querySelector(`[data-date="${highlightDate}"]`);
    if (el) {
      didScrollRef.current = true;
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [highlightDate, loading]);

  const handleEdit = async (updated: Partial<DailyOrder>) => {
    if (!editing) return;
    const merged = { ...editing, ...updated };
    // Recalculer viande_total si boeuf ou gras ont changé
    if (updated.boeuf !== undefined || updated.gras !== undefined) {
      updated.viande_total = Math.round((merged.boeuf + merged.gras) * 1000) / 1000;
    }
    await updateOrder(editing.id, updated);
    // Resynchroniser les quantités commandées dans la réception si elle existe
    const reception = receptionsMap[editing.id];
    if (reception) {
      await syncReceptionCommanded(reception, {
        frites_commander: merged.frites_commander,
        boeuf: merged.boeuf,
        gras: merged.gras,
        buns_commander: merged.buns_commander,
      });
    }
    setEditing(null);
    load();
  };

  const handleEditReception = async (values: { frites_recues: number; viande_recue_boeuf: number; viande_recue_gras: number; buns_recus: number }) => {
    if (!editingReception) return;
    await updateReception(editingReception.id, values, editingReception);
    const d = new Date(editingReception.date + 'T00:00:00');
    const dateLabel = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    notifyDeliveryDiscrepancy({
      date: dateLabel,
      isoDate: editingReception.date,
      fritesCmd: editingReception.frites_commander, fritesRecues: values.frites_recues,
      boeufCmd: editingReception.viande_boeuf_commande, boeufRecu: values.viande_recue_boeuf,
      grasCmd: editingReception.viande_gras_commande,  grasRecu: values.viande_recue_gras,
      bunsCmd: editingReception.buns_commander, bunsRecus: values.buns_recus,
    }).catch(() => {});
    setEditingReception(null);
    load();
  };

  const handleAddReception = async () => {
    setAddingReception(null);
    load();
  };

  const handleVerifyReception = async (id: string) => {
    await verifyReception(id);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteOrder(id);
    if (error) { alert('Erreur lors de la suppression : ' + error); return; }
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const allRows: OrderRow[] = [...buildUpcomingPlaceholders(orders), ...orders]
    .sort((a, b) => b.date.localeCompare(a.date));
  const grouped = groupByMonth(allRows);
  const monthKeys = Object.keys(grouped).sort().reverse();

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[#1A1209]">Historique</h2>
          <p className="text-[#C4A8B5] text-sm mt-0.5">{orders.length} commandes</p>
        </div>
        <button
          onClick={() => setShowExport(true)}
          className="shrink-0 flex items-center gap-2 bg-[#596643] hover:bg-[#496035] border border-[#6B7A50] text-[#C8D4B0] hover:text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          ↓ <span className="hidden sm:inline">Export </span>Excel
        </button>
      </div>

      {loading && <div className="text-center py-16 text-[#C4A8B5]">Chargement…</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-500 text-sm mb-4">{error}</div>
      )}


      {monthKeys.map((key) => (
        <MonthBlock key={key} monthKey={key} orders={grouped[key]} prices={getSupplierPrices(suppliers)} receptionsMap={receptionsMap} highlightDate={highlightDate} onEdit={setEditing} onDelete={(id) => setConfirmDelete(id)} onEditReception={setEditingReception} onAddReception={setAddingReception} onVerifyReception={handleVerifyReception} onAdd={() => setShowAdd(true)} />
      ))}
      {!loading && !error && orders.length === 0 && allRows.length === 0 && (
        <div className="text-center py-16 text-[#C4A8B5]">
          <p className="text-4xl mb-3">📋</p>
          <p>Aucune commande enregistrée pour l'instant.</p>
          <p className="text-xs mt-2">Les commandes validées sur mobile apparaîtront ici.</p>
        </div>
      )}

      {editing && <EditModal order={editing} onSave={handleEdit} onClose={() => setEditing(null)} />}
      {editingReception && <EditReceptionModal reception={editingReception} onSave={handleEditReception} onClose={() => setEditingReception(null)} />}
      {addingReception && <AddReceptionModal order={addingReception} onSave={handleAddReception} onClose={() => setAddingReception(null)} />}
      {showExport && <ExportModal orders={orders} monthKeys={monthKeys} receptionsMap={receptionsMap} onClose={() => setShowExport(false)} />}
      {showAdd && <AddOrderModal onSave={() => { setShowAdd(false); load(); }} onClose={() => setShowAdd(false)} />}
      {confirmDelete && (
        <ConfirmModal
          message="Supprimer cette commande ?"
          onConfirm={() => { handleDelete(confirmDelete); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
