-- Table principale : une ligne = une commande validée le soir
create table daily_orders (
  id uuid default gen_random_uuid() primary key,
  date date not null default current_date,
  day_name text,
  burgers_prevus integer not null,

  -- Inventaire saisi
  frites_fraiches numeric,
  frites_blanchies numeric,
  boules_restantes integer,
  pct_gras numeric default 26.5,
  buns_restants integer,

  -- Commandes calculées
  frites_blanchir numeric,
  frites_commander numeric,
  viande_total numeric,
  boeuf numeric,
  gras numeric,
  buns_commander integer,

  created_at timestamptz default now(),
  validated_at timestamptz default now()
);

-- Accès public en lecture/écriture (à affiner avec RLS plus tard)
alter table daily_orders enable row level security;

create policy "allow all" on daily_orders
  for all using (true) with check (true);
