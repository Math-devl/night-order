'use client';

import { useEffect, useState, useCallback } from 'react';
import { Supplier, Product, PriceUnit, ContactType } from '@/lib/types';
import { fetchSuppliers, upsertSupplier, toggleSupplier, deleteSupplier, fetchFixedOrders, saveFixedOrder } from '@/lib/db';
import { FixedOrder } from '@/lib/types';

const PRODUCTS: { key: Product; label: string; emoji: string }[] = [
  { key: 'frites', label: 'Frites', emoji: '🍟' },
  { key: 'viande', label: 'Viande', emoji: '🥩' },
  { key: 'buns', label: 'Buns', emoji: '🍔' },
];

const CONTACT_TYPES: { key: ContactType; label: string; emoji: string; placeholder: string; hint: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', emoji: '💬', placeholder: '+33612345678', hint: 'Numéro au format international' },
  { key: 'whatsapp_group', label: 'Groupe WA', emoji: '👥', placeholder: 'https://chat.whatsapp.com/...', hint: 'Lien d\'invitation du groupe' },
  { key: 'sms', label: 'SMS', emoji: '📱', placeholder: '+33612345678', hint: 'Numéro au format international' },
];

const VARIABLES = ['{quantite}', '{boeuf}', '{gras}', '{date}'];

const DEFAULT_TEMPLATES: Record<Product, string> = {
  frites: 'Bonsoir on prendra {quantite} kg de 10/10 pour demain stp.\nMerci',
  viande: 'Bonsoir on prendra {quantite} kg total :\n{boeuf} kg de viande\n{gras} kg de gras,\npour 9h svp\nMerci',
  buns: 'Bonsoir, on prendra {quantite} buns pour demain,\nMerci',
};

