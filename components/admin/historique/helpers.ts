import { DailyOrder, INVENTORY_COLUMNS, InventoryColumn } from '@/lib/db';
import { localDateStr } from '@/lib/dates';
import { Supplier, Product } from '@/lib/types';

export type Prices = { frites: number | null; viande: number | null; buns: number | null };

export function getSupplierPrices(suppliers: Supplier[]): Prices {
  const get = (product: Product) => {
    const active = suppliers.filter(s => s.product === product && s.is_active);
    return (active.find(s => s.is_primary) ?? active[0])?.price ?? null;
  };
  return { frites: get('frites'), viande: get('viande'), buns: get('buns') };
}

export function calcCost(orders: DailyOrder[], prices: Prices): { total: number | null; breakdown: string } {
  let total = 0; let hasAny = false; const parts: string[] = [];
  const add = (price: number | null, qty: number, label: string) => {
    if (price == null) return;
    const c = price * qty; total += c; hasAny = true;
    parts.push(`${label} ${c.toFixed(0)} €`);
  };
  add(prices.frites, orders.reduce((s, o) => s + o.frites_commander, 0), 'Frites');
  add(prices.viande, orders.reduce((s, o) => s + o.viande_total, 0), 'Viande');
  add(prices.buns, orders.reduce((s, o) => s + o.buns_commander, 0), 'Buns');
  return { total: hasAny ? total : null, breakdown: parts.join(' · ') };
}

export type EditableField = keyof Omit<DailyOrder, 'id' | 'date' | 'day_name' | 'validated_at'>;
export type OrderRow = DailyOrder & { isPlaceholder?: boolean };

const FR_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function buildUpcomingPlaceholders(orders: DailyOrder[]): OrderRow[] {
  const existingDates = new Set(orders.map(o => o.date));
  const placeholders: OrderRow[] = [];
  for (let offset = 0; offset <= 2; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const date = localDateStr(d);
    if (!existingDates.has(date)) {
      placeholders.push({
        id: `placeholder-${date}`, date,
        day_name: FR_DAYS[d.getDay()],
        burgers_prevus: 0, frites_fraiches: 0, frites_blanchies: 0,
        boules_restantes: 0, pct_gras: 26.5, buns_restants: 0,
        frites_blanchir: 0, frites_commander: 0, viande_total: 0,
        boeuf: 0, gras: 0, buns_commander: 0,
        validated_at: '', isPlaceholder: true,
      });
    }
  }
  return placeholders;
}

export const EDITABLE_FIELDS: { key: EditableField; label: string; unit?: string }[] = [
  { key: 'burgers_prevus', label: 'Burgers prévus' },
  { key: 'frites_commander', label: 'Frites à commander', unit: 'kg' },
  { key: 'boeuf', label: 'Bœuf à commander', unit: 'kg' },
  { key: 'gras', label: 'Gras à commander', unit: 'kg' },
  { key: 'buns_commander', label: 'Buns commandés' },
];

// Colonnes inventaire uniquement — jamais les colonnes commande.
// La liste des clés vit dans lib/db.ts (INVENTORY_COLUMNS) ; ici on n'ajoute
// que les libellés d'affichage.
const INVENTORY_LABELS: Record<InventoryColumn, { label: string; unit?: string }> = {
  frites_fraiches:  { label: 'Frites fraîches restantes',  unit: 'kg' },
  frites_blanchies: { label: 'Frites blanchies restantes', unit: 'kg' },
  boules_restantes: { label: 'Boules restantes' },
  pct_gras:         { label: '% masse grasse',             unit: '%' },
  buns_restants:    { label: 'Buns restants' },
};
export const INVENTORY_FIELDS: { key: InventoryColumn; label: string; unit?: string }[] =
  INVENTORY_COLUMNS.map(key => ({ key, ...INVENTORY_LABELS[key] }));

export function groupByMonth(orders: OrderRow[]): Record<string, OrderRow[]> {
  return orders.reduce((acc, o) => {
    const key = o.date.slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {} as Record<string, OrderRow[]>);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export const fmt1 = (n: number) => n.toFixed(1);

export function daysInMonthFromKey(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const hasInventory = (o: DailyOrder) =>
  o.buns_restants > 0 || o.boules_restantes > 0 ||
  parseFloat(String(o.frites_fraiches)) > 0 || parseFloat(String(o.frites_blanchies)) > 0;
