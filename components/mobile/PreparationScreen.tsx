'use client';

import { CalculatedOrders } from '@/lib/types';

interface Props {
  orders: CalculatedOrders | null;
  preparationDate?: string | null;
}

function BigStat({ emoji, label, value, unit }: { emoji: string; label: string; value: number; unit: string }) {
  return (
    <div className="bg-[#596643] rounded-2xl p-6 border border-[#6B7A50] text-center">
      <div className="text-4xl mb-3">{emoji}</div>
      <p className="text-[#8BA870] text-xs font-bold uppercase tracking-widest mb-2">{label}</p>
      <p className="text-white text-6xl font-bold mb-1">
        {value > 0 ? value : <span className="text-[#6B7A50]">—</span>}
      </p>
      {value > 0 && <p className="text-[#C8D4B0] text-lg">{unit}</p>}
    </div>
  );
}

function formatFrDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function PreparationScreen({ orders, preparationDate }: Props) {
  const fritesABlanchir = orders?.fritesABlanchir ?? 0;
  const boulesViande = orders ? Math.round(orders.viandeTotal / 0.0625) : 0;

  const subtitle = preparationDate
    ? `Préparation pour le ${formatFrDate(preparationDate)}`
    : 'Pour le service de ce soir';

  return (
    <div className="pb-28 px-4">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[#1A1209]">Préparation</h1>
        <p className="text-[#A0909A] text-sm mt-1">{subtitle}</p>
      </div>

      {!orders || (fritesABlanchir === 0 && boulesViande === 0) ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="text-5xl mb-4">🔪</div>
          <p className="text-[#A0909A]">Aucune commande validée pour ce soir.</p>
          <p className="text-[#C4A8B5] text-sm mt-2">Faites l'inventaire et la prévision d'abord.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <BigStat emoji="🍟" label="Frites à blanchir" value={fritesABlanchir} unit="kg" />
          <BigStat emoji="🥩" label="Boules de bœuf à former" value={boulesViande} unit="boules" />
        </div>
      )}
    </div>
  );
}
