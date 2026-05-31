'use client';

import { CalculatedOrders, ForecastState, AppSettings } from '@/lib/types';

interface Props {
  forecast: ForecastState;
  onChange: (field: keyof ForecastState, value: string) => void;
  orders: CalculatedOrders;
  settings?: AppSettings;
  saveStatus?: 'idle' | 'saving' | 'saved';
  onBack: () => void;
  onNext: () => void;
}

function ResultRow({ label, value, unit, highlight, fixed }: { label: string; value: number; unit?: string; highlight?: boolean; fixed?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2 ${highlight ? 'border-b border-[#6B7A50]' : ''}`}>
      <div className="flex items-center gap-1.5">
        <span className="text-[#C8D4B0] text-sm">{label}</span>
        {fixed && <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-400/30 px-1.5 py-0.5 rounded-full">fixe</span>}
      </div>
      <span className={`font-bold text-lg ${value > 0 ? 'text-white' : 'text-[#6B7A50]'}`}>
        {value > 0 ? value : '—'}{unit && value > 0 ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

function ResultCard({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#596643] rounded-2xl p-4 mb-3 border border-[#6B7A50]">
      <h3 className="text-[#F5EFA0] text-sm font-bold uppercase tracking-widest mb-3">{emoji} {title}</h3>
      {children}
    </div>
  );
}

function tomorrowLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${days[d.getDay()]} ${dd}/${mm}`;
}

export default function ForecastScreen({ forecast, onChange, orders, settings, saveStatus, onBack, onNext }: Props) {
  const burgers = parseFloat(forecast.burgersPrevus) || 0;
  const multFrites = settings?.frites.multiplicateur ?? 1;
  const multViande = settings?.viande.multiplicateur ?? 1;
  const multBuns = settings?.buns.multiplicateur ?? 1;
  const hasMultiplier = multFrites > 1 || multViande > 1 || multBuns > 1;
  const fritesFixed = settings?.frites.fixedOrder.is_active ?? false;
  const viandeFixed = settings?.viande.fixedOrder.is_active ?? false;
  const bunsFixed = settings?.buns.fixedOrder.is_active ?? false;

  return (
    <div className="pb-24">
      <div className="sticky top-0 bg-[#FFF0F5] pt-4 pb-4 px-4 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#1A1209]">Prévision — {tomorrowLabel()}</h1>
          {saveStatus === 'saving' && <span className="text-xs text-[#A0909A]">Enregistrement…</span>}
          {saveStatus === 'saved' && <span className="text-xs text-[#596643] font-medium">✓ Sauvegardé</span>}
        </div>
        {hasMultiplier && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <span className="text-red-500 text-sm font-bold">
              ⚠️ Multiplicateurs actifs —{' '}
              {[
                multFrites > 1 && `frites ×${multFrites}`,
                multViande > 1 && `viande ×${multViande}`,
                multBuns > 1 && `buns ×${multBuns}`,
              ].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
      </div>

      <div className="px-4 pt-2">
        <div className="bg-[#596643] rounded-2xl p-5 mb-4 border border-[#6B7A50]">
          <label className="text-[#C8D4B0] text-sm font-medium block mb-3">Nombre de burgers prévus demain</label>
          <div className="flex items-center gap-3">
            <button onClick={() => onChange('burgersPrevus', String(Math.max(0, burgers - 10)))}
              className="shrink-0 text-[#FF4D8A] text-3xl font-bold px-2 py-1">−</button>
            <input
              type="number" inputMode="numeric" value={forecast.burgersPrevus}
              onChange={(e) => onChange('burgersPrevus', e.target.value)}
              placeholder="0"
              className="min-w-0 flex-1 bg-[#FFF0F5] text-[#FF4D8A] placeholder-[#EDCFDA] text-center text-5xl font-bold rounded-2xl py-3 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none"
            />
            <button onClick={() => onChange('burgersPrevus', String(burgers + 10))}
              className="shrink-0 text-[#FF4D8A] text-3xl font-bold px-2 py-1">+</button>
          </div>
          <div className="grid grid-cols-4 mt-3 gap-2">
            {[65, 80, 90, 100, 110, 120, 135, 150].map((n) => (
              <button key={n} onClick={() => onChange('burgersPrevus', String(n))}
                className={`py-2 rounded-xl text-sm font-bold transition-colors ${
                  burgers === n ? 'bg-[#FF4D8A] text-white' : 'bg-[#496035] text-[#C8D4B0] active:bg-[#3D4E2B] border border-[#6B7A50]'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {burgers > 0 && (
          <>
            <ResultCard title="Frites" emoji="🍟">
              <ResultRow label="À commander" value={orders.fritesACommander} unit="kg" fixed={fritesFixed} />
            </ResultCard>
            <ResultCard title="Viande" emoji="🥩">
              <ResultRow label="Total viande" value={orders.viandeTotal} unit="kg" highlight fixed={viandeFixed} />
              <ResultRow label="Bœuf" value={orders.boeuf} unit="kg" highlight />
              <ResultRow label="Gras" value={orders.gras} unit="kg" />
            </ResultCard>
            <ResultCard title="Buns" emoji="🍔">
              <ResultRow label="À commander" value={orders.bunsACommander} fixed={bunsFixed} />
            </ResultCard>
          </>
        )}

        {burgers > 0 && (
          <button onClick={onNext} className="w-full bg-[#FF4D8A] active:bg-[#E03070] text-white text-xl font-bold py-5 rounded-2xl mt-2 transition-colors">
            Voir la commande →
          </button>
        )}
      </div>
    </div>
  );
}
