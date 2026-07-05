// Helpers de dates partagés (client et routes API — fonctions pures).
// Convention du repo : toutes les dates sont locales (jamais UTC).

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// daily_orders.date = date de LIVRAISON (J+1). L'inventaire correspondant a
// été saisi la veille au soir : ces deux fonctions sont le miroir l'une de
// l'autre — toute conversion soir↔livraison vit ici.
export function inventaireDateStr(storedDate: string): string {
  const d = new Date(storedDate + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

export function livraisonDateStr(soirDate: string): string {
  const d = new Date(soirDate + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}
