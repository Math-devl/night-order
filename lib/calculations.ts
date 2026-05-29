import { CalculatedOrders, InventoryState, ForecastState, AppSettings } from './types';

function plafond(value: number, multiple: number): number {
  return Math.ceil(value / multiple) * multiple;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function calculate(
  inventory: InventoryState,
  forecast: ForecastState,
  settings?: AppSettings,
  margeFrites = 5
): CalculatedOrders {
  const burgers = parseFloat(forecast.burgersPrevus) || 0;
  const fritesFraiches = parseFloat(inventory.fritesFraiches) || 0;
  const fritesBlanchies = parseFloat(inventory.fritesBlanchies) || 0;
  const boules = parseFloat(inventory.boulesRestantes) || 0;
  const pctGras = parseFloat(inventory.pctGras) || 26.5;
  const buns = parseFloat(inventory.bunsRestants) || 0;

  const multFrites = settings?.frites.multiplicateur ?? 1;
  const multViande = settings?.viande.multiplicateur ?? 1;
  const multBuns = settings?.buns.multiplicateur ?? 1;

  // Frites
  let fritesABlanchir: number;
  let fritesACommander: number;
  if (settings?.frites.fixedOrder.is_active) {
    fritesABlanchir = 0;
    fritesACommander = settings.frites.fixedOrder.qty_today;
  } else {
    const besoinBase = plafond(burgers * 80 / 1500 * 5, 5);
    const besoinCommande = besoinBase * multFrites;
    fritesABlanchir = round(Math.max(0, besoinBase - fritesBlanchies));
    fritesACommander = round(Math.max(0, besoinCommande - fritesBlanchies - fritesFraiches + margeFrites));
  }

  // Viande
  let viandeTotal: number, boeuf: number, gras: number;
  if (settings?.viande.fixedOrder.is_active) {
    viandeTotal = settings.viande.fixedOrder.qty_today;
    boeuf = round(viandeTotal * (1 - pctGras / 100));
    gras = round(viandeTotal * (pctGras / 100));
  } else {
    viandeTotal = round(Math.max(0, (burgers * 2 - boules) * 0.0625) * multViande);
    boeuf = round(viandeTotal * (1 - pctGras / 100));
    gras = round(viandeTotal * (pctGras / 100));
  }

  // Buns
  let bunsACommander: number;
  if (settings?.buns.fixedOrder.is_active) {
    bunsACommander = settings.buns.fixedOrder.qty_today;
  } else {
    bunsACommander = Math.ceil(Math.max(0, burgers - buns) * multBuns);
  }

  return { fritesABlanchir, fritesACommander, viandeTotal, boeuf, gras, bunsACommander };
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayKey = typeof DAY_KEYS[number];

export function todayKey(): DayKey {
  return DAY_KEYS[new Date().getDay()];
}
