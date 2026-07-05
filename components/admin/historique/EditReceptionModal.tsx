'use client';

import { useState } from 'react';
import { MorningReception } from '@/lib/db';
import { formatDate } from './helpers';

export default function EditReceptionModal({ reception, onSave, onClose }: {
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
