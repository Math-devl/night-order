import { supabase } from './supabase';
import { InventoryState, ForecastState, CalculatedOrders, Supplier, Period, DayMultiplier, FixedOrder, Product, Employee } from './types';

export interface DailyOrder {
  id: string;
  date: string;
  day_name: string;
  burgers_prevus: number;
  frites_fraiches: number;
  frites_blanchies: number;
  boules_restantes: number;
  pct_gras: number;
  buns_restants: number;
  frites_blanchir: number;
  frites_commander: number;
  viande_total: number;
  boeuf: number;
  gras: number;
  buns_commander: number;
  validated_at: string;
}

const FR_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function saveOrder(
  inventory: InventoryState,
  forecast: ForecastState,
  orders: CalculatedOrders,
  _dayName: string,
  bunsJ2: number = 0
): Promise<{ error: string | null }> {
  // La commande passée le soir de J est enregistrée à J+1 (jour de livraison)
  const delivery = new Date();
  delivery.setDate(delivery.getDate() + 1);
  const deliveryDate = localDateStr(delivery);
  const deliveryDayName = FR_DAYS[delivery.getDay()];

  // Si une ligne pré-commande existe pour J+1 (ex: buns pré-commandés), on la met à jour
  const { data: existing } = await supabase
    .from('daily_orders').select('id, buns_commander').eq('date', deliveryDate).maybeSingle();

  const orderData = {
    date: deliveryDate,
    day_name: deliveryDayName,
    burgers_prevus: parseInt(forecast.burgersPrevus),
    frites_fraiches: parseFloat(inventory.fritesFraiches) || 0,
    frites_blanchies: parseFloat(inventory.fritesBlanchies) || 0,
    boules_restantes: parseInt(inventory.boulesRestantes) || 0,
    pct_gras: parseFloat(inventory.pctGras) || 26.5,
    buns_restants: parseInt(inventory.bunsRestants) || 0,
    frites_blanchir: orders.fritesABlanchir,
    frites_commander: orders.fritesACommander,
    viande_total: orders.viandeTotal,
    boeuf: orders.boeuf,
    gras: orders.gras,
    // Les buns se commandent toujours en J+2 — si la ligne J+1 avait déjà des buns pré-commandés, on préserve
    buns_commander: existing?.buns_commander ?? 0,
    validated_at: new Date().toISOString(),
  };

  const { error } = existing
    ? await supabase.from('daily_orders').update(orderData).eq('id', existing.id)
    : await supabase.from('daily_orders').insert(orderData);

  if (error) return { error: error.message };

  // Pré-commande J+2
  if (bunsJ2 > 0) {
    const j2 = new Date();
    j2.setDate(j2.getDate() + 2);
    const j2Date = localDateStr(j2);
    const j2Day = FR_DAYS[j2.getDay()];

    const { data: j2Existing } = await supabase
      .from('daily_orders').select('id, burgers_prevus').eq('date', j2Date).maybeSingle();

    if (!j2Existing) {
      await supabase.from('daily_orders').insert({
        date: j2Date, day_name: j2Day,
        burgers_prevus: 0, frites_fraiches: 0, frites_blanchies: 0,
        boules_restantes: 0, pct_gras: 26.5, buns_restants: 0,
        frites_blanchir: 0, frites_commander: 0, viande_total: 0,
        boeuf: 0, gras: 0, buns_commander: bunsJ2,
        validated_at: new Date().toISOString(),
      });
    } else if (j2Existing.burgers_prevus === 0) {
      // Mise à jour d'une pré-commande existante (pas encore validée)
      await supabase.from('daily_orders').update({ buns_commander: bunsJ2 }).eq('id', j2Existing.id);
    }
  }

  return { error: null };
}

