-- Extra bœuf partagé : la valeur saisie sur l'écran Prévision est persistée
-- avec la prévision du jour (même clé date = date de livraison J+1).
alter table daily_forecast
  add column extra_boules_boeuf integer not null default 0;
