'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { fetchOrders, updateOrder, deleteOrder, insertPlannedOrder, fetchSuppliers, fetchReceptions, updateReception, verifyReception, syncReceptionCommanded, fetchInventoryDraft, saveDailyForecast, upsertInventoryOnly, DailyOrder, MorningReception, InventoryDraft } from '@/lib/db';
import { localDateStr, inventaireDateStr } from '@/lib/dates';
import { notifyDeliveryDiscrepancy } from '@/lib/push';
import { Supplier } from '@/lib/types';
import { OrderRow, getSupplierPrices, buildUpcomingPlaceholders, groupByMonth, hasInventory, INVENTORY_FIELDS } from './historique/helpers';
import ExportModal from './historique/ExportModal';
import AddOrderModal from './historique/AddOrderModal';
import EditModal from './historique/EditModal';
import EditInventoryModal from './historique/EditInventoryModal';
import AddInventoryModal from './historique/AddInventoryModal';
import EditReceptionModal from './historique/EditReceptionModal';
import AddReceptionModal from './historique/AddReceptionModal';
import ConfirmModal from './historique/ConfirmModal';
import MonthBlock from './historique/MonthBlock';
import InventaireMonthBlock from './historique/InventaireMonthBlock';

export default function HistoriqueSection() {
  const searchParams = useSearchParams();
  const highlightDate = searchParams.get('date') ?? null;

  const [tab, setTab] = useState<'commandes' | 'inventaire'>('commandes');
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receptionsMap, setReceptionsMap] = useState<Record<string, MorningReception>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DailyOrder | null>(null);
  const [editingInventory, setEditingInventory] = useState<DailyOrder | null>(null);
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [todayDraft, setTodayDraft] = useState<InventoryDraft | null>(null);
  const [editingReception, setEditingReception] = useState<MorningReception | null>(null);
  const [addingReception, setAddingReception] = useState<DailyOrder | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const didScrollRef = useRef(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [data, sup] = await Promise.all([fetchOrders(), fetchSuppliers()]);
      setOrders(data);
      setSuppliers(sup);
    } catch {
      setError('Impossible de charger l\'historique. Vérifiez la connexion Supabase.');
      setLoading(false);
      return;
    }
    try {
      const receptions = await fetchReceptions();
      const map: Record<string, MorningReception> = {};
      receptions.forEach(r => { map[r.order_id] = r; });
      setReceptionsMap(map);
    } catch {
      // La table morning_reception n'existe pas encore — on continue sans
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Brouillon du soir (J+1 calculé côté serveur), affiché en lecture seule
    fetchInventoryDraft()
      .then(d => setTodayDraft(d && d.status === 'draft' ? d : null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!highlightDate || loading || didScrollRef.current) return;
    const el = document.querySelector(`[data-date="${highlightDate}"]`);
    if (el) {
      didScrollRef.current = true;
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [highlightDate, loading]);

  const handleEdit = async (updated: Partial<DailyOrder>) => {
    if (!editing) return;
    if (editing.id.startsWith('placeholder-')) {
      const { error: insertErr } = await insertPlannedOrder(editing.date, editing.day_name, {
        burgers_prevus: updated.burgers_prevus,
        frites_commander: updated.frites_commander,
        boeuf: updated.boeuf,
        gras: updated.gras,
        buns_commander: updated.buns_commander,
      });
      if (insertErr) { alert(insertErr); return; }
      // Source de vérité unique : la prévision saisie ici doit être celle
      // que le mobile affiche (daily_forecast)
      if (updated.burgers_prevus != null && updated.burgers_prevus > 0) {
        await saveDailyForecast(updated.burgers_prevus, undefined, editing.date);
      }
      setEditing(null);
      load();
      return;
    }
    const merged = { ...editing, ...updated };
    // Recalculer viande_total si boeuf ou gras ont changé
    if (updated.boeuf !== undefined || updated.gras !== undefined) {
      updated.viande_total = Math.round((merged.boeuf + merged.gras) * 1000) / 1000;
    }
    await updateOrder(editing.id, updated);
    // Prévision modifiée sur une commande à venir → même synchro que le pré-remplissage
    if (updated.burgers_prevus != null && updated.burgers_prevus > 0 && editing.date >= localDateStr(new Date())) {
      await saveDailyForecast(updated.burgers_prevus, undefined, editing.date);
    }
    // Resynchroniser les quantités commandées dans la réception si elle existe
    const reception = receptionsMap[editing.id];
    if (reception) {
      await syncReceptionCommanded(reception, {
        frites_commander: merged.frites_commander,
        boeuf: merged.boeuf,
        gras: merged.gras,
        buns_commander: merged.buns_commander,
      });
    }
    setEditing(null);
    load();
  };

  const handleEditInventory = async (updated: Partial<DailyOrder>) => {
    if (!editingInventory) return;
    // Correction de donnée pure : colonnes inventaire uniquement, aucun recalcul
    // de commande, pas de syncReceptionCommanded, morning_reception intacte.
    const inventoryOnly: Partial<DailyOrder> = {};
    for (const { key } of INVENTORY_FIELDS) {
      if (updated[key] !== undefined) (inventoryOnly as Record<string, number>)[key] = updated[key] as number;
    }
    if (Object.keys(inventoryOnly).length > 0) {
      const { error: updErr } = await updateOrder(editingInventory.id, inventoryOnly);
      if (updErr) { alert('Erreur lors de la modification : ' + updErr); return; }
    }
    setEditingInventory(null);
    load();
  };

  const handleAddInventory = async (dateLivraison: string, values: Partial<DailyOrder>) => {
    // Un inventaire existe déjà pour ce soir → on ouvre l'édition, pas de doublon
    const existing = orders.find(o => o.date === dateLivraison);
    if (existing && hasInventory(existing)) {
      setShowAddInventory(false);
      setEditingInventory(existing);
      return;
    }
    const { error } = await upsertInventoryOnly(dateLivraison, values);
    if (error) { alert('Erreur lors de l\'ajout : ' + error); return; }
    setShowAddInventory(false);
    load();
  };

  const handleEditReception = async (values: { frites_recues: number; viande_recue_boeuf: number; viande_recue_gras: number; buns_recus: number }) => {
    if (!editingReception) return;
    await updateReception(editingReception.id, values, editingReception);
    const d = new Date(editingReception.date + 'T00:00:00');
    const dateLabel = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    notifyDeliveryDiscrepancy({
      date: dateLabel,
      isoDate: editingReception.date,
      fritesCmd: editingReception.frites_commander, fritesRecues: values.frites_recues,
      boeufCmd: editingReception.viande_boeuf_commande, boeufRecu: values.viande_recue_boeuf,
      grasCmd: editingReception.viande_gras_commande,  grasRecu: values.viande_recue_gras,
      bunsCmd: editingReception.buns_commander, bunsRecus: values.buns_recus,
    }).catch(() => {});
    setEditingReception(null);
    load();
  };

  const handleAddReception = async () => {
    setAddingReception(null);
    load();
  };

  const handleVerifyReception = async (id: string) => {
    await verifyReception(id);
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteOrder(id);
    if (error) { alert('Erreur lors de la suppression : ' + error); return; }
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const allRows: OrderRow[] = [...buildUpcomingPlaceholders(orders), ...orders]
    .sort((a, b) => b.date.localeCompare(a.date));
  const grouped = groupByMonth(allRows);
  const monthKeys = Object.keys(grouped).sort().reverse();

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[#1A1209]">Historique</h2>
          <p className="text-[#C4A8B5] text-sm mt-0.5">{orders.length} commandes</p>
        </div>
        {tab === 'commandes' && (
          <button
            onClick={() => setShowExport(true)}
            className="shrink-0 flex items-center gap-2 bg-[#596643] hover:bg-[#496035] border border-[#6B7A50] text-[#C8D4B0] hover:text-white px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            ↓ <span className="hidden sm:inline">Export </span>Excel
          </button>
        )}
      </div>

      <div className="flex gap-1 bg-[#3D4E2B] p-1 rounded-xl mb-4">
        <button
          onClick={() => setTab('commandes')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
            tab === 'commandes' ? 'bg-[#596643] text-white shadow-sm' : 'text-[#8BA870] hover:text-white'
          }`}
        >
          Commandes
        </button>
        <button
          onClick={() => setTab('inventaire')}
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
            tab === 'inventaire' ? 'bg-[#596643] text-white shadow-sm' : 'text-[#8BA870] hover:text-white'
          }`}
        >
          Inventaire
        </button>
      </div>

      {loading && <div className="text-center py-16 text-[#C4A8B5]">Chargement…</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-500 text-sm mb-4">{error}</div>
      )}

      {tab === 'commandes' && (<>
        {monthKeys.map((key) => (
          <MonthBlock key={key} monthKey={key} orders={grouped[key]} prices={getSupplierPrices(suppliers)} receptionsMap={receptionsMap} highlightDate={highlightDate} onEdit={setEditing} onDelete={(id) => setConfirmDelete(id)} onEditReception={setEditingReception} onAddReception={setAddingReception} onVerifyReception={handleVerifyReception} onAdd={() => setShowAdd(true)} />
        ))}
        {!loading && !error && orders.length === 0 && allRows.length === 0 && (
          <div className="text-center py-16 text-[#C4A8B5]">
            <p className="text-4xl mb-3">📋</p>
            <p>Aucune commande enregistrée pour l'instant.</p>
            <p className="text-xs mt-2">Les commandes validées sur mobile apparaîtront ici.</p>
          </div>
        )}
      </>)}

      {tab === 'inventaire' && (<>
        {todayDraft && (
          <div className="mb-4 bg-[#596643] rounded-xl border border-[#FF4D8A]/40 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] bg-[#FF4D8A]/20 text-[#FF4D8A] border border-[#FF4D8A]/40 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">● En cours</span>
              <span className="text-[#F5EFA0] text-sm font-bold">Inventaire de ce soir</span>
              <span className="text-[#8BA870] text-xs">brouillon partagé — modifiable depuis /mobile</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span className="text-[#C8D4B0]">Frites fraîches : <span className="text-white font-bold">{todayDraft.frites_fraiches || '—'}{todayDraft.frites_fraiches ? ' kg' : ''}</span></span>
              <span className="text-[#C8D4B0]">Frites blanchies : <span className="text-white font-bold">{todayDraft.frites_blanchies || '—'}{todayDraft.frites_blanchies ? ' kg' : ''}</span></span>
              <span className="text-[#C8D4B0]">Boules : <span className="text-white font-bold">{todayDraft.boules_restantes || '—'}</span></span>
              <span className="text-[#C8D4B0]">% gras : <span className="text-white font-bold">{todayDraft.pct_gras || '—'}</span></span>
              <span className="text-[#C8D4B0]">Buns : <span className="text-white font-bold">{todayDraft.buns_restants || '—'}</span></span>
            </div>
          </div>
        )}
        {(() => {
          const invOrders = orders.filter(hasInventory);
          const invGrouped = invOrders.reduce((acc, o) => {
            const key = inventaireDateStr(o.date).slice(0, 7);
            if (!acc[key]) acc[key] = [];
            acc[key].push(o);
            return acc;
          }, {} as Record<string, DailyOrder[]>);
          const invMonthKeys = Object.keys(invGrouped).sort().reverse();
          if (!loading && invMonthKeys.length === 0) return (
            <div className="text-center py-16 text-[#C4A8B5]">
              <p className="text-4xl mb-3">📦</p>
              <p>Aucun inventaire enregistré pour l'instant.</p>
            </div>
          );
          return invMonthKeys.map(key => (
            <InventaireMonthBlock key={key} monthKey={key} orders={invGrouped[key]} onEdit={setEditingInventory} onAdd={() => setShowAddInventory(true)} />
          ));
        })()}
      </>)}

      {editing && <EditModal order={editing} isPlaceholder={editing.id.startsWith('placeholder-')} onSave={handleEdit} onClose={() => setEditing(null)} />}
      {editingInventory && <EditInventoryModal order={editingInventory} onSave={handleEditInventory} onClose={() => setEditingInventory(null)} />}
      {showAddInventory && <AddInventoryModal onSave={handleAddInventory} onClose={() => setShowAddInventory(false)} />}
      {editingReception && <EditReceptionModal reception={editingReception} onSave={handleEditReception} onClose={() => setEditingReception(null)} />}
      {addingReception && <AddReceptionModal order={addingReception} onSave={handleAddReception} onClose={() => setAddingReception(null)} />}
      {showExport && <ExportModal orders={orders} monthKeys={monthKeys} receptionsMap={receptionsMap} onClose={() => setShowExport(false)} />}
      {showAdd && <AddOrderModal onSave={() => { setShowAdd(false); load(); }} onClose={() => setShowAdd(false)} />}
      {confirmDelete && (
        <ConfirmModal
          message="Supprimer cette commande ?"
          onConfirm={() => { handleDelete(confirmDelete); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
