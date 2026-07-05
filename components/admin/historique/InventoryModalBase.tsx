'use client';

import { useState } from 'react';
import { DailyOrder } from '@/lib/db';
import { INVENTORY_FIELDS } from './helpers';

// Coquille commune aux modales inventaire (édition / ajout) : mêmes champs
// (liste blanche INVENTORY_FIELDS), même note « correction pure », mêmes
// boutons. Les variantes n'apportent que leurs différences : valeurs par
// défaut (édition) vs placeholders (ajout), slot date, libellé du bouton.
interface Props {
  title: string;
  subtitle: string;
  topSlot?: React.ReactNode;
  defaults?: DailyOrder;
  submitLabel: string;
  submitDisabled?: boolean;
  onSubmit: (values: Partial<DailyOrder>) => void;
  onClose: () => void;
}

export default function InventoryModalBase({ title, subtitle, topSlot, defaults, submitLabel, submitDisabled, onSubmit, onClose }: Props) {
  const [values, setValues] = useState<Partial<DailyOrder>>({});

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-white font-bold text-lg mb-1">{title}</h3>
        <p className="text-[#C8D4B0] text-sm mb-4">{subtitle}</p>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {topSlot}
          {INVENTORY_FIELDS.map(({ key, label, unit }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <label className="text-[#C8D4B0] text-sm flex-1">{label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  {...(defaults
                    ? { defaultValue: defaults[key] as number }
                    : { placeholder: key === 'pct_gras' ? '26.5' : '—' })}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setValues((v) => {
                      const next = { ...v };
                      if (raw === '') delete next[key];
                      else next[key] = parseFloat(raw);
                      return next;
                    });
                  }}
                  className="w-24 bg-[#FFF0F5] text-[#1A1209] text-right rounded-lg px-3 py-1.5 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
                />
                {unit && <span className="text-[#8BA870] text-xs w-6">{unit}</span>}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[#8BA870] text-xs mt-4 mb-1">
          ℹ️ Correction de donnée pure : la commande et les livraisons de ce soir-là ne sont pas recalculées.
        </p>

        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#6B7A50] text-[#C8D4B0] text-sm font-medium hover:bg-[#496035]">
            Annuler
          </button>
          <button
            onClick={() => onSubmit(values)}
            disabled={submitDisabled}
            className={`flex-1 py-2.5 rounded-xl bg-[#FF4D8A] text-white text-sm font-bold hover:bg-[#E03070]${submitDisabled !== undefined ? ' disabled:opacity-50 transition-colors' : ''}`}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
