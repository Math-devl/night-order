'use client';

import { useState } from 'react';
import { DailyOrder } from '@/lib/db';
import { localDateStr, livraisonDateStr } from '@/lib/dates';
import InventoryModalBase from './InventoryModalBase';

export default function AddInventoryModal({ onSave, onClose }: { onSave: (dateLivraison: string, u: Partial<DailyOrder>) => Promise<void>; onClose: () => void }) {
  const [soirDate, setSoirDate] = useState(localDateStr(new Date()));
  const [saving, setSaving] = useState(false);

  return (
    <InventoryModalBase
      title="Ajouter un inventaire"
      subtitle="Soir sans inventaire enregistré (oubli, incident)"
      topSlot={
        <div className="flex items-center justify-between gap-4">
          <label className="text-[#C8D4B0] text-sm flex-1">Date du soir</label>
          <input type="date" value={soirDate} onChange={e => setSoirDate(e.target.value)}
            className="w-40 bg-[#FFF0F5] text-[#1A1209] text-right rounded-lg px-3 py-1.5 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
        </div>
      }
      submitLabel={saving ? 'Enregistrement…' : '+ Ajouter'}
      submitDisabled={saving}
      onSubmit={async (values) => {
        if (!soirDate || saving) return;
        setSaving(true);
        await onSave(livraisonDateStr(soirDate), values);
        setSaving(false);
      }}
      onClose={onClose}
    />
  );
}
