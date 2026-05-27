export interface InventoryState {
  fritesFraiches: string;
  fritesBlanchies: string;
  boulesRestantes: string;
  pctGras: string;
  bunsRestants: string;
  bunsJeter: string;
  bunsJ2: string;
}

export interface ForecastState {
  burgersPrevus: string;
}

export interface CalculatedOrders {
  fritesABlanchir: number;
  fritesACommander: number;
  viandeTotal: number;
  boeuf: number;
  gras: number;
  bunsACommander: number;
}

export type Screen = 'inventaire' | 'prevision' | 'validation' | 'preparation' | 'livraison' | 'compte';

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  access_code: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export interface ReceptionState {
  fritesRecues: string;
  viandeRecueBoeuf: string;
  viandeRecueGras: string;
  bunsRecus: string;
}

export type Product = 'frites' | 'viande' | 'buns';

export type PriceUnit = 'kg' | 'unite';

export type ContactType = 'whatsapp' | 'whatsapp_group' | 'sms';

export interface Supplier {
  id: string;
  product: Product;
  name: string;
  contact_type: ContactType;
  whatsapp_number: string;
  message_template: string;
  is_active: boolean;
  is_primary: boolean;
  price: number | null;
  price_unit: PriceUnit;
  created_at: string;
  deactivated_at: string | null;
}

export interface Period {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
}

export interface DayMultiplier {
  id: string;
  product: Product;
  period_id: string | null;
  mon: number; tue: number; wed: number; thu: number;
  fri: number; sat: number; sun: number;
}

export interface FixedOrder {
  id: string;
  product: Product;
  is_active: boolean;
  mon: number; tue: number; wed: number; thu: number;
  fri: number; sat: number; sun: number;
}

export interface ProductSettings {
  multiplicateur: number;
  fixedOrder: { is_active: boolean; qty_today: number };
}

export interface AppSettings {
  frites: ProductSettings;
  viande: ProductSettings;
  buns: ProductSettings;
}
