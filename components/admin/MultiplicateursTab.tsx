'use client';

import { useEffect, useState, useCallback } from 'react';
import { DayMultiplier, Period, Product } from '@/lib/types';
import { fetchMultipliers, saveMultiplier, fetchPeriods, upsertPeriod, deletePeriod } from '@/lib/db';

const PRODUCTS: { key: Product; emoji: string }[] = [
  { key: 'frites', emoji: '🍟' },
  { key: 'viande', emoji: '🥩' },
  { key: 'buns', emoji: '🍔' },
];

const DAYS: { key: keyof DayMultiplier; label: string }[] = [
  { key: 'mon', label: 'Lun' },
  { key: 'tue', label: 'Mar' },
  { key: 'wed', label: 'Mer' },
  { key: 'thu', label: 'Jeu' },
  { key: 'fri', label: 'Ven' },
  { key: 'sat', label: 'Sam' },
  { key: 'sun', label: 'Dim' },
];

function isActivePeriod(p: Period): boolean {
  const today = new Date().toISOString().split('T')[0];
  return p.date_start <= today && today <= p.date_end;
}

function MultTable({ periodId, label }: { periodId: string | null; label: string }) {
  const [rows, setRows] = useState<DayMultiplier[]>([]);
  const [dirty, setDirty] = useState<Record<string, Partial<DayMultiplier>>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setRows(await fetchMultipliers(periodId));
    setDirty({});
  }, [periodId]);

  useEffect(() => { load(); }, [load]);

  const handleChange = (product: Product, day: keyof DayMultiplier, value: string) => {
    const row = rows.find(r => r.product === product);
    setDirty(d => ({
      ...d,
      [product]: { ...(d[product] ?? {}), id: row?.id, product, period_id: periodId, [day]: parseFloat(value) || 1 },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(Object.values(dirty).map(r => saveMultiplier(r as DayMultiplier & { product: Product; period_id: string | null })));
    await load();
    setSaving(false);
  };

  const getValue = (product: Product, day: keyof DayMultiplier): string => {
    const fromDirty = dirty[product]?.[day];
    if (fromDirty !== undefined) return String(fromDirty);
    const row = rows.find(r => r.product === product);
    return row ? String(row[day] ?? 1) : '1';
  };

  return (
    <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-4 mb-4">
      <h4 className="text-[#F5EFA0] text-sm font-bold uppercase tracking-widest mb-3">{label}</h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr>
              <th className="text-[#8BA870] text-left py-1 pr-4 text-xs w-20"></th>
              {DAYS.map(d => (
                <th key={d.key} className="text-[#8BA870] text-center py-1 text-xs w-14">{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map(({ key, emoji }) => (
              <tr key={key}>
                <td className="text-white pr-4 py-2 font-medium text-sm">{emoji} {key}</td>
                {DAYS.map(d => (
                  <td key={d.key} className="py-1.5 px-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={getValue(key, d.key)}
                      onChange={e => handleChange(key, d.key, e.target.value)}
                      className={`w-14 text-center rounded-lg py-1.5 text-sm font-bold border focus:outline-none focus:border-[#FF4D8A] ${
                        parseFloat(getValue(key, d.key)) > 1
                          ? 'bg-[#FF4D8A]/10 border-[#FF4D8A]/40 text-[#FF4D8A]'
                          : 'bg-[#FFF0F5] border-[#496035] text-[#1A1209]'
                      }`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {Object.keys(dirty).length > 0 && (
        <button onClick={handleSave} disabled={saving}
          className="mt-3 bg-[#FF4D8A] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#E03070] disabled:opacity-50">
          {saving ? 'Enregistrement…' : '✓ Enregistrer'}
        </button>
      )}
    </div>
  );
}

function PeriodForm({ onSave }: { onSave: () => void }) {
  const [form, setForm] = useState({ name: '', date_start: '', date_end: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.date_start || !form.date_end) return;
    setSaving(true);
    await upsertPeriod(form);
    setForm({ name: '', date_start: '', date_end: '' });
    onSave();
    setSaving(false);
  };

  return (
    <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-4 mb-4">
      <h4 className="text-[#F5EFA0] text-sm font-bold uppercase tracking-widest mb-3">Nouvelle période</h4>
      <div className="flex flex-wrap gap-3">
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="ex: Été 2025"
          className="flex-1 min-w-32 bg-[#FFF0F5] text-[#1A1209] rounded-lg px-3 py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
        <input type="date" value={form.date_start} onChange={e => setForm(f => ({ ...f, date_start: e.target.value }))}
          className="bg-[#FFF0F5] text-[#1A1209] rounded-lg px-3 py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
        <input type="date" value={form.date_end} onChange={e => setForm(f => ({ ...f, date_end: e.target.value }))}
          className="bg-[#FFF0F5] text-[#1A1209] rounded-lg px-3 py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
        <button onClick={handleSave} disabled={saving || !form.name || !form.date_start || !form.date_end}
          className="bg-[#FF4D8A] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#E03070] disabled:opacity-50">
          {saving ? '…' : '+ Créer'}
        </button>
      </div>
    </div>
  );
}

export default function MultiplicateursTab() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    fetchPeriods().then(setPeriods);
  }, [tick]);

  return (
    <div>
      <h3 className="text-[#1A1209] font-bold text-lg mb-2">Multiplicateurs par jour</h3>
      <p className="text-[#C4A8B5] text-sm mb-5">Les valeurs &gt; 1 s'affichent en rose. La période active (si elle couvre aujourd'hui) prend le dessus sur les valeurs par défaut.</p>

      <MultTable periodId={null} label="Par défaut (toute l'année)" />

      <div className="mt-6 mb-4 border-t border-[#EDCFDA] pt-5">
        <h3 className="text-[#1A1209] font-bold text-lg mb-4">Périodes spéciales</h3>
        <PeriodForm onSave={refresh} />
        {periods.map(p => (
          <div key={p.id} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[#1A1209] font-bold text-sm">{p.name}</span>
                <span className="text-[#8BA870] text-xs">{p.date_start} → {p.date_end}</span>
                {isActivePeriod(p) && <span className="text-[10px] bg-green-100 text-green-600 border border-green-200 px-1.5 py-0.5 rounded-full font-bold">Active</span>}
              </div>
              <button onClick={async () => { if (confirm('Supprimer cette période ?')) { await deletePeriod(p.id); refresh(); } }}
                className="text-[#C4A8B5] hover:text-red-400 text-xs px-2 py-1 rounded-lg border border-[#EDCFDA] hover:border-red-200 transition-colors">✕</button>
            </div>
            <MultTable periodId={p.id} label={p.name} />
          </div>
        ))}
      </div>
    </div>
  );
}
