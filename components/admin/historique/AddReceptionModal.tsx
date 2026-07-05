'use client';

import { useState } from 'react';
import { DailyOrder, saveReception } from '@/lib/db';
import { notifyDeliveryDiscrepancy } from '@/lib/push';
import { formatDate } from './helpers';

export default function AddReceptionModal({ order, onSave, onClose }: {
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
