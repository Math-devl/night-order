'use client';

import { useEffect, useState } from 'react';
import { ReceptionState } from '@/lib/types';
import { fetchLastOrder, saveReception, fetchTodayReception, DailyOrder } from '@/lib/db';
import { notifyDeliveryDiscrepancy } from '@/lib/push';

interface Props {
  reception: ReceptionState;
  onChange: (field: keyof ReceptionState, value: string) => void;
  onSaved: () => void;
}

interface Ecart {
  frites: number;
  boeuf: number;
  gras: number;
  buns: number;
}

function EcartBadge({ value, unit }: { value: number; unit?: string }) {
  const isNeg = value < 0;
  const isZero = value === 0;
  return (
    <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
      isNeg ? 'bg-red-100 text-red-600' : isZero ? 'bg-[#6B7A50]/20 text-[#6B7A50]' : 'bg-green-100 text-green-600'
    }`}>
      {value > 0 ? '+' : ''}{value}{unit ?? ''}
    </span>
  );
}

function ReceptionRow({
  label,
  commande,
  unit,
  value,
  onChange,
  ecart,
  step = 0.5,
}: {
  label: string;
  commande: number;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  ecart: number | null;
  step?: number;
}) {
  return (
    <div className="py-3 border-b border-[#6B7A50] last:border-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white font-medium">{label}</span>
        <span className="text-[#C8D4B0] text-sm">Commandé : <span className="text-[#F5EFA0] font-bold">{commande}{unit}</span></span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 flex-1">
          <button
            onClick={() => {
              const v = Math.max(0, (parseFloat(value) || 0) - step);
              onChange(String(Math.round(v * 10) / 10));
            }}
            className="text-[#FF4D8A] text-2xl font-bold px-2 py-1"
          >−</button>
          <div className="relative flex-1">
            <input
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="0"
              className="w-full bg-[#FFF0F5] text-[#1A1209] text-center text-xl font-bold rounded-lg py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none pr-8"
            />
            {unit && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8BA870] text-xs pointer-events-none">
                {unit.trim()}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              const v = (parseFloat(value) || 0) + step;
              onChange(String(Math.round(v * 10) / 10));
            }}
            className="text-[#FF4D8A] text-2xl font-bold px-2 py-1"
          >+</button>
        </div>
        {ecart !== null && (
          <EcartBadge value={ecart} unit={unit?.trim()} />
        )}
      </div>
    </div>
  );
}

function Section({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#596643] rounded-2xl p-4 mb-4 border border-[#6B7A50]">
      <h2 className="text-[#F5EFA0] text-sm font-bold uppercase tracking-widest mb-3">
        {emoji} {title}
      </h2>
      {children}
    </div>
  );
}

function todayLabel(): string {
  const now = new Date();
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${days[now.getDay()]} ${dd}/${mm}`;
}

