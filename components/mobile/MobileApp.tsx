'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { InventoryState, ForecastState, ReceptionState, Screen, AppSettings, CalculatedOrders } from '@/lib/types';
import { calculate } from '@/lib/calculations';
import { fetchAppSettings } from '@/lib/settings';
import { hasTodayInventoryBeenDone, hasTodayDeliveryPending, fetchLastOrder, verifyEmployee, fetchDailyForecast, saveDailyForecastBoth, fetchInventoryDraft, saveInventoryDraft, InventoryDraft } from '@/lib/db';
import { getSession, setSession as persistSession, clearSession, EmployeeSession } from '@/lib/auth';
import { registerPushSubscription } from '@/lib/push';
import BottomNav from './BottomNav';
import CommandeSteps from './CommandeSteps';
import InventoryScreen from './InventoryScreen';
import ForecastScreen from './ForecastScreen';
import ValidationScreen from './ValidationScreen';
import PreparationScreen from './PreparationScreen';
import MorningScreen from './MorningScreen';
import LoginScreen from './LoginScreen';
import CompteScreen from './CompteScreen';

const defaultInventory: InventoryState = {
  fritesFraiches: '', fritesBlanchies: '', boulesRestantes: '',
  pctGras: '26.5', bunsRestants: '', bunsJeter: '', bunsJ2: '',
};
const defaultForecast: ForecastState = { burgersPrevus: '', extraBoulesBoeuf: '' };
const defaultReception: ReceptionState = { fritesRecues: '', viandeRecueBoeuf: '', viandeRecueGras: '', bunsRecus: '' };

const COMMANDE_SCREENS: Screen[] = ['inventaire', 'prevision', 'validation'];

