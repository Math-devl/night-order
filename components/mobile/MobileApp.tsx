'use client';

import { useState, useMemo, useEffect } from 'react';
import { InventoryState, ForecastState, ReceptionState, Screen, AppSettings } from '@/lib/types';
import { calculate } from '@/lib/calculations';
import { fetchAppSettings } from '@/lib/settings';
import { getSession, EmployeeSession } from '@/lib/auth';
import BottomNav from './BottomNav';
import InventoryScreen from './InventoryScreen';
import ForecastScreen from './ForecastScreen';
import ValidationScreen from './ValidationScreen';
import MorningScreen from './MorningScreen';
import LoginScreen from './LoginScreen';
import CompteScreen from './CompteScreen';

const defaultInventory: InventoryState = {
  fritesFraiches: '', fritesBlanchies: '', boulesRestantes: '',
  pctGras: '26.5', bunsRestants: '', bunsJeter: '',
};
const defaultForecast: ForecastState = { burgersPrevus: '' };
const defaultReception: ReceptionState = { fritesRecues: '', viandeRecueBoeuf: '', viandeRecueGras: '', bunsRecus: '' };

export default function MobileApp() {
  const [session, setSession] = useState<EmployeeSession | null | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>('inventaire');
  const [inventory, setInventory] = useState<InventoryState>(defaultInventory);
  const [forecast, setForecast] = useState<ForecastState>(defaultForecast);
  const [reception, setReception] = useState<ReceptionState>(defaultReception);
  const [settings, setSettings] = useState<AppSettings | undefined>(undefined);

  useEffect(() => {
    setSession(getSession());
    fetchAppSettings().then(setSettings).catch(() => {});
  }, []);

  // Tous les hooks doivent être appelés avant tout return conditionnel
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

  return (
    <div className="min-h-screen bg-[#FFF0F5] text-[#1A1209] max-w-lg mx-auto relative">
      {screen === 'inventaire' && (
        <InventoryScreen
          inventory={inventory}
          onChange={(f, v) => setInventory(p => ({ ...p, [f]: v }))}
          onNext={() => setScreen('prevision')}
          fixedFrites={fritesFixed}
          fixedViande={viandeFixed}
          fixedBuns={bunsFixed}
        />
      )}
      {screen === 'prevision' && (
        <ForecastScreen
          forecast={forecast}
          onChange={(f, v) => setForecast(p => ({ ...p, [f]: v }))}
          orders={orders}
          settings={settings}
          onBack={() => setScreen('inventaire')}
          onNext={() => setScreen('validation')}
        />
      )}
      {screen === 'validation' && (
        <ValidationScreen
          inventory={inventory}
          forecast={forecast}
          orders={orders}
          settings={settings}
          onBack={() => setScreen('prevision')}
          onValidated={() => { setInventory(defaultInventory); setForecast(defaultForecast); setScreen('inventaire'); }}
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
      />
    </div>
  );
}
