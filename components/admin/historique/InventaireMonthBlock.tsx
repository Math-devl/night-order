'use client';

import { useState } from 'react';
import { DailyOrder } from '@/lib/db';
import { inventaireDateStr } from '@/lib/dates';
import { monthLabel, fmt1, formatDate, hasInventory } from './helpers';

export default function InventaireMonthBlock({ monthKey, orders, onEdit, onAdd }: { monthKey: string; orders: DailyOrder[]; onEdit: (o: DailyOrder) => void; onAdd: () => void }) {
  const [open, setOpen] = useState(true);
  const real = orders.filter(hasInventory);

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#596643] rounded-xl border border-[#6B7A50] hover:bg-[#496035] transition-colors"
      >
        <span className="text-[#F5EFA0] font-bold text-sm uppercase tracking-wider">{monthLabel(monthKey)}</span>
        <div className="flex items-center gap-3">
          <span className="text-[#8BA870] text-xs">{real.length} soir{real.length > 1 ? 's' : ''}</span>
          <span className="text-[#8BA870] text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="mt-1 overflow-x-auto rounded-xl border border-[#6B7A50]">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="bg-[#496035] text-[#8BA870] text-xs uppercase">
                <th className="text-left px-4 py-2.5">Date (soir)</th>
                <th className="text-right px-3 py-2.5">Buns restants</th>
                <th className="text-right px-3 py-2.5">Frites fraîches</th>
                <th className="text-right px-3 py-2.5">Frites blanchies</th>
                <th className="text-right px-3 py-2.5">Boules bœuf</th>
                <th className="text-right px-3 py-2.5">% gras</th>
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
              {real.map((o, i) => (
                <tr key={o.id} className={`border-t border-[#6B7A50] ${i % 2 === 0 ? 'bg-[#596643]' : 'bg-[#4D5A39]'} hover:bg-[#496035] transition-colors`}>
                  <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">{formatDate(inventaireDateStr(o.date))}</td>
                  <td className="px-3 py-2.5 text-right text-[#FF4D8A] font-bold">{o.buns_restants}</td>
                  <td className="px-3 py-2.5 text-right text-white">{fmt1(o.frites_fraiches)} kg</td>
                  <td className="px-3 py-2.5 text-right text-white">{fmt1(o.frites_blanchies)} kg</td>
                  <td className="px-3 py-2.5 text-right text-white">{o.boules_restantes}</td>
                  <td className="px-3 py-2.5 text-right text-[#8BA870]">{fmt1(o.pct_gras)} %</td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end">
                      <button onClick={() => onEdit(o)} className="text-[#C8D4B0] hover:text-[#FF4D8A] text-xs px-2 py-1 rounded-lg border border-[#6B7A50] hover:border-[#FF4D8A]/40 transition-colors">
                        Modifier
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#6B7A50] bg-[#3D4E2B]">
                <td className="px-4 py-2.5 text-[#F5EFA0] text-xs font-bold uppercase tracking-wider">Moy. {monthLabel(monthKey)}</td>
                <td className="px-3 py-2.5 text-right text-[#FF4D8A] font-bold">
                  {real.length ? Math.round(real.reduce((s, o) => s + o.buns_restants, 0) / real.length) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right text-white font-bold">
                  {real.length ? fmt1(real.reduce((s, o) => s + o.frites_fraiches, 0) / real.length) + ' kg' : '—'}
                </td>
                <td className="px-3 py-2.5 text-right text-white font-bold">
                  {real.length ? fmt1(real.reduce((s, o) => s + o.frites_blanchies, 0) / real.length) + ' kg' : '—'}
                </td>
                <td className="px-3 py-2.5 text-right text-white font-bold">
                  {real.length ? Math.round(real.reduce((s, o) => s + o.boules_restantes, 0) / real.length) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right text-[#8BA870] font-bold">
                  {real.length ? fmt1(real.reduce((s, o) => s + o.pct_gras, 0) / real.length) + ' %' : '—'}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