export default function MobileApp() {
  const [session, setSession] = useState<EmployeeSession | null | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>('inventaire');
  const [inventory, setInventory] = useState<InventoryState>(defaultInventory);
  const [forecast, setForecast] = useState<ForecastState>(defaultForecast);
  const [reception, setReception] = useState<ReceptionState>(defaultReception);
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined);
  const [inventoryDone, setInventoryDone] = useState(false);
  const [lastValidatedOrders, setLastValidatedOrders] = useState<CalculatedOrders | null>(null);
  const [lastValidatedForecast, setLastValidatedForecast] = useState<ForecastState>(defaultForecast);
  const [preparationDate, setPreparationDate] = useState<string | null>(null);
  const [forecastSaveStatus, setForecastSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draftSaveStatus, setDraftSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedBadgeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSavedBadgeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Garde-fous brouillon : pas d'écriture avant la fin de l'hydratation,
  // pas d'hydratation par-dessus une saisie déjà commencée
  const draftHydratedRef = useRef(false);
  const inventoryTouchedRef = useRef(false);
  // Brouillon figé par la validation : plus aucune écriture draft (débounce ou
  // flush) ne doit repartir tant que l'annulation ne l'a pas rouvert
  const draftValidatedRef = useRef(false);
  const inventoryRef = useRef(inventory);
  const forecastRef = useRef(forecast);
  const sessionRef = useRef(session);

  useEffect(() => { inventoryRef.current = inventory; }, [inventory]);
  useEffect(() => { forecastRef.current = forecast; }, [forecast]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const scheduleDraftSave = () => {
    setDraftSaveStatus('saving');
    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = setTimeout(async () => {
      draftSaveTimeoutRef.current = null;
      const { error } = await saveInventoryDraft(inventoryRef.current, forecastRef.current.burgersPrevus, sessionRef.current?.id);
      if (error) {
        setDraftSaveStatus('error');
        return;
      }
      setDraftSaveStatus('saved');
      if (draftSavedBadgeRef.current) clearTimeout(draftSavedBadgeRef.current);
      draftSavedBadgeRef.current = setTimeout(() => setDraftSaveStatus('idle'), 2000);
    }, 800);
  };

  // Beacon d'abord (survit à la fermeture) ; refus (quota) → fetch keepalive ;
  // échec des deux → onFailed (le badge ne repasse pas à idle).
  const beaconWithFallback = (url: string, payload: string, onSettled: () => void, onFailed: () => void) => {
    if (navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))) {
      onSettled();
      return;
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).then(onSettled).catch(onFailed);
  };

  // Écriture en attente + l'app passe en arrière-plan : on n'attend pas le
  // débounce, le beacon survit à la fermeture de l'onglet/PWA.
  const flushDraftSave = () => {
    if (!draftSaveTimeoutRef.current || draftValidatedRef.current) return;
    clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = null;
    const payload = JSON.stringify({
      employeeId: sessionRef.current?.id,
      inventory: inventoryRef.current,
      burgersPrevus: forecastRef.current.burgersPrevus,
    });
    beaconWithFallback('/api/inventory-draft', payload,
      () => setDraftSaveStatus('idle'),
      () => setDraftSaveStatus('error'));
  };

  const flushForecastSave = () => {
    if (!saveTimeoutRef.current) return;
    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = null;
    // Même règle que le débounce : état complet, burgers omis si vide/0
    const burgers = parseInt(forecastRef.current.burgersPrevus) || 0;
    const payload = JSON.stringify({
      employee_id: sessionRef.current?.id,
      ...(burgers > 0 ? { burgers_prevus: burgers } : {}),
      extra_boules_boeuf: parseInt(forecastRef.current.extraBoulesBoeuf) || 0,
    });
    beaconWithFallback('/api/daily-forecast', payload,
      () => setForecastSaveStatus('idle'),
      () => {});
  };

  const flushPendingSaves = () => {
    flushDraftSave();
    flushForecastSave();
  };

  // Écrivain unique forecast : un seul timer, chaque envoi porte burgers + extra
  // lus depuis la ref au moment de l'envoi (burgers omis si vide/0)
  const scheduleForecastSave = () => {
    setForecastSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      const burgers = parseInt(forecastRef.current.burgersPrevus) || 0;
      const extra = parseInt(forecastRef.current.extraBoulesBoeuf) || 0;
      saveDailyForecastBoth(burgers > 0 ? burgers : undefined, extra, sessionRef.current?.id)
        .then(() => {
          setForecastSaveStatus('saved');
          if (savedBadgeRef.current) clearTimeout(savedBadgeRef.current);
          savedBadgeRef.current = setTimeout(() => setForecastSaveStatus('idle'), 2000);
        })
        .catch(() => setForecastSaveStatus('idle'));
    }, 800);
  };

  // N'applique QUE l'inventaire : le forecast (burgers + extra) a sa propre
  // source de vérité (daily_forecast) — la copie burgers_prevus du brouillon
  // est un instantané de saisie, pas une donnée à afficher (elle perdait la
  // course d'hydratation contre daily_forecast avec une valeur périmée).
  const applyDraft = (draft: InventoryDraft) => {
    setInventory({
      fritesFraiches: draft.frites_fraiches,
      fritesBlanchies: draft.frites_blanchies,
      boulesRestantes: draft.boules_restantes,
      pctGras: draft.pct_gras !== '' ? draft.pct_gras : '26.5',
      bunsRestants: draft.buns_restants,
      bunsJeter: draft.buns_jeter,
      bunsJ2: draft.buns_j2,
    });
  };

  useEffect(() => {
    // SW postMessage: app already open when notification clicked
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE') {
        const parsed = new URL(event.data.url, window.location.origin);
        if (parsed.pathname === '/mobile') {
          const s = parsed.searchParams.get('screen') as Screen | null;
          if (s) setScreen(s);
        } else {
          window.location.href = event.data.url;
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);

    // Cache redirect: app was closed when notification clicked
    if ('caches' in window) {
      caches.open('__notif_redirect__').then(async (cache) => {
        const res = await cache.match('target');
        if (res) {
          const url = await res.text();
          await cache.delete('target');
          const parsed = new URL(url, window.location.origin);
          if (parsed.pathname === '/mobile') {
            const s = parsed.searchParams.get('screen') as Screen | null;
            if (s) setScreen(s);
          } else {
            window.location.href = url;
          }
        }
      }).catch(() => {});
    }

    const s = getSession();
    if (s) {
      verifyEmployee(s.id).then(status => {
        if (status?.active) {
          const refreshed: EmployeeSession = { ...s, is_admin: status.is_admin };
          if (s.is_admin !== status.is_admin) persistSession(refreshed);
          setSession(refreshed);
          registerPushSubscription(s.id).catch(() => {});
        } else {
          clearSession();
          setSession(null);
        }
      }).catch(() => { setSession(s); });
    } else {
      setSession(null);
    }
    fetchAppSettings().then(setSettings).catch(() => {});
    hasTodayDeliveryPending().then(pending => {
      if (pending) setScreen('livraison');
    }).catch(() => {});
    hasTodayInventoryBeenDone().then(done => {
      setInventoryDone(done);
      draftValidatedRef.current = done;
    }).catch(() => {});

    fetchLastOrder().then(order => {
      if (order) {
        const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        const todayStr = fmt(new Date());
        const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
        const tomorrowStrLocal = fmt(tmrw);
        if (order.date === todayStr || order.date === tomorrowStrLocal) {
          setLastValidatedForecast({ burgersPrevus: String(order.burgers_prevus), extraBoulesBoeuf: '' });
          setLastValidatedOrders({
            fritesABlanchir: order.frites_blanchir,
            fritesACommander: order.frites_commander,
            viandeTotal: order.viande_total,
            boeuf: order.boeuf,
            gras: order.gras,
            bunsACommander: order.buns_commander,
          });
          setPreparationDate(order.date);
        }
      }
    }).catch(() => {});

    fetchDailyForecast().then(f => {
      if (!f) return;
      setForecast(p => ({
        ...p,
        ...(f.burgers_prevus > 0 && p.burgersPrevus === '' ? { burgersPrevus: String(f.burgers_prevus) } : {}),
        ...(f.extra_boules_boeuf > 0 && p.extraBoulesBoeuf === '' ? { extraBoulesBoeuf: String(f.extra_boules_boeuf) } : {}),
      }));
    }).catch(() => {});

    fetchInventoryDraft().then(draft => {
      draftHydratedRef.current = true;
      if (draft && draft.status === 'draft' && !inventoryTouchedRef.current) {
        applyDraft(draft);
      } else if (inventoryTouchedRef.current) {
        // L'utilisateur a saisi avant la fin de l'hydratation : on persiste sa saisie
        scheduleDraftSave();
      }
    }).catch(() => { draftHydratedRef.current = true; });

    // Reprise d'app : flush du brouillon en attente au passage en arrière-plan,
    // resynchronisation forecast + brouillon au retour (clé de date côté serveur,
    // donc correcte même après minuit sur une PWA restée ouverte).
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingSaves();
        return;
      }
      fetchDailyForecast().then(f => {
        if (!f) return;
        setForecast(p => ({
          ...p,
          ...(f.burgers_prevus > 0 ? { burgersPrevus: String(f.burgers_prevus) } : {}),
          extraBoulesBoeuf: f.extra_boules_boeuf > 0 ? String(f.extra_boules_boeuf) : '',
        }));
      }).catch(() => {});
      if (!inventoryTouchedRef.current) {
        fetchInventoryDraft().then(draft => {
          if (draft && draft.status === 'draft' && !inventoryTouchedRef.current) applyDraft(draft);
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushPendingSaves);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushPendingSaves);
    };
  }, []);

  // Entrée sur l'écran Valider : on vide le débounce brouillon MAINTENANT
  // (envoi immédiat) — un timer qui partirait après save-order reposterait
  // status='draft' par-dessus le 'validated' fraîchement figé.
  useEffect(() => {
    if (screen === 'validation') flushDraftSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const orders = useMemo(() => calculate(inventory, forecast, settings), [inventory, forecast, settings]);

  const fritesFixed = settings?.frites.fixedOrder.is_active ?? false;
  const viandeFixed = settings?.viande.fixedOrder.is_active ?? false;
  const bunsFixed = settings?.buns.fixedOrder.is_active ?? false;

  const inventoryComplete =
    (fritesFixed || (inventory.fritesFraiches !== '' && inventory.fritesBlanchies !== '')) &&
    (viandeFixed || inventory.boulesRestantes !== '') &&
    (bunsFixed || inventory.bunsRestants !== '');

  const forecastComplete = parseFloat(forecast.burgersPrevus) > 0;

  if (session === undefined) return null;

  if (!session) {
    return <LoginScreen onLogin={() => setSession(getSession())} />;
  }

  const onCommande = COMMANDE_SCREENS.includes(screen);

  return (
    <div className="min-h-screen bg-[#FFF0F5] text-[#1A1209] max-w-lg mx-auto relative">

      {/* Top step nav — visible uniquement dans la section Commande */}
      {onCommande && (
        <CommandeSteps
          current={screen as 'inventaire' | 'prevision' | 'validation'}
          onChange={setScreen}
          inventoryComplete={inventoryComplete}
          forecastComplete={forecastComplete}
          inventoryDone={inventoryDone}
        />
      )}

      {screen === 'inventaire' && inventoryDone && (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <div className="text-7xl mb-6">✅</div>
          <h2 className="text-3xl font-bold text-[#1A1209] mb-2">Inventaire déjà effectué</h2>
          <p className="text-[#596643]">La commande du soir a déjà été validée aujourd'hui.</p>
          <p className="text-[#C4A8B5] text-sm mt-3">Revenez demain soir pour le prochain inventaire.</p>
        </div>
      )}
      {screen === 'inventaire' && !inventoryDone && (
        <InventoryScreen
          inventory={inventory}
          saveStatus={draftSaveStatus}
          onChange={(f, v) => {
            setInventory(p => ({ ...p, [f]: v }));
            inventoryTouchedRef.current = true;
            if (draftHydratedRef.current) scheduleDraftSave();
          }}
          onNext={() => setScreen('prevision')}
          fixedFrites={fritesFixed}
          fixedViande={viandeFixed}
          fixedBuns={bunsFixed}
        />
      )}
      {screen === 'prevision' && (
        <ForecastScreen
          forecast={forecast}
          onChange={(f, v) => {
            setForecast(p => ({ ...p, [f]: v }));
            // '' sur l'extra = bouton « 0 » : la remise à zéro doit aussi se propager
            scheduleForecastSave();
          }}
          saveStatus={forecastSaveStatus}
          orders={orders}
          settings={settings}
          onBack={() => setScreen('inventaire')}
          onNext={() => setScreen('validation')}
        />
      )}
      {screen === 'validation' && (
        <ValidationScreen
          inventory={inventory}
          forecast={inventoryDone && lastValidatedOrders ? lastValidatedForecast : forecast}
          orders={inventoryDone && lastValidatedOrders ? lastValidatedOrders : orders}
          settings={settings}
          alreadyDone={inventoryDone}
          isAdmin={session?.is_admin}
          onBack={() => setScreen('prevision')}
          onValidated={() => {
            // Le brouillon vient d'être figé : purge du débounce en attente et
            // verrou sur toute écriture draft jusqu'à une éventuelle annulation
            if (draftSaveTimeoutRef.current) {
              clearTimeout(draftSaveTimeoutRef.current);
              draftSaveTimeoutRef.current = null;
            }
            draftValidatedRef.current = true;
            setDraftSaveStatus('idle');
            setLastValidatedOrders(orders);
            setLastValidatedForecast(forecast);
            setInventory(defaultInventory);
            setForecast(defaultForecast);
            setInventoryDone(true);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            setPreparationDate(`${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`);
            setScreen('preparation');
          }}
          onCancelled={(restored) => {
            draftValidatedRef.current = false; // le brouillon est rouvert
            setInventory(restored.inventory);
            setForecast(restored.forecast);
            // La source de vérité du forecast (burgers + extra) est daily_forecast,
            // qui survit à l'annulation — le payload restored ne connaît pas l'extra
            fetchDailyForecast().then(f => {
              if (!f) return;
              setForecast(p => ({
                burgersPrevus: f.burgers_prevus > 0 ? String(f.burgers_prevus) : p.burgersPrevus,
                extraBoulesBoeuf: f.extra_boules_boeuf > 0 ? String(f.extra_boules_boeuf) : '',
              }));
            }).catch(() => {});
            setLastValidatedOrders(null);
            setLastValidatedForecast(defaultForecast);
            setPreparationDate(null);
            setInventoryDone(false);
            setScreen('inventaire');
          }}
        />
      )}
      {screen === 'preparation' && (
        <PreparationScreen
          orders={lastValidatedOrders ?? null}
          preparationDate={preparationDate}
          employeeId={session?.id}
        />
      )}
      {screen === 'livraison' && (
        <MorningScreen
          reception={reception}
          onChange={(f, v) => setReception(p => ({ ...p, [f]: v }))}
          onSaved={() => { setReception(defaultReception); setScreen('livraison'); }}
        />
      )}
      {screen === 'compte' && (
        <CompteScreen
          session={session}
          onLogout={() => setSession(null)}
        />
      )}

      <BottomNav
        current={screen}
        onChange={setScreen}
        inventoryComplete={inventoryComplete}
        forecastComplete={forecastComplete}
        inventoryDone={inventoryDone}
      />
    </div>
  );
}
