create table morning_reception (
  id uuid default gen_random_uuid() primary key,
  date date not null default current_date,
  order_id uuid references daily_orders(id),

  -- Commandé (copié depuis daily_orders)
  frites_commander numeric,
  viande_boeuf_commande numeric,
  viande_gras_commande numeric,
  buns_commander integer,

  -- Reçu (saisi le matin)
  frites_recues numeric,
  viande_recue_boeuf numeric,
  viande_recue_gras numeric,
  buns_recus integer,

  -- Écarts calculés (reçu - commandé)
  ecart_frites numeric,
  ecart_boeuf numeric,
  ecart_gras numeric,
  ecart_buns integer,

  created_at timestamptz default now()
);

alter table morning_reception enable row level security;

create policy "allow all" on morning_reception
  for all using (true) with check (true);
