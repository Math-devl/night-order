-- Fournisseurs
create table suppliers (
  id uuid default gen_random_uuid() primary key,
  product text not null check (product in ('frites', 'viande', 'buns')),
  name text not null,
  whatsapp_number text not null default '',
  message_template text not null default '',
  is_active boolean default true,
  is_primary boolean default false,
  created_at timestamptz default now(),
  deactivated_at timestamptz
);

alter table suppliers enable row level security;
create policy "allow all" on suppliers for all using (true) with check (true);

-- Templates par défaut
insert into suppliers (product, name, whatsapp_number, message_template, is_active, is_primary) values
('frites', 'Fournisseur frites', '', 'Bonsoir on prendra {quantite} kg de 10/10 pour demain stp.' || chr(10) || 'Merci', true, true),
('viande', 'Fournisseur viande', '', 'Bonsoir on prendra {quantite} kg total :' || chr(10) || '{boeuf} kg de viande' || chr(10) || '{gras} kg de gras,' || chr(10) || 'pour 9h svp' || chr(10) || 'Merci', true, true),
('buns', 'Fournisseur buns', '', 'Bonsoir, on prendra {quantite} buns pour demain,' || chr(10) || 'Merci', true, true);

-- Périodes (ex: Été, Noël...)
create table periods (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  date_start date not null,
  date_end date not null,
  created_at timestamptz default now()
);

alter table periods enable row level security;
create policy "allow all" on periods for all using (true) with check (true);

-- Multiplicateurs par jour (period_id null = valeurs par défaut)
create table day_multipliers (
  id uuid default gen_random_uuid() primary key,
  product text not null check (product in ('frites', 'viande', 'buns')),
  period_id uuid references periods(id) on delete cascade,
  mon numeric default 1,
  tue numeric default 1,
  wed numeric default 1,
  thu numeric default 1,
  fri numeric default 2.5,
  sat numeric default 1,
  sun numeric default 1,
  unique (product, period_id)
);

alter table day_multipliers enable row level security;
create policy "allow all" on day_multipliers for all using (true) with check (true);

-- Valeurs par défaut pour chaque produit
insert into day_multipliers (product, period_id, mon, tue, wed, thu, fri, sat, sun) values
('frites', null, 1, 1, 1, 1, 2.5, 1, 1),
('viande', null, 1, 1, 1, 1, 2.5, 1, 1),
('buns',   null, 1, 1, 1, 1, 2.5, 1, 1);

-- Commandes fixes par produit
create table fixed_orders (
  id uuid default gen_random_uuid() primary key,
  product text not null unique check (product in ('frites', 'viande', 'buns')),
  is_active boolean default false,
  mon numeric default 0,
  tue numeric default 0,
  wed numeric default 0,
  thu numeric default 0,
  fri numeric default 0,
  sat numeric default 0,
  sun numeric default 0
);

alter table fixed_orders enable row level security;
create policy "allow all" on fixed_orders for all using (true) with check (true);

insert into fixed_orders (product) values ('frites'), ('viande'), ('buns');
