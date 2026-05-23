import { supabase } from './supabase';
import { AppSettings, DayMultiplier, FixedOrder, Product } from './types';
import { todayKey } from './calculations';

export async function fetchAppSettings(): Promise<AppSettings> {
  const today = new Date().toISOString().split('T')[0];
  const dayKey = todayKey();

  // Fetch active period (if any covers today)
  const { data: periods } = await supabase
    .from('periods')
    .select('id')
    .lte('date_start', today)
    .gte('date_end', today)
    .limit(1);

  const activePeriodId = periods?.[0]?.id ?? null;

  // Fetch multipliers: prefer active period, fallback to default (period_id = null)
  const { data: mults } = await supabase
    .from('day_multipliers')
    .select('*')
    .or(activePeriodId
      ? `period_id.eq.${activePeriodId},period_id.is.null`
      : 'period_id.is.null');

  const getMultiplier = (product: Product): number => {
    const byPeriod = (mults as DayMultiplier[] ?? []).find(
      m => m.product === product && m.period_id === activePeriodId
    );
    const byDefault = (mults as DayMultiplier[] ?? []).find(
      m => m.product === product && m.period_id === null
    );
    const row = byPeriod ?? byDefault;
    return row ? (row[dayKey] ?? 1) : 1;
  };

  // Fetch fixed orders
  const { data: fixedRaw } = await supabase.from('fixed_orders').select('*');
  const fixed = (fixedRaw as FixedOrder[] ?? []);

  const getFixed = (product: Product) => {
    const row = fixed.find(f => f.product === product);
    return {
      is_active: row?.is_active ?? false,
      qty_today: row ? (row[dayKey] ?? 0) : 0,
    };
  };

  return {
    frites: { multiplicateur: getMultiplier('frites'), fixedOrder: getFixed('frites') },
    viande: { multiplicateur: getMultiplier('viande'), fixedOrder: getFixed('viande') },
    buns:   { multiplicateur: getMultiplier('buns'),   fixedOrder: getFixed('buns') },
  };
}
