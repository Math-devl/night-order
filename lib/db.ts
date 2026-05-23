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

export async function saveOrder(
  inventory: InventoryState,
  forecast: ForecastState,
  orders: CalculatedOrders,
  dayName: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('daily_orders').insert({
    date: new Date().toISOString().split('T')[0],
    day_name: dayName,
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
    buns_commander: orders.bunsACommander,
    validated_at: new Date().toISOString(),
  });
  return { error: error?.message ?? null };
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
    date: new Date().toISOString().split('T')[0],
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

export async function fetchReceptions(): Promise<MorningReception[]> {
  const { data, error } = await supabase
    .from('morning_reception')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
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
