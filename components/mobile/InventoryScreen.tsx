'use client';

import { InventoryState } from '@/lib/types';

interface Props {
  inventory: InventoryState;
  onChange: (field: keyof InventoryState, value: string) => void;
  onNext: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  fixedFrites?: boolean;
  fixedViande?: boolean;
  fixedBuns?: boolean;
}

function NumInput({
  label, value, onChange, unit, step = '0.5', min = '0', max,
}: {
  label: string; value: string; onChange: (v: string) => void;
  unit?: string; step?: string; min?: string; max?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#6B7A50] last:border-0">
      <label className="text-white text-base font-medium flex-1">{label}</label>
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            const v = Math.max(parseFloat(min), (parseFloat(value) || 0) - parseFloat(step));
            onChange(String(Math.round(v * 10) / 10));
          }}
          className="text-[#FF4D8A] text-2xl font-bold px-2 py-1"
        >−</button>
        <div className="relative">
          <input
            type="number" inputMode="decimal" min={min} max={max} step={step} value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-24 bg-[#FFF0F5] text-[#1A1209] text-center text-lg font-bold rounded-lg py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none pr-6"
          />
          {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8BA870] text-xs pointer-events-none">{unit}</span>}
        </div>
        <button
          onClick={() => {
            const current = parseFloat(value) || 0;
            const next = current + parseFloat(step);
            const capped = max !== undefined ? Math.min(parseFloat(max), next) : next;
            onChange(String(Math.round(capped * 10) / 10));
          }}
          className="text-[#FF4D8A] text-2xl font-bold px-2 py-1"
        >+</button>
      </div>
    </div>
  );
}

function Section({ title, emoji, children, fixed }: { title: string; emoji: string; children: React.ReactNode; fixed?: boolean }) {
  return (
    <div className="bg-[#596643] rounded-2xl p-4 mb-4 border border-[#6B7A50]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[#F5EFA0] text-sm font-bold uppercase tracking-widest">{emoji} {title}</h2>
        {fixed && <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-400/30 px-2 py-0.5 rounded-full font-bold">Mode fixe</span>}
      </div>
      {children}
    </div>
  );
}

function FixedBadge() {
  return <p className="text-[#8BA870] text-sm italic py-1">Commande fixe activée — saisie optionnelle.</p>;
}

function formatDate(): string {
  const now = new Date();
  const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  const day = days[now.getDay()];
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${day} ${dd}/${mm}`;
}

export default function InventoryScreen({ inventory, onChange, onNext, saveStatus, fixedFrites, fixedViande, fixedBuns }: Props) {
  const requiredFields = [
    !fixedFrites && inventory.fritesFraiches,
    !fixedFrites && inventory.fritesBlanchies,
    !fixedViande && inventory.boulesRestantes,
    !fixedBuns && inventory.bunsRestants,
  ].filter(v => v !== false);

  const filled = requiredFields.filter(v => v !== '').length;
  const total = requiredFields.length;

  return (
    <div className="pb-24">
      <div className="sticky top-0 bg-[#FFF0F5] pt-6 pb-3 px-4 z-10">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-[#1A1209]">Inventaire du soir</h1>
          <div className="flex items-baseline gap-2">
            {saveStatus === 'saving' && <span className="text-xs text-[#A0909A]">Enregistrement…</span>}
            {saveStatus === 'saved' && <span className="text-xs text-[#596643] font-medium">✓ Sauvegardé</span>}
            {saveStatus === 'error' && <span className="text-xs text-red-500 font-medium">⚠️ Non enregistré</span>}
            <span className="text-[#FF4D8A] text-sm font-semibold">{formatDate()}</span>
          </div>
        </div>
        {total > 0 && (
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 h-2 bg-[#EDCFDA] rounded-full overflow-hidden">
              <div className="h-full bg-[#FF4D8A] rounded-full transition-all" style={{ width: `${(filled / total) * 100}%` }} />
            </div>
            <span className="text-[#C4A8B5] text-sm">{filled}/{total} renseignés</span>
          </div>
        )}
      </div>

      <div className="px-4 pt-2">
        <Section title="Frites" emoji="🍟" fixed={fixedFrites}>
          {fixedFrites ? <FixedBadge /> : (
            <>
              <NumInput label="Frites fraîches restantes" value={inventory.fritesFraiches} onChange={v => onChange('fritesFraiches', v)} unit="kg" step="5" />
              <NumInput label="Frites blanchies restantes" value={inventory.fritesBlanchies} onChange={v => onChange('fritesBlanchies', v)} unit="kg" step="5" />
            </>
          )}
        </Section>

        <Section title="Viande" emoji="🥩" fixed={fixedViande}>
          {fixedViande ? <FixedBadge /> : (
            <NumInput label="Boules restantes" value={inventory.boulesRestantes} onChange={v => onChange('boulesRestantes', v)} step="1" />
          )}
          <NumInput label="% masse grasse" value={inventory.pctGras} onChange={v => onChange('pctGras', v)} unit="%" step="0.5" min="20" max="35" />
        </Section>

        <Section title="Buns" emoji="🍔" fixed={fixedBuns}>
          {fixedBuns ? <FixedBadge /> : (
            <NumInput label="Buns restants" value={inventory.bunsRestants} onChange={v => onChange('bunsRestants', v)} step="1" />
          )}
          <NumInput label="Buns commandés pour J+2" value={inventory.bunsJ2} onChange={v => onChange('bunsJ2', v)} step="1" />
        </Section>

        <button onClick={onNext} className="w-full bg-[#FF4D8A] active:bg-[#E03070] text-white text-xl font-bold py-5 rounded-2xl transition-colors">
          Continuer →
        </button>
      </div>
    </div>
  );
}
