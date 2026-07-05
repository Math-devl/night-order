'use client';

import { useState } from 'react';
import { DailyOrder } from '@/lib/db';
import { EDITABLE_FIELDS, formatDate } from './helpers';

export default function EditModal({ order, isPlaceholder, onSave, onClose }: { order: DailyOrder; isPlaceholder?: boolean; onSave: (u: Partial<DailyOrder>) => void; onClose: () => void }) {
  const [values, setValues] = useState<Partial<DailyOrder>>({});

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-white font-bold text-lg mb-1">
          {isPlaceholder ? 'Pré-remplir la commande' : 'Modifier la commande'}
        </h3>
        <p className="text-[#C8D4B0] text-sm mb-4">
          {formatDate(order.date)}
          {isPlaceholder ? ' — à venir, remplis ce que tu veux' : ` — ${order.burgers_prevus} burgers`}
        </p>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {EDITABLE_FIELDS.map(({ key, label, unit }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <label className="text-[#C8D4B0] text-sm flex-1">{label}</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  {...(isPlaceholder ? { placeholder: '—' } : { defaultValue: order[key] as number })}
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
