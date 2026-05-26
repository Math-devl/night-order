'use client';

import { CalculatedOrders, InventoryState, ForecastState, AppSettings, Supplier, Product, ContactType } from '@/lib/types';
import { saveOrder, fetchSuppliers } from '@/lib/db';
import { useState, useEffect } from 'react';

interface Props {
  inventory: InventoryState;
  forecast: ForecastState;
  orders: CalculatedOrders;
  settings?: AppSettings;
  alreadyDone?: boolean;
  onBack: () => void;
  onValidated: () => void;
}

function OrderBlock({ title, emoji, lines }: { title: string; emoji: string; lines: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="bg-[#596643] rounded-2xl p-4 mb-3 border border-[#6B7A50]">
      <h3 className="text-[#F5EFA0] text-sm font-bold uppercase tracking-widest mb-3">{emoji} {title}</h3>
      {lines.map((l, i) => (
        <div key={i} className={`flex justify-between py-2 ${i < lines.length - 1 ? 'border-b border-[#6B7A50]' : ''}`}>
          <span className="text-[#C8D4B0] text-base">{l.label}</span>
          <div className="text-right">
            <span className="text-white font-bold text-lg">{l.value}</span>
            {l.sub && <p className="text-[#8BA870] text-xs">{l.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function interpolate(template: string, product: Product, orders: CalculatedOrders): string {
  const qty = product === 'frites' ? orders.fritesACommander
    : product === 'viande' ? orders.viandeTotal
    : orders.bunsACommander;
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
  return template
    .replace(/{quantite}/g, String(qty))
    .replace(/{boeuf}/g, String(orders.boeuf))
    .replace(/{gras}/g, String(orders.gras))
    .replace(/{date}/g, dateStr);
}

const CHANNEL_EMOJI: Record<ContactType, string> = {
  whatsapp: '💬',
  whatsapp_group: '👥',
  sms: '📱',
};

const PRODUCT_ORDER: Product[] = ['frites', 'viande', 'buns'];

function hasQty(product: Product, orders: CalculatedOrders): boolean {
  if (product === 'frites') return orders.fritesACommander > 0;
  if (product === 'viande') return orders.viandeTotal > 0;
  return orders.bunsACommander > 0;
}

function MessageCard({ supplierName, contactType, message }: { supplierName: string; contactType: ContactType; message: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white/80 border border-green-200 rounded-2xl p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{CHANNEL_EMOJI[contactType]}</span>
          <span className="text-[#1A1209] font-bold text-sm">{supplierName}</span>
        </div>
        <button
          onClick={copy}
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
            copied
              ? 'bg-green-100 border-green-400 text-green-700'
              : 'bg-white border-green-300 text-green-700 active:bg-green-50'
          }`}
        >
          {copied ? '✓ Copié' : 'Copier'}
        </button>
      </div>
      <p className="text-[#596643] text-sm whitespace-pre-line font-mono leading-relaxed bg-green-50 rounded-xl p-3">
        {message}
      </p>
    </div>
  );
}

export default function ValidationScreen({ inventory, forecast, orders, settings, alreadyDone, onBack, onValidated }: Props) {
  const [validated, setValidated] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showMessages, setShowMessages] = useState(alreadyDone ?? false);

  useEffect(() => { fetchSuppliers().then(setSuppliers).catch(() => {}); }, []);

  const burgers = parseFloat(forecast.burgersPrevus) || 0;
  const multFrites = settings?.frites.multiplicateur ?? 1;
  const multViande = settings?.viande.multiplicateur ?? 1;
  const multBuns = settings?.buns.multiplicateur ?? 1;
  const hasMultiplier = multFrites > 1 || multViande > 1 || multBuns > 1;

  const dayName = () => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[new Date().getDay()];
  };

  const messages = PRODUCT_ORDER.flatMap(product => {
    if (!hasQty(product, orders)) return [];
    return suppliers
      .filter(s => s.product === product && s.is_active)
      .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      .map(s => ({ supplier: s, message: interpolate(s.message_template, product, orders) }));
  });

  const handleValidate = async () => {
    setValidated(true);
    await saveOrder(inventory, forecast, orders, dayName(), parseInt(inventory.bunsJ2) || 0);
    setTimeout(onValidated, 2500);
  };

  if (validated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="text-7xl mb-6">✅</div>
        <h2 className="text-3xl font-bold text-[#1A1209] mb-2">Commande validée !</h2>
        <p className="text-[#596643]">Les commandes ont été enregistrées.</p>
        <p className="text-[#C4A8B5] text-sm mt-4">Réinitialisation en cours…</p>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="sticky top-0 bg-[#FFF0F5] pt-6 pb-4 px-4 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#1A1209]">Récapitulatif</h1>
          <button onClick={onBack} className="text-[#FF4D8A] text-sm font-semibold">← Retour</button>
        </div>
        <p className="text-[#A0909A] text-sm mt-1">
          {dayName()} soir — {burgers} burgers prévus
          {hasMultiplier && <span className="text-red-400 ml-2">(multiplicateurs actifs)</span>}
        </p>
      </div>

      <div className="px-4 pt-2">
        <OrderBlock title="Frites" emoji="🍟" lines={[
          { label: 'À blanchir ce soir', value: `${orders.fritesABlanchir} kg` },
          { label: 'À commander', value: `${orders.fritesACommander} kg` },
        ]} />
        <OrderBlock title="Viande" emoji="🥩" lines={[
          { label: 'Total', value: `${orders.viandeTotal} kg` },
          { label: 'Bœuf', value: `${orders.boeuf} kg`, sub: `${100 - parseFloat(inventory.pctGras)}% bœuf` },
          { label: 'Gras', value: `${orders.gras} kg`, sub: `${inventory.pctGras}% gras` },
        ]} />
        <OrderBlock title="Buns" emoji="🍔" lines={[
          { label: 'En stock ce soir', value: `${inventory.bunsRestants || 0}` },
          ...(parseInt(inventory.bunsJ2) > 0 ? [{ label: 'Commandés pour J+2', value: `${parseInt(inventory.bunsJ2)}` }] : [{ label: 'Commandés pour J+2', value: '—' }]),
        ]} />

        {messages.length > 0 && (
          <>
            <button
              onClick={() => setShowMessages(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-green-50 border border-green-200 rounded-2xl text-green-700 font-semibold text-sm mb-3 active:bg-green-100"
            >
              <span>💬 Messages fournisseurs</span>
              <span className="flex items-center gap-2">
                <span className="text-xs bg-green-200 text-green-700 px-2 py-0.5 rounded-full font-bold">{messages.length}</span>
                <span>{showMessages ? '▲' : '▼'}</span>
              </span>
            </button>

            {showMessages && (
              <div className="mb-4">
                {messages.map(({ supplier, message }) => (
                  <MessageCard
                    key={supplier.id}
                    supplierName={supplier.name}
                    contactType={supplier.contact_type}
                    message={message}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {alreadyDone ? (
          <div className="w-full bg-green-50 border border-green-300 text-green-700 text-xl font-bold py-5 rounded-2xl text-center">
            ✓ Commande déjà validée aujourd'hui
          </div>
        ) : (
          <button
            onClick={handleValidate}
            className="w-full bg-[#FF4D8A] active:bg-[#E03070] text-white text-2xl font-bold py-6 rounded-2xl shadow-md shadow-pink-200 transition-all"
          >
            ✓ VALIDER LA COMMANDE
          </button>
        )}
        <p className="text-[#C4A8B5] text-xs text-center mt-3">
          {alreadyDone ? 'Consultez les messages fournisseurs ci-dessus.' : 'Enregistre la commande et réinitialise le formulaire.'}
        </p>
      </div>
    </div>
  );
}
