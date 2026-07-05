'use client';

import { useState } from 'react';
import { insertManualOrder } from '@/lib/db';
import { localDateStr } from '@/lib/dates';

export default function AddOrderModal({ onSave, onClose }: { onSave: () => void; onClose: () => void }) {
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
