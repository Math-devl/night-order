-- Brouillon d'inventaire partagé : une ligne = l'inventaire en cours pour une date de livraison (J+1)
-- Colonnes en text : on stocke l'état de saisie tel quel (champs vides ≠ 0)
create table inventory_drafts (
  id uuid default gen_random_uuid() primary key,
  date date not null unique,            -- date de LIVRAISON (J+1), comme daily_orders.date
  frites_fraiches text not null default '',
  frites_blanchies text not null default '',
  boules_restantes text not null default '',
  pct_gras text not null default '',
  buns_restants text not null default '',
  buns_jeter text not null default '',
  buns_j2 text not null default '',
  burgers_prevus text not null default '',
  status text not null default 'draft' check (status in ('draft', 'validated')),
  updated_by uuid references employees(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table inventory_drafts enable row level security;

-- Lecture publique ; AUCUNE policy d'écriture : insert/update/delete uniquement via service-role (routes API)
create policy "read all" on inventory_drafts
  for select using (true);