function SupplierModal({ initial, onSave, onClose }: {
  initial: Partial<Supplier> & { product: Product };
  onSave: () => void;
  onClose: () => void;
}) {
  const [product, setProduct] = useState<Product>(initial.product);
  const [name, setName] = useState(initial.name ?? '');
  const [contactType, setContactType] = useState<ContactType>(initial.contact_type ?? 'whatsapp');
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp_number ?? '');
  const [template, setTemplate] = useState(initial.message_template ?? DEFAULT_TEMPLATES[initial.product]);
  const [isPrimary, setIsPrimary] = useState(initial.is_primary ?? false);
  const [isActive, setIsActive] = useState(initial.is_active ?? true);
  const [price, setPrice] = useState(initial.price != null ? String(initial.price) : '');
  const [priceUnit, setPriceUnit] = useState<PriceUnit>(initial.price_unit ?? 'kg');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProductChange = (p: Product) => {
    setProduct(p);
    if (!initial.id) setTemplate(DEFAULT_TEMPLATES[p]);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Le nom est obligatoire.'); return; }
    setSaving(true);
    setError(null);
    const payload: Partial<Supplier> & { product: Product } = {
      ...(initial.id ? { id: initial.id } : {}),
      product,
      name: name.trim(),
      contact_type: contactType,
      whatsapp_number: whatsapp.trim(),
      message_template: template,
      is_primary: isPrimary,
      is_active: isActive,
      price: price !== '' ? parseFloat(price) : null,
      price_unit: priceUnit,
    };
    const { error: err } = await upsertSupplier(payload);
    if (err) { setError(err); setSaving(false); return; }
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-white font-bold text-lg mb-4">{initial.id ? 'Modifier' : 'Ajouter'} un fournisseur</h3>

        {error && <div className="bg-red-100 border border-red-300 text-red-600 text-sm rounded-xl px-3 py-2 mb-4">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1">Produit</label>
            <div className="flex gap-2">
              {PRODUCTS.map(p => (
                <button key={p.key} onClick={() => handleProductChange(p.key)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${product === p.key ? 'bg-[#FF4D8A] text-white border-[#FF4D8A]' : 'bg-[#496035] text-[#C8D4B0] border-[#6B7A50]'}`}>
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1">Nom</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: Aviko, Metro..."
              className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-lg px-3 py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
          </div>

          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1">Canal de contact</label>
            <div className="flex gap-2">
              {CONTACT_TYPES.map(c => (
                <button key={c.key} onClick={() => setContactType(c.key)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${contactType === c.key ? 'bg-[#FF4D8A] text-white border-[#FF4D8A]' : 'bg-[#496035] text-[#C8D4B0] border-[#6B7A50]'}`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            {(() => {
              const ct = CONTACT_TYPES.find(c => c.key === contactType)!;
              const label = contactType === 'whatsapp' ? 'Numéro WhatsApp'
                : contactType === 'whatsapp_group' ? 'Lien du groupe WhatsApp'
                : 'Numéro de téléphone';
              return (
                <>
                  <label className="text-[#C8D4B0] text-sm block mb-1">{label}</label>
                  <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder={ct.placeholder}
                    className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-lg px-3 py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
                  <p className="text-[#8BA870] text-xs mt-1">{ct.hint}</p>
                </>
              );
            })()}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[#C8D4B0] text-sm">Template de message</label>
              <div className="flex gap-1 flex-wrap">
                {VARIABLES.map(v => (
                  <button key={v} onClick={() => setTemplate(t => t + v)}
                    className="text-[#FF4D8A] text-xs px-1.5 py-0.5 bg-[#496035] rounded border border-[#6B7A50] hover:bg-[#3D4E2B]">
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={5}
              className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-lg px-3 py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm font-mono resize-none" />
          </div>

          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1">Prix</label>
            <div className="flex gap-2">
              <input
                type="number" step="0.01" min="0" value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="ex: 1.20"
                className="flex-1 bg-[#FFF0F5] text-[#1A1209] rounded-lg px-3 py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
              />
              <div className="flex rounded-lg overflow-hidden border border-[#496035]">
                {(['kg', 'unite'] as PriceUnit[]).map(u => (
                  <button key={u} onClick={() => setPriceUnit(u)}
                    className={`px-3 py-2 text-sm font-bold transition-colors ${priceUnit === u ? 'bg-[#FF4D8A] text-white' : 'bg-[#496035] text-[#C8D4B0]'}`}>
                    {u === 'kg' ? '/ kg' : '/ unité'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="accent-[#FF4D8A]" />
              <span className="text-[#C8D4B0] text-sm">Principal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-[#FF4D8A]" />
              <span className="text-[#C8D4B0] text-sm">Actif</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#6B7A50] text-[#C8D4B0] text-sm hover:bg-[#496035]">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#FF4D8A] text-white text-sm font-bold hover:bg-[#E03070] disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SupplierCard({ s, fixedOrder, rank, onEdit, onRefresh }: { s: Supplier; fixedOrder?: FixedOrder; rank: number; onEdit: (s: Supplier) => void; onRefresh: () => void }) {
  const isFixed = fixedOrder?.is_active ?? false;
  const channelEmoji = s.contact_type === 'whatsapp' ? '💬' : s.contact_type === 'whatsapp_group' ? '👥' : '📱';

  return (
    <div className={`border rounded-xl p-4 mb-2 ${s.is_active ? 'bg-[#596643] border-[#6B7A50]' : 'bg-[#3D4E2B] border-[#496035] opacity-60'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-white font-bold text-sm">{s.name}</span>
            {s.is_primary
              ? <span className="text-[10px] bg-[#FF4D8A]/20 text-[#FF4D8A] border border-[#FF4D8A]/30 px-1.5 py-0.5 rounded-full font-bold">Principal</span>
              : <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-1.5 py-0.5 rounded-full font-bold">Backup {rank}</span>
            }
            {!s.is_active && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-400/30 px-1.5 py-0.5 rounded-full font-bold">Inactif</span>}
            {isFixed && <span className="text-[10px] bg-green-500/20 text-green-400 border border-green-400/30 px-1.5 py-0.5 rounded-full font-bold">Mode fixe</span>}
          </div>
          {s.whatsapp_number && (
            <p className="text-[#8BA870] text-xs mb-1">{channelEmoji} {s.whatsapp_number}</p>
          )}
          {s.price != null && <p className="text-[#F5EFA0] text-xs mb-1 font-bold">💶 {s.price} € / {s.price_unit === 'kg' ? 'kg' : 'unité'}</p>}
          <p className="text-[#C8D4B0] text-xs font-mono whitespace-pre-line line-clamp-2">{s.message_template}</p>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button onClick={() => onEdit(s)} className="text-xs px-2.5 py-1 rounded-lg border border-[#6B7A50] text-[#C8D4B0] hover:text-white transition-colors">Modifier</button>
          <button onClick={async () => { await toggleSupplier(s.id, !s.is_active); onRefresh(); }}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${s.is_active ? 'border-red-400/40 text-red-400' : 'border-green-400/40 text-green-400'}`}>
            {s.is_active ? 'Désactiver' : 'Activer'}
          </button>
          {fixedOrder && (
            <button onClick={async () => { await saveFixedOrder({ id: fixedOrder.id, is_active: !isFixed }); onRefresh(); }}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${isFixed ? 'border-orange-400/40 text-orange-400' : 'border-green-400/40 text-green-400'}`}>
              {isFixed ? 'Désactiver mode fixe' : 'Activer mode fixe'}
            </button>
          )}
          <button onClick={async () => { if (confirm('Supprimer ?')) { await deleteSupplier(s.id); onRefresh(); } }}
            className="text-xs px-2.5 py-1 rounded-lg border border-[#6B7A50] text-[#8BA870] hover:text-red-400 transition-colors">✕</button>
        </div>
      </div>
    </div>
  );
}

export default function FournisseursTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [fixedOrders, setFixedOrders] = useState<Record<Product, FixedOrder>>({} as Record<Product, FixedOrder>);
  const [modal, setModal] = useState<(Partial<Supplier> & { product: Product }) | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    fetchSuppliers().then(setSuppliers);
    fetchFixedOrders().then(rows => {
      const map = {} as Record<Product, FixedOrder>;
      rows.forEach(r => { map[r.product as Product] = r; });
      setFixedOrders(map);
    });
  }, [tick]);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[#1A1209] font-bold text-lg">Fournisseurs</h3>
        <button onClick={() => setModal({ product: 'frites' })}
          className="bg-[#FF4D8A] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#E03070]">
          + Ajouter
        </button>
      </div>

      {PRODUCTS.map(({ key, label, emoji }) => {
        const list = suppliers.filter(s => s.product === key);
        const activeCount = list.filter(s => s.is_active).length;
        let backupRank = 0;

        return (
          <div key={key} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h4 className="text-[#6B7A50] text-xs font-bold uppercase tracking-widest">{emoji} {label}</h4>
                {activeCount > 1 && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-400/30 px-1.5 py-0.5 rounded-full font-bold">
                    {activeCount} destinataires
                  </span>
                )}
              </div>
              <button
                onClick={() => setModal({ product: key, is_primary: false, is_active: true })}
                className="text-xs px-2.5 py-1 rounded-lg border border-[#6B7A50] text-blue-300 hover:bg-[#496035] transition-colors"
              >
                + Backup
              </button>
            </div>

            {list.length === 0 ? (
              <p className="text-[#C4A8B5] text-sm italic px-2">Aucun fournisseur —{' '}
                <button onClick={() => setModal({ product: key })} className="text-[#FF4D8A] underline">Ajouter</button>
              </p>
            ) : (
              <>
                {list
                  .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
                  .map(s => {
                    if (!s.is_primary) backupRank++;
                    return (
                      <SupplierCard
                        key={s.id}
                        s={s}
                        fixedOrder={fixedOrders[key]}
                        rank={backupRank}
                        onEdit={setModal}
                        onRefresh={refresh}
                      />
                    );
                  })}
                {activeCount > 1 && (
                  <p className="text-[#8BA870] text-xs px-2 mt-1">
                    📨 Le message sera envoyé aux {activeCount} contacts actifs simultanément.
                  </p>
                )}
              </>
            )}
          </div>
        );
      })}

      {modal && (
        <SupplierModal
          initial={modal}
          onSave={() => { setModal(null); refresh(); }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