export async function fetchOrders(): Promise<DailyOrder[]> {
  const { data, error } = await supabase
    .from('daily_orders')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateOrder(
  id: string,
  fields: Partial<DailyOrder>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('daily_orders')
    .update(fields)
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteOrder(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('daily_orders').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function insertManualOrder(data: {
  date: string;
  burgers_prevus: number;
  frites_commander: number;
  viande_total: number;
  boeuf: number;
  gras: number;
  buns_commander: number;
}): Promise<{ error: string | null }> {
  const d = new Date(data.date + 'T00:00:00');
  const pctGras = data.viande_total > 0 ? Math.round(data.gras / data.viande_total * 1000) / 10 : 26.5;
  const { error } = await supabase.from('daily_orders').insert({
    ...data,
    day_name: FR_DAYS[d.getDay()],
    frites_fraiches: 0, frites_blanchies: 0, boules_restantes: 0,
    pct_gras: pctGras, buns_restants: 0, frites_blanchir: 0,
    validated_at: new Date().toISOString(),
  });
  return { error: error?.message ?? null };
}

export async function fetchLastOrder(): Promise<DailyOrder | null> {
  const { data, error } = await supabase
    .from('daily_orders')
    .select('*')
    .order('validated_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

export interface MorningReception {
  id: string;
  date: string;
  order_id: string;
  frites_commander: number;
  viande_boeuf_commande: number;
  viande_gras_commande: number;
  buns_commander: number;
  frites_recues: number;
  viande_recue_boeuf: number;
  viande_recue_gras: number;
  buns_recus: number;
  ecart_frites: number;
  ecart_boeuf: number;
  ecart_gras: number;
  ecart_buns: number;
}

export async function saveReception(
  order: DailyOrder,
  received: { frites: number; boeuf: number; gras: number; buns: number }
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('morning_reception').insert({
    date: localDateStr(new Date()),
    order_id: order.id,
    frites_commander: order.frites_commander,
    viande_boeuf_commande: order.boeuf,
    viande_gras_commande: order.gras,
    buns_commander: order.buns_commander,
    frites_recues: received.frites,
    viande_recue_boeuf: received.boeuf,
    viande_recue_gras: received.gras,
    buns_recus: received.buns,
    ecart_frites: received.frites - order.frites_commander,
    ecart_boeuf: received.boeuf - order.boeuf,
    ecart_gras: received.gras - order.gras,
    ecart_buns: received.buns - order.buns_commander,
  });
  return { error: error?.message ?? null };
}

export async function updateReception(
  id: string,
  received: { frites_recues: number; viande_recue_boeuf: number; viande_recue_gras: number; buns_recus: number },
  r: MorningReception
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('morning_reception').update({
    ...received,
    ecart_frites: Math.round((received.frites_recues - r.frites_commander) * 10) / 10,
    ecart_boeuf: Math.round((received.viande_recue_boeuf - r.viande_boeuf_commande) * 10) / 10,
    ecart_gras: Math.round((received.viande_recue_gras - r.viande_gras_commande) * 10) / 10,
    ecart_buns: received.buns_recus - r.buns_commander,
  }).eq('id', id);
  return { error: error?.message ?? null };
}

export async function fetchReceptions(): Promise<MorningReception[]> {
  const { data, error } = await supabase
    .from('morning_reception')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchTodayReception(): Promise<MorningReception | null> {
  const today = localDateStr(new Date());
  const { data } = await supabase
    .from('morning_reception')
    .select('*')
    .eq('date', today)
    .maybeSingle();
  return data ?? null;
}

export async function hasTodayInventoryBeenDone(): Promise<boolean> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = localDateStr(tomorrow);
  const { data } = await supabase
    .from('daily_orders')
    .select('id')
    .eq('date', tomorrowDate)
    .gt('burgers_prevus', 0)
    .maybeSingle();
  return data !== null;
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

export async function fetchSuppliers(): Promise<Supplier[]> {
  const { data } = await supabase.from('suppliers').select('*').order('product').order('is_primary', { ascending: false });
  return (data ?? []) as Supplier[];
}

export async function upsertSupplier(s: Partial<Supplier> & { product: Product }): Promise<{ error: string | null }> {
  const { error } = s.id
    ? await supabase.from('suppliers').update(s).eq('id', s.id)
    : await supabase.from('suppliers').insert(s);
  return { error: error?.message ?? null };
}

export async function toggleSupplier(id: string, is_active: boolean): Promise<void> {
  await supabase.from('suppliers').update({ is_active, deactivated_at: is_active ? null : new Date().toISOString() }).eq('id', id);
}

export async function deleteSupplier(id: string): Promise<void> {
  await supabase.from('suppliers').delete().eq('id', id);
}

// ─── Periods ─────────────────────────────────────────────────────────────────

export async function fetchPeriods(): Promise<Period[]> {
  const { data } = await supabase.from('periods').select('*').order('date_start', { ascending: false });
  return (data ?? []) as Period[];
}

export async function upsertPeriod(p: Partial<Period>): Promise<{ id: string; error: string | null }> {
  if (p.id) {
    const { error } = await supabase.from('periods').update(p).eq('id', p.id);
    return { id: p.id, error: error?.message ?? null };
  }
  const { data, error } = await supabase.from('periods').insert(p).select('id').single();
  return { id: data?.id ?? '', error: error?.message ?? null };
}

export async function deletePeriod(id: string): Promise<void> {
  await supabase.from('periods').delete().eq('id', id);
}

// ─── Day multipliers ──────────────────────────────────────────────────────────

export async function fetchMultipliers(periodId: string | null): Promise<DayMultiplier[]> {
  const q = supabase.from('day_multipliers').select('*');
  const { data } = periodId ? await q.eq('period_id', periodId) : await q.is('period_id', null);
  return (data ?? []) as DayMultiplier[];
}

export async function saveMultiplier(row: Partial<DayMultiplier> & { product: Product; period_id: string | null }): Promise<void> {
  if (row.id) {
    await supabase.from('day_multipliers').update(row).eq('id', row.id);
  } else {
    await supabase.from('day_multipliers').insert(row);
  }
}

// ─── Fixed orders ─────────────────────────────────────────────────────────────

export async function fetchFixedOrders(): Promise<FixedOrder[]> {
  const { data } = await supabase.from('fixed_orders').select('*');
  return (data ?? []) as FixedOrder[];
}

export async function saveFixedOrder(row: Partial<FixedOrder> & { id: string }): Promise<void> {
  await supabase.from('fixed_orders').update(row).eq('id', row.id);
}

// ─── Employees ────────────────────────────────────────────────────────────────

export async function fetchEmployees(): Promise<Employee[]> {
  const { data } = await supabase.from('employees').select('*').order('last_name');
  return (data ?? []) as Employee[];
}

export async function upsertEmployee(e: Partial<Employee>): Promise<{ error: string | null }> {
  const { error } = e.id
    ? await supabase.from('employees').update(e).eq('id', e.id)
    : await supabase.from('employees').insert(e);
  return { error: error?.message ?? null };
}

export async function deleteEmployee(id: string): Promise<void> {
  await supabase.from('employees').delete().eq('id', id);
}

export async function verifyCode(code: string): Promise<Employee | null> {
  const { data } = await supabase
    .from('employees')
    .select('*')
    .eq('access_code', code)
    .eq('is_active', true)
    .maybeSingle();
  return data ?? null;
}

export async function updateEmployeeCode(id: string, newCode: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('employees').update({ access_code: newCode }).eq('id', id);
  return { error: error?.message ?? null };
}
