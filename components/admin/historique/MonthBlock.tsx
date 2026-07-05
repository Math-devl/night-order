'use client';

import { useState, Fragment } from 'react';
import { DailyOrder, MorningReception } from '@/lib/db';
import { OrderRow, Prices, calcCost, monthLabel, fmt1, daysInMonthFromKey, formatDate } from './helpers';

function EcartChip({ value, unit = '' }: { value: number; unit?: string }) {
  const isNeg = value < 0;
  const isZero = value === 0;
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
      isNeg ? 'bg-red-500/20 text-red-400' : isZero ? 'bg-[#6B7A50]/30 text-[#8BA870]' : 'bg-green-500/20 text-green-400'
    }`}>
      {value > 0 ? '+' : ''}{value}{unit}
    </span>
  );
}

function ReceptionPanel({ r, onEdit, onVerify }: { r: MorningReception; onEdit: () => void; onVerify: () => void }) {
  const rows = [
    { label: 'Frites', cmd: r.frites_commander, recu: r.frites_recues, ecart: r.ecart_frites, unit: ' kg' },
    { label: 'Bœuf',  cmd: r.viande_boeuf_commande, recu: r.viande_recue_boeuf, ecart: r.ecart_boeuf, unit: ' kg' },
    { label: 'Gras',  cmd: r.viande_gras_commande,  recu: r.viande_recue_gras,  ecart: r.ecart_gras,  unit: ' kg' },
    { label: 'Buns',  cmd: r.buns_commander, recu: r.buns_recus, ecart: r.ecart_buns, unit: '' },
  ];
  return (
    <tr>
      <td colSpan={6} className="px-4 pb-3 pt-0 bg-[#3D4E2B]">
        <div className="rounded-xl border border-[#6B7A50] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#2E3D1F] text-[#8BA870]">
                <th className="text-left px-3 py-1.5 font-bold uppercase tracking-wider">📦 Livraison reçue</th>
                <th className="text-right px-3 py-1.5">Commandé</th>
                <th className="text-right px-3 py-1.5">Reçu</th>
                <th className="text-right px-3 py-1.5">Écart</th>
                <th className="px-3 py-1.5">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={onEdit} className="text-[#8BA870] hover:text-[#FF4D8A] border border-[#6B7A50] hover:border-[#FF4D8A]/40 px-2 py-0.5 rounded-md transition-colors">
                      Modifier
                    </button>
                    {!r.is_verified && (
                      <button onClick={onVerify} className="text-green-400 hover:text-green-300 border border-green-600/50 hover:border-green-400 px-2 py-0.5 rounded-md transition-colors font-bold">
                        ✓ Vérifier
                      </button>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className="border-t border-[#496035]">
                  <td className="px-3 py-1.5 text-[#C8D4B0] font-medium">{row.label}</td>
                  <td className="px-3 py-1.5 text-right text-[#8BA870]">{row.cmd}{row.unit}</td>
                  <td className="px-3 py-1.5 text-right text-white font-bold">{row.recu}{row.unit}</td>
                  <td className="px-3 py-1.5 text-right"><EcartChip value={row.ecart} unit={row.unit} /></td>
                  <td></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

export default function MonthBlock({ monthKey, orders, prices, receptionsMap, onEdit, onDelete, onEditReception, onAddReception, onVerifyReception, onAdd, highlightDate }: {
  monthKey: string;
  orders: OrderRow[];
  prices: Prices;
  receptionsMap: Record<string, MorningReception>;
  highlightDate?: string | null;
  onEdit: (o: DailyOrder) => void;
  onDelete: (id: string) => void;
  onEditReception: (r: MorningReception) => void;
  onAddReception: (o: DailyOrder) => void;
  onVerifyReception: (id: string) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [expandedReception, setExpandedReception] = useState<string | null>(null);

  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-[#596643] rounded-xl border border-[#6B7A50] hover:bg-[#496035] transition-colors"
      >
        <span className="text-[#F5EFA0] font-bold text-sm uppercase tracking-wider">{monthLabel(monthKey)}</span>
        <div className="flex items-center gap-3">
          <span className="text-[#8BA870] text-xs">{orders.filter(o => !o.isPlaceholder && o.burgers_prevus > 0).length}/{daysInMonthFromKey(monthKey)} jours</span>
          <span className="text-[#8BA870] text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="mt-1 overflow-x-auto rounded-xl border border-[#6B7A50]">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="bg-[#496035] text-[#8BA870] text-xs uppercase">
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-right px-3 py-2.5">Burgers prévus</th>
                <th className="text-right px-3 py-2.5">Frites cmd</th>
                <th className="text-right px-3 py-2.5">Viande</th>
                <th className="text-right px-3 py-2.5">Buns</th>
                <th className="px-3 py-2.5 text-right">
                  <button
                    onClick={onAdd}
                    className="bg-[#FF4D8A] hover:bg-[#E03070] text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-colors normal-case tracking-normal"
                  >
                    + Ajouter
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o, i) => {
                const reception = receptionsMap[o.id];
                const isExpanded = expandedReception === o.id;
                return (
                  <Fragment key={o.id}>
                    <tr data-date={o.date} className={`border-t border-[#6B7A50] ${'isPlaceholder' in o && o.isPlaceholder ? 'bg-[#3D4E2B]/60 opacity-60' : highlightDate === o.date ? 'bg-[#FF4D8A]/20 border-l-4 border-l-[#FF4D8A]' : i % 2 === 0 ? 'bg-[#596643]' : 'bg-[#4D5A39]'} hover:bg-[#496035] transition-colors`}>
                      <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {formatDate(o.date)}
                          {'isPlaceholder' in o && o.isPlaceholder && (
                            <span className="text-[10px] bg-[#6B7A50]/40 text-[#8BA870] border border-[#6B7A50] px-1.5 py-0.5 rounded-full font-bold">
                              À venir
                            </span>
                          )}
                          {reception ? (
                            <button
                              onClick={() => setExpandedReception(isExpanded ? null : o.id)}
                              title={reception.is_verified ? 'Livraison vérifiée' : 'Voir la livraison reçue'}
                              className={`text-xs px-1.5 py-0.5 rounded-md border transition-colors ${
                                isExpanded
                                  ? 'bg-[#F5EFA0]/20 border-[#F5EFA0]/50 text-[#F5EFA0]'
                                  : 'border-[#6B7A50] text-[#8BA870] hover:text-[#F5EFA0] hover:border-[#F5EFA0]/50'
                              }`}
                            >
                              {reception.is_verified ? '✅' : '📦'}
                            </button>
                          ) : (!('isPlaceholder' in o && o.isPlaceholder) && o.burgers_prevus > 0 && (
                            <button
                              onClick={() => onAddReception(o)}
                              title="Saisir la livraison reçue"
                              className="text-xs px-1.5 py-0.5 rounded-md border border-dashed border-[#6B7A50]/60 text-[#6B7A50] hover:border-[#8BA870] hover:text-[#8BA870] transition-colors"
                            >
                              📦
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#FF4D8A] font-bold">
                        {o.burgers_prevus === 0 ? <span className="text-[#6B7A50]">—</span> : o.burgers_prevus}
                      </td>
                      <td className="px-3 py-2.5 text-right text-white">
                        {o.burgers_prevus === 0 ? <span className="text-[#6B7A50]">—</span> : `${fmt1(o.frites_commander)} kg`}
                      </td>
                      <td className="px-3 py-2.5 text-right text-white">
                        {o.burgers_prevus === 0 ? <span className="text-[#6B7A50]">—</span> : `${fmt1(o.viande_total)} kg`}
                      </td>
                      <td className="px-3 py-2.5 text-right text-white">{o.buns_commander}</td>
                      <td className="px-3 py-2.5">
                        {'isPlaceholder' in o && o.isPlaceholder ? (
                          <div className="flex justify-end">
                            <button onClick={() => onEdit(o)} className="text-[#C8D4B0] hover:text-[#FF4D8A] text-xs px-2 py-1 rounded-lg border border-dashed border-[#6B7A50] hover:border-[#FF4D8A]/40 transition-colors">
                              Modifier
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => onEdit(o)} className="text-[#C8D4B0] hover:text-[#FF4D8A] text-xs px-2 py-1 rounded-lg border border-[#6B7A50] hover:border-[#FF4D8A]/40 transition-colors">
                              Modifier
                            </button>
                            <button onClick={() => onDelete(o.id)} className="text-[#8BA870] hover:text-red-400 text-xs px-2 py-1 rounded-lg border border-[#6B7A50] hover:border-red-400/40 transition-colors" title="Supprimer">
                              ✕
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {isExpanded && reception && <ReceptionPanel r={reception} onEdit={() => onEditReception(reception)} onVerify={() => onVerifyReception(reception.id)} />}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              {(() => {
                const real = orders.filter(o => !('isPlaceholder' in o && o.isPlaceholder));
                const { total, breakdown } = calcCost(real, prices);
                return (<>
              <tr className="border-t-2 border-[#6B7A50] bg-[#3D4E2B]">
                <td className="px-4 py-2.5 text-[#F5EFA0] text-xs font-bold uppercase tracking-wider">Total {monthLabel(monthKey)}</td>
                <td className="px-3 py-2.5 text-right text-[#FF4D8A] font-bold">{real.reduce((s, o) => s + o.burgers_prevus, 0)}</td>
                <td className="px-3 py-2.5 text-right text-white font-bold">{fmt1(real.reduce((s, o) => s + o.frites_commander, 0))} kg</td>
                <td className="px-3 py-2.5 text-right text-white font-bold">{fmt1(real.reduce((s, o) => s + o.viande_total, 0))} kg</td>
                <td className="px-3 py-2.5 text-right text-white font-bold">{real.reduce((s, o) => s + o.buns_commander, 0)}</td>
                <td></td>
              </tr>
              {total !== null ? (
              <tr className="bg-[#2E3D1F] border-t border-[#6B7A50]">
                <td className="px-4 py-2 text-[#F5EFA0] text-xs font-bold">💶 Coût estimé</td>
                <td colSpan={4} className="px-3 py-2 text-right">
                  <span className="text-white font-bold">{total.toFixed(2)} €</span>
                  <span className="text-[#8BA870] text-xs ml-2">({breakdown})</span>
                </td>
                <td></td>
              </tr>) : null}
              </>);
              })()}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
