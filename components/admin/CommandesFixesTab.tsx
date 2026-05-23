'use client';

import { useEffect, useState, useCallback } from 'react';
import { FixedOrder, Product } from '@/lib/types';
import { fetchFixedOrders, saveFixedOrder } from '@/lib/db';

const PRODUCTS: { key: Product; label: string; emoji: string; unit: string }[] = [
  { key: 'frites', label: 'Frites', emoji: '🍟', unit: 'kg' },
  { key: 'viande', label: 'Viande', emoji: '🥩', unit: 'kg' },
  { key: 'buns', label: 'Buns', emoji: '🍔', unit: '' },
];

const DAYS: { key: keyof FixedOrder; label: string; short: string }[] = [
  { key: 'mon', label: 'Lundi', short: 'Lun' },
  { key: 'tue', label: 'Mardi', short: 'Mar' },
  { key: 'wed', label: 'Mercredi', short: 'Mer' },
  { key: 'thu', label: 'Jeudi', short: 'Jeu' },
  { key: 'fri', label: 'Vendredi', short: 'Ven' },
  { key: 'sat', label: 'Samedi', short: 'Sam' },
  { key: 'sun', label: 'Dimanche', short: 'Dim' },
];

function ProductCard({ row, unit, emoji, label, onSave }: {
  row: FixedOrder;
  unit: string;
  emoji: string;
  label: string;
  onSave: () => void;
}) {
  const [local, setLocal] = useState<FixedOrder>(row);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLocal(row); setDirty(false); }, [row]);

  const set = (k: keyof FixedOrder, v: unknown) => {
    setLocal(l => ({ ...l, [k]: v }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveFixedOrder(local);
    onSave();
    setDirty(false);
    setSaving(false);
  };

  return (
    <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[#F5EFA0] text-sm font-bold uppercase tracking-widest">{emoji} {label}</h4>
        <button
          onClick={() => set('is_active', !local.is_active)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors ${
            local.is_active
              ? 'bg-green-500/20 border-green-400/40 text-green-400'
              : 'bg-[#496035] border-[#6B7A50] text-[#8BA870]'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${local.is_active ? 'bg-green-400' : 'bg-[#6B7A50]'}`} />
          {local.is_active ? 'Mode fixe activé' : 'Mode fixe désactivé'}
        </button>
      </div>

      {local.is_active ? (
        <>
          <p className="text-[#C8D4B0] text-xs mb-3">Quantité commandée automatiquement chaque jour, sans calcul depuis le stock.</p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {DAYS.map(d => (
              <div key={d.key} className="flex flex-col items-center gap-1">
                <span className="text-[#8BA870] text-xs font-medium">{d.short}</span>
                <div className="relative w-full">
                  <input
                    type="number"
                    step={unit === 'kg' ? '0.5' : '1'}
                    min="0"
                    value={local[d.key] as number}
                    onChange={e => set(d.key, parseFloat(e.target.value) || 0)}
                    className="w-full text-center rounded-lg py-2 text-sm font-bold bg-[#FFF0F5] text-[#1A1209] border border-[#496035] focus:border-[#FF4D8A] focus:outline-none pr-4"
                  />
                  {unit && <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[#8BA870] text-[10px] pointer-events-none">{unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[#8BA870] text-sm italic">
          Calcul automatique depuis les stocks du soir.
        </p>
      )}

      {dirty && (
        <button onClick={handleSave} disabled={saving}
          className="mt-4 bg-[#FF4D8A] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#E03070] disabled:opacity-50">
          {saving ? 'Enregistrement…' : '✓ Enregistrer'}
        </button>
      )}
    </div>
  );
}

export default function CommandesFixesTab() {
  const [orders, setOrders] = useState<FixedOrder[]>([]);

  const load = useCallback(async () => {
    setOrders(await fetchFixedOrders());
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h3 className="text-[#1A1209] font-bold text-lg mb-2">Commandes récurrentes fixes</h3>
      <p className="text-[#C4A8B5] text-sm mb-5">
        Quand le mode fixe est activé pour un produit, la quantité commandée est celle définie ici (par jour de semaine),
        sans tenir compte du stock saisi le soir. L'inventaire pour ce produit devient optionnel.
      </p>

      {PRODUCTS.map(p => {
        const row = orders.find(o => o.product === p.key);
        if (!row) return null;
        return <ProductCard key={p.key} row={row} unit={p.unit} emoji={p.emoji} label={p.label} onSave={load} />;
      })}
    </div>
  );
}