export default function MorningScreen({ reception, onChange, onSaved }: Props) {
  const [lastOrder, setLastOrder] = useState<DailyOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchLastOrder(), fetchTodayReception()]).then(([order, todayRec]) => {
      setLastOrder(order);
      setAlreadyDone(todayRec !== null);
      setLoading(false);
    });
  }, []);

  const ecarts: Ecart | null = lastOrder
    ? {
        frites: Math.round((parseFloat(reception.fritesRecues) || 0) * 10 - lastOrder.frites_commander * 10) / 10,
        boeuf: Math.round(((parseFloat(reception.viandeRecueBoeuf) || 0) - lastOrder.boeuf) * 10) / 10,
        gras: Math.round(((parseFloat(reception.viandeRecueGras) || 0) - lastOrder.gras) * 10) / 10,
        buns: (parseInt(reception.bunsRecus) || 0) - lastOrder.buns_commander,
      }
    : null;

  const hasAlert = ecarts && (ecarts.frites < 0 || ecarts.boeuf < 0 || ecarts.gras < 0 || ecarts.buns < 0);
  const allFilled = reception.fritesRecues !== '' && reception.viandeRecueBoeuf !== '' && reception.viandeRecueGras !== '' && reception.bunsRecus !== '';

  const handleSave = async () => {
    if (!lastOrder) return;
    const boeuf = parseFloat(reception.viandeRecueBoeuf) || 0;
    const gras  = parseFloat(reception.viandeRecueGras)  || 0;
    await saveReception(lastOrder, {
      frites: parseFloat(reception.fritesRecues) || 0,
      boeuf, gras,
      buns: parseInt(reception.bunsRecus) || 0,
    });
    const today = new Date();
    const dateLabel = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}`;
    notifyDeliveryDiscrepancy({
      date: dateLabel,
      fritesCmd: lastOrder.frites_commander, fritesRecues: parseFloat(reception.fritesRecues) || 0,
      boeufCmd: lastOrder.boeuf, boeufRecu: boeuf,
      grasCmd: lastOrder.gras,  grasRecu: gras,
      bunsCmd: lastOrder.buns_commander, bunsRecus: parseInt(reception.bunsRecus) || 0,
    }).catch(() => {});
    setSaved(true);
    setTimeout(onSaved, 2000);
  };

  if (saved || alreadyDone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="text-7xl mb-6">{saved ? '📦' : '✅'}</div>
        <h2 className="text-3xl font-bold text-[#1A1209] mb-2">
          {saved ? 'Réception enregistrée !' : 'Livraison déjà checkée'}
        </h2>
        <p className="text-[#596643]">
          {saved ? 'Les écarts ont été sauvegardés.' : `Livraison du ${todayLabel()} déjà enregistrée.`}
        </p>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="sticky top-0 bg-[#FFF0F5] pt-6 pb-3 px-4 z-10">
        <h1 className="text-2xl font-bold text-[#1A1209]">Livraison du {todayLabel()}</h1>
        {loading && <p className="text-[#C4A8B5] text-sm mt-1">Chargement…</p>}
        {!loading && lastOrder && (
          <p className="text-[#596643] text-sm mt-1 font-medium">
            Commande du {lastOrder.day_name} — {lastOrder.burgers_prevus} burgers prévus
          </p>
        )}
        {!loading && !lastOrder && (
          <p className="text-red-400 text-sm mt-1">Aucune commande trouvée.</p>
        )}
      </div>

      {!loading && lastOrder && (
        <div className="px-4 pt-2">
          {hasAlert && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 flex items-start gap-2">
              <span className="text-red-500 text-lg">⚠️</span>
              <p className="text-red-600 text-sm font-medium">Livraison incomplète — certains écarts sont négatifs.</p>
            </div>
          )}

          <Section title="Frites" emoji="🍟">
            <ReceptionRow
              label="Frites reçues"
              commande={lastOrder.frites_commander}
              unit=" kg"
              value={reception.fritesRecues}
              onChange={(v) => onChange('fritesRecues', v)}
              ecart={ecarts?.frites ?? null}
              step={5}
            />
          </Section>

          <Section title="Viande" emoji="🥩">
            <ReceptionRow
              label="Bœuf reçu"
              commande={lastOrder.boeuf}
              unit=" kg"
              value={reception.viandeRecueBoeuf}
              onChange={(v) => onChange('viandeRecueBoeuf', v)}
              ecart={ecarts?.boeuf ?? null}
            />
            <ReceptionRow
              label="Gras reçu"
              commande={lastOrder.gras}
              unit=" kg"
              value={reception.viandeRecueGras}
              onChange={(v) => onChange('viandeRecueGras', v)}
              ecart={ecarts?.gras ?? null}
            />
          </Section>

          <Section title="Buns" emoji="🍔">
            <ReceptionRow
              label="Buns reçus"
              commande={lastOrder.buns_commander}
              unit=""
              value={reception.bunsRecus}
              onChange={(v) => onChange('bunsRecus', v)}
              ecart={ecarts?.buns ?? null}
              step={1}
            />
          </Section>

          <button
            onClick={handleSave}
            disabled={!allFilled}
            className={`w-full text-white text-xl font-bold py-5 rounded-2xl transition-colors ${
              allFilled
                ? 'bg-[#FF4D8A] active:bg-[#E03070]'
                : 'bg-[#EDCFDA] cursor-not-allowed'
            }`}
          >
            ✓ Enregistrer la réception
          </button>
        </div>
      )}
    </div>
  );
}
