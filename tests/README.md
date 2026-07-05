# Suites de test bout-en-bout (Playwright)

> ⚠️ **NE JAMAIS LANCER PENDANT LE SERVICE (18 h – 00 h).** Un membre de
> l'équipe peut valider la commande du lendemain à tout moment ; une suite qui
> écrit ou supprime sur J+1 écraserait cette donnée réelle. **Incident du
> 05/07 : un `DELETE` aveugle a effacé une commande validée.** Les garde-fous
> ci-dessous rendent cet accident impossible, mais la règle reste : hors service.

Il n'existe **qu'un seul projet Supabase** (celui de production, via `.env.local`).
Les tests s'exécutent donc sur la **base réelle** : `localhost` protège le code,
jamais les données. D'où le module de garde-fous partagé `test-guard.js`.

## Les 4 suites

| Fichier | Rôle | Cible d'écriture |
|---|---|---|
| `test-guard.js` | Module partagé : connexion DB, dates factices, 4 garde-fous. Aucun test. | — |
| `step4-test.js` | Édition d'un inventaire côté admin : seules les colonnes inventaire changent, aucun recalcul de commande, `morning_reception` intacte. | Ordre **synthétique 2099** créé/édité/supprimé par le test. |
| `f1-test.js` | Ajout/édition d'inventaire admin (`upsertInventoryOnly`) : ligne zéro-commande, doublon → édition, aucune écriture commande/brouillon/prévision. | Dates **factices 2099**. |
| `chantiers-test.js` | Bout-en-bout **flux mobile** : flush beacon, dates serveur à cheval sur minuit, synchro prévision bidirectionnelle, cycle validation → annulation → restauration. | **J+1 serveur RÉEL** (voir avertissement). |

### ⚠️ `chantiers-test.js` écrit sur le J+1 serveur réel

Le flux mobile calcule sa date d'écriture **côté serveur** (J+1) ; aucune
injection de date n'est possible (`page.clock` ne trompe que le client). Cette
suite **ne peut donc pas cibler 2099**. Sa protection est « abort-plutôt-
qu'écraser » : **elle ne doit être lancée que sur un lendemain encore VIERGE**,
hors service. Si une donnée réelle existe déjà sur J+1/J+2, elle **abort** avant
toute écriture (`guardEmpty`), et son nettoyage ne supprime que les lignes
qu'elle a elle-même créées (snapshot-restore).

## Les 4 garde-fous (`test-guard.js`)

1. **`assertFakeDate(date)`** — interdit toute date proche (**aujourd'hui ± 60 j**)
   et impose une date du jeu `FAKE` 2099. Utilisé par les suites à dates
   explicites (step4, f1).
2. **`guardEmpty(db, tables, dates)`** — anti-écrasement : avant toute écriture,
   les dates visées doivent être **vierges** dans chaque table. Sinon → **ABORT**,
   aucune écriture. (C'est ce garde qui aurait empêché l'incident du 05/07.)
3. **`safeDeleteFake(db, tables, dates)`** — suppression **sur dates FAKE 2099
   uniquement** ; refuse toute date hors-FAKE (empêche structurellement un
   `DELETE` sur une date réelle). Pour les dates proches (chantiers),
   `snapshot`/`restoreToSnapshot` ne suppriment que les lignes créées par le test.
4. **`assertNotServiceHours()`** — refus entre **18 h et 00 h**. Contournement
   explicite et journalisé via **`ALLOW_SERVICE=1`**, **réservé au hors-service
   réel** (les écritures 2099 restent sûres à toute heure).

### Constante `FAKE` (dates factices 2099)

```js
const FAKE = {
  SOIR_A: '2099-01-10', LIV_A: '2099-01-11',   // f1 T1 / doublon
  SOIR_B: '2099-02-08', LIV_B: '2099-02-09',   // f1 T2 (ligne J+2 existante)
  SOIR_C: '2099-03-14', LIV_C: '2099-03-15',   // step4 (ordre synthétique)
  SOIR_D: '2099-04-11', LIV_D: '2099-04-12',   // réserve
};
```
L'application ne crée jamais de ligne au-delà de J+2 → **l'année 2099 est vierge
par construction**. Toute paire respecte `livraison = soir + 1`.

## Prérequis d'exécution

- **Variables d'environnement** (lues par `makeDb()` : `process.env` prioritaire,
  sinon `.env.local` à la racine du dépôt — **gitignoré, jamais committé**) :
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` *(uniquement pour générer les fixtures)*

  Aucune valeur n'est copiée ici ni dans les scripts.
- **Fixtures runtime** (gitignorées, générées depuis la base, **contiennent des
  secrets** — codes d'accès, jeton de session admin) :
  - `emps.json` — employés actifs (requis par `chantiers-test.js`)
  - `admin-session.json` — `{ key, session }` d'une session admin Supabase
    (requis par les 3 suites)

  Ces fichiers ne sont **jamais** committés (voir `tests/.gitignore`) et sont à
  supprimer après chaque session de test.
- Serveur de dev lancé (ex. `npm run dev -- -p 3199`) — les suites visent
  `http://localhost:3199`.

## Lancer

```bash
# hors service uniquement ; ALLOW_SERVICE=1 seulement si absolument nécessaire
node tests/step4-test.js
node tests/f1-test.js
node tests/chantiers-test.js   # uniquement sur un lendemain vierge
```
