'use client';

import { useState } from 'react';
import { DailyOrder, MorningReception } from '@/lib/db';
import { monthLabel } from './helpers';
import { exportExcel } from './exportExcel';

export default function ExportModal({ orders, monthKeys, receptionsMap, onClose }: { orders: DailyOrder[]; monthKeys: string[]; receptionsMap: Record<string, MorningReception>; onClose: () => void }) {
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
