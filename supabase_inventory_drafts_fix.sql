-- Correctif revue de code : la suppression d'un employé ne doit pas être
-- bloquée par ses brouillons (updated_by est une trace, pas une dépendance).
alter table inventory_drafts
  drop constraint inventory_drafts_updated_by_fkey;

alter table inventory_drafts
  add constraint inventory_drafts_updated_by_fkey
  foreign key (updated_by) references employees(id) on delete set null;
