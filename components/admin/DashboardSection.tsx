'use client';

import { useEffect, useState } from 'react';
import { fetchOrders, fetchSuppliers, DailyOrder } from '@/lib/db';
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

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

interface WeekInfo { start: string; end: string; label: string }

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function getWeeksInMonth(year: number, month: number): WeekInfo[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const current = getMondayOf(firstDay);
  const weeks: WeekInfo[] = [];
  while (current <= lastDay) {
    const monday = new Date(current);
    const sunday = new Date(current);
    sunday.setDate(monday.getDate() + 6);
    weeks.push({ start: fmtDate(monday), end: fmtDate(sunday), label: `${fmtShort(monday)} – ${fmtShort(sunday)}` });
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

function getPrevMonth(year: number, month: number): { year: number; month: number } {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

function inRange(orders: DailyOrder[], start: string, end: string): DailyOrder[] {
  return orders.filter(o => o.date >= start && o.date <= end);
}

function sumKey(orders: DailyOrder[], key: keyof DailyOrder): number {
  return orders.reduce((acc, o) => acc + (Number(o[key]) || 0), 0);
}

function delta(curr: number, prev: number): { label: string; positive: boolean | null } {
  if (prev === 0 && curr === 0) return { label: '—', positive: null };
  if (prev === 0) return { label: 'nouveau', positive: true };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { label: `${pct >= 0 ? '+' : ''}${pct}%`, positive: pct >= 0 };
}

function KpiCard({ label, emoji, curr, prev, unit, prevLabel }: {
  label: string; emoji: string; curr: number; prev: number; unit?: string; prevLabel: string;
}) {
  const d = delta(curr, prev);
  return (
    <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-4">
      <p className="text-[#8BA870] text-xs font-bold uppercase tracking-widest mb-1">{emoji} {label}</p>
      <p className="text-white font-bold text-3xl">
        {curr > 0 ? curr : '—'}
        {unit && curr > 0 && <span className="text-lg ml-1">{unit}</span>}
      </p>
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        <span className="text-[#8BA870] text-xs">{prevLabel} : {prev > 0 ? `${prev}${unit ?? ''}` : '—'}</span>
        {d.positive !== null && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${d.positive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {d.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Vue semaine ──────────────────────────────────────────────────────────────

function WeekDetail({ week, orders, prices, onBack }: { week: WeekInfo; orders: DailyOrder[]; prices: Prices; onBack: () => void }) {
  const today = fmtDate(new Date());
  const prevMonday = new Date(week.start);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const prevWeek: WeekInfo = {
    start: fmtDate(prevMonday),
    end: fmtDate(new Date(new Date(week.start).setDate(new Date(week.start).getDate() - 1))),
    label: '',
  };

  const weekOrders = inRange(orders, week.start, week.end);
  const prevOrders = inRange(orders, prevWeek.start, prevWeek.end);

  const curr = { burgers: sumKey(weekOrders, 'burgers_prevus'), frites: sumKey(weekOrders, 'frites_commander'), viande: sumKey(weekOrders, 'viande_total'), buns: sumKey(weekOrders, 'buns_commander') };
  const prev = { burgers: sumKey(prevOrders, 'burgers_prevus'), frites: sumKey(prevOrders, 'frites_commander'), viande: sumKey(prevOrders, 'viande_total'), buns: sumKey(prevOrders, 'buns_commander') };

  const byDate: Record<string, DailyOrder> = {};
  weekOrders.forEach(o => { byDate[o.date] = o; });

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week.start + 'T12:00:00');
    d.setDate(d.getDate() + i);
    return fmtDate(d);
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-[#FF4D8A] text-sm font-semibold hover:underline">← Retour au mois</button>
        <span className="text-[#C4A8B5] text-sm">|</span>
        <span className="text-[#596643] font-bold text-sm">{week.label}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Burgers prévus" emoji="🍔" curr={curr.burgers} prev={prev.burgers} prevLabel="S-1" />
        <KpiCard label="Frites" emoji="🍟" curr={curr.frites} prev={prev.frites} unit=" kg" prevLabel="S-1" />
        <KpiCard label="Viande" emoji="🥩" curr={curr.viande} prev={prev.viande} unit=" kg" prevLabel="S-1" />
        <KpiCard label="Buns" emoji="🍞" curr={curr.buns} prev={prev.buns} prevLabel="S-1" />
      </div>

      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#6B7A50]">
          <h3 className="text-[#F5EFA0] text-sm font-bold uppercase tracking-widest">Détail par jour</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="border-b border-[#6B7A50]">
                <th className="text-left py-2 px-3 text-[#8BA870] text-xs font-bold uppercase tracking-wider">Jour</th>
                <th className="text-center py-2 px-3 text-[#8BA870] text-xs font-bold uppercase tracking-wider">Burgers prévus</th>
                <th className="text-center py-2 px-3 text-[#8BA870] text-xs font-bold uppercase tracking-wider">Frites</th>
                <th className="text-center py-2 px-3 text-[#8BA870] text-xs font-bold uppercase tracking-wider">Viande</th>
                <th className="text-center py-2 px-3 text-[#8BA870] text-xs font-bold uppercase tracking-wider">Buns</th>
              </tr>
            </thead>
            <tbody>
              {days.map(date => {
                const d = new Date(date + 'T12:00:00');
                const isFuture = date > today;
                const isToday = date === today;
                const order = byDate[date];
                const dayLabel = `${DAYS_FR[d.getDay()]} ${fmtShort(d)}`;
                return (
                  <tr key={date} className={`border-b border-[#6B7A50] ${isToday ? 'bg-[#FF4D8A]/10' : ''}`}>
                    <td className="py-2.5 px-3 text-sm">
                      <span className={`font-medium ${isToday ? 'text-[#FF4D8A]' : 'text-[#C8D4B0]'}`}>{dayLabel}</span>
                      {isToday && <span className="ml-1.5 text-[10px] bg-[#FF4D8A]/20 text-[#FF4D8A] border border-[#FF4D8A]/30 px-1.5 py-0.5 rounded-full font-bold">auj.</span>}
                    </td>
                    {order ? (
                      <>
                        <td className="py-2.5 px-3 text-center text-white font-bold text-sm">{order.burgers_prevus}</td>
                        <td className="py-2.5 px-3 text-center text-[#C8D4B0] text-sm">{order.frites_commander} kg</td>
                        <td className="py-2.5 px-3 text-center text-[#C8D4B0] text-sm">{order.viande_total} kg</td>
                        <td className="py-2.5 px-3 text-center text-[#C8D4B0] text-sm">{order.buns_commander}</td>
                      </>
                    ) : isFuture ? (
                      <td colSpan={4} className="py-2.5 px-3 text-[#496035] text-sm text-center italic">—</td>
                    ) : (
                      <td colSpan={4} className="py-2.5 px-3 text-[#496035] text-sm text-center italic">Pas de commande</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {curr.burgers > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#6B7A50] bg-[#496035]">
                  <td className="py-2.5 px-3 text-[#F5EFA0] text-sm font-bold">Total semaine</td>
                  <td className="py-2.5 px-3 text-center text-white font-bold text-sm">{curr.burgers}</td>
                  <td className="py-2.5 px-3 text-center text-white font-bold text-sm">{curr.frites} kg</td>
                  <td className="py-2.5 px-3 text-center text-white font-bold text-sm">{curr.viande} kg</td>
                  <td className="py-2.5 px-3 text-center text-white font-bold text-sm">{curr.buns}</td>
                </tr>
                {(() => { const { total, breakdown } = calcCost(weekOrders, prices); return total !== null ? (
                <tr className="bg-[#3D4E2B] border-t border-[#6B7A50]">
                  <td className="py-2 px-3 text-[#F5EFA0] text-xs font-bold">💶 Coût estimé</td>
                  <td colSpan={4} className="py-2 px-3 text-right">
                    <span className="text-white font-bold">{total.toFixed(2)} €</span>
                    <span className="text-[#8BA870] text-xs ml-2">({breakdown})</span>
                  </td>
                </tr>) : null; })()}
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Vue mois ─────────────────────────────────────────────────────────────────

export default function DashboardSection() {
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedWeek, setSelectedWeek] = useState<WeekInfo | null>(null);

  useEffect(() => {
    fetchOrders().then(setOrders);
    fetchSuppliers().then(setSuppliers);
  }, []);

  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const monthLabel = `${MONTHS_FR[month]} ${year}`;

  const { year: prevYear, month: prevMonth } = getPrevMonth(year, month);
  const prevFirstDay = new Date(prevYear, prevMonth, 1);
  const prevLastDay = new Date(prevYear, prevMonth + 1, 0);

  const monthStart = fmtDate(new Date(year, month, 1));
  const monthEnd = fmtDate(new Date(year, month + 1, 0));
  const prevMonthStart = fmtDate(prevFirstDay);
  const prevMonthEnd = fmtDate(prevLastDay);

  const monthOrders = inRange(orders, monthStart, monthEnd);
  const prevMonthOrders = inRange(orders, prevMonthStart, prevMonthEnd);

  const curr = { burgers: sumKey(monthOrders, 'burgers_prevus'), frites: sumKey(monthOrders, 'frites_commander'), viande: sumKey(monthOrders, 'viande_total'), buns: sumKey(monthOrders, 'buns_commander') };
  const prev = { burgers: sumKey(prevMonthOrders, 'burgers_prevus'), frites: sumKey(prevMonthOrders, 'frites_commander'), viande: sumKey(prevMonthOrders, 'viande_total'), buns: sumKey(prevMonthOrders, 'buns_commander') };

  const weeks = getWeeksInMonth(year, month);

  const prices = getSupplierPrices(suppliers);

  if (selectedWeek) {
    return <WeekDetail week={selectedWeek} orders={orders} prices={prices} onBack={() => setSelectedWeek(null)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[#1A1209] font-bold text-xl">Dashboard</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => { setMonthOffset(o => o - 1); setSelectedWeek(null); }}
            className="px-3 py-1.5 rounded-lg border border-[#6B7A50] text-[#596643] text-sm hover:bg-[#EDCFDA] transition-colors">←</button>
          <span className="text-[#596643] text-sm font-semibold min-w-28 text-center">{monthLabel}</span>
          <button onClick={() => { setMonthOffset(o => Math.min(0, o + 1)); setSelectedWeek(null); }} disabled={monthOffset === 0}
            className="px-3 py-1.5 rounded-lg border border-[#6B7A50] text-[#596643] text-sm hover:bg-[#EDCFDA] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">→</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Burgers prévus" emoji="🍔" curr={curr.burgers} prev={prev.burgers} prevLabel="Mois préc." />
        <KpiCard label="Frites" emoji="🍟" curr={curr.frites} prev={prev.frites} unit=" kg" prevLabel="Mois préc." />
        <KpiCard label="Viande" emoji="🥩" curr={curr.viande} prev={prev.viande} unit=" kg" prevLabel="Mois préc." />
        <KpiCard label="Buns" emoji="🍞" curr={curr.buns} prev={prev.buns} prevLabel="Mois préc." />
      </div>

      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#6B7A50]">
          <h3 className="text-[#F5EFA0] text-sm font-bold uppercase tracking-widest">Semaines du mois</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="border-b border-[#6B7A50]">
                <th className="text-left py-2 px-3 text-[#8BA870] text-xs font-bold uppercase tracking-wider">Semaine</th>
                <th className="text-center py-2 px-3 text-[#8BA870] text-xs font-bold uppercase tracking-wider">Jours</th>
                <th className="text-center py-2 px-3 text-[#8BA870] text-xs font-bold uppercase tracking-wider">Burgers prévus</th>
                <th className="text-center py-2 px-3 text-[#8BA870] text-xs font-bold uppercase tracking-wider">Frites</th>
                <th className="text-center py-2 px-3 text-[#8BA870] text-xs font-bold uppercase tracking-wider">Viande</th>
                <th className="text-center py-2 px-3 text-[#8BA870] text-xs font-bold uppercase tracking-wider">Buns</th>
                <th className="text-right py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, i) => {
                const wo = inRange(orders, week.start, week.end);
                const hasData = wo.length > 0;
                const isCurrentWeek = fmtDate(new Date()) >= week.start && fmtDate(new Date()) <= week.end;
                return (
                  <tr key={week.start}
                    onClick={() => setSelectedWeek(week)}
                    className={`border-b border-[#6B7A50] cursor-pointer transition-colors hover:bg-[#496035] ${isCurrentWeek ? 'bg-[#FF4D8A]/10' : i % 2 === 0 ? '' : 'bg-[#4D5A39]/30'}`}>
                    <td className="py-3 px-3 text-sm">
                      <span className={`font-medium ${isCurrentWeek ? 'text-[#FF4D8A]' : 'text-[#C8D4B0]'}`}>{week.label}</span>
                      {isCurrentWeek && <span className="ml-2 text-[10px] bg-[#FF4D8A]/20 text-[#FF4D8A] border border-[#FF4D8A]/30 px-1.5 py-0.5 rounded-full font-bold">en cours</span>}
                    </td>
                    <td className="py-3 px-3 text-center text-[#8BA870] text-sm">{wo.filter(o => o.burgers_prevus > 0).length}/7</td>
                    {hasData ? (
                      <>
                        <td className="py-3 px-3 text-center text-white font-bold text-sm">{sumKey(wo, 'burgers_prevus')}</td>
                        <td className="py-3 px-3 text-center text-[#C8D4B0] text-sm">{sumKey(wo, 'frites_commander')} kg</td>
                        <td className="py-3 px-3 text-center text-[#C8D4B0] text-sm">{sumKey(wo, 'viande_total')} kg</td>
                        <td className="py-3 px-3 text-center text-[#C8D4B0] text-sm">{sumKey(wo, 'buns_commander')}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="py-3 px-3 text-center text-[#496035] text-sm italic">Aucune commande</td>
                    )}
                    <td className="py-3 px-3 text-right text-[#8BA870] text-sm">→</td>
                  </tr>
                );
              })}
            </tbody>
            {curr.burgers > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#6B7A50] bg-[#496035]">
                  <td className="py-2.5 px-3 text-[#F5EFA0] text-sm font-bold">Total {MONTHS_FR[month]}</td>
                  <td className="py-2.5 px-3 text-center text-[#8BA870] text-sm">{monthOrders.filter(o => o.burgers_prevus > 0).length}/{new Date(year, month + 1, 0).getDate()}</td>
                  <td className="py-2.5 px-3 text-center text-white font-bold text-sm">{curr.burgers}</td>
                  <td className="py-2.5 px-3 text-center text-white font-bold text-sm">{curr.frites} kg</td>
                  <td className="py-2.5 px-3 text-center text-white font-bold text-sm">{curr.viande} kg</td>
                  <td className="py-2.5 px-3 text-center text-white font-bold text-sm">{curr.buns}</td>
                  <td></td>
                </tr>
                {(() => { const { total, breakdown } = calcCost(monthOrders, prices); return total !== null ? (
                <tr className="bg-[#3D4E2B] border-t border-[#6B7A50]">
                  <td className="py-2 px-3 text-[#F5EFA0] text-xs font-bold">💶 Coût estimé</td>
                  <td colSpan={6} className="py-2 px-3 text-right">
                    <span className="text-white font-bold">{total.toFixed(2)} €</span>
                    <span className="text-[#8BA870] text-xs ml-2">({breakdown})</span>
                  </td>
                </tr>) : null; })()}
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
