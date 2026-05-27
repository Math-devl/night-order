'use client';

import { Screen } from '@/lib/types';

interface Props {
  current: Screen;
  onChange: (s: Screen) => void;
  inventoryComplete: boolean;
  forecastComplete: boolean;
  inventoryDone: boolean;
}

const COMMANDE_SCREENS: Screen[] = ['inventaire', 'prevision', 'validation'];

const tabs: { id: string; label: string; icon: string }[] = [
  { id: 'commande',     label: 'Commande',  icon: '📋' },
  { id: 'preparation',  label: 'Prépa',     icon: '🔪' },
  { id: 'livraison',    label: 'Livraison', icon: '📦' },
  { id: 'compte',       label: 'Compte',    icon: '👤' },
];

export default function BottomNav({ current, onChange, inventoryComplete, forecastComplete, inventoryDone }: Props) {
  const isActive = (id: string) => {
    if (id === 'commande') return COMMANDE_SCREENS.includes(current);
    return current === id;
  };

  const handleClick = (id: string) => {
    if (id === 'commande') {
      if (COMMANDE_SCREENS.includes(current)) return; // déjà sur une étape commande
      onChange(inventoryDone ? 'validation' : 'inventaire');
    } else {
      onChange(id as Screen);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#596643] border-t border-[#6B7A50] flex z-50">
      {tabs.map((tab) => {
        const active = isActive(tab.id);
        return (
          <button
            key={tab.id}
            onClick={() => handleClick(tab.id)}
            className={`flex-1 flex flex-col items-center pt-2 pb-4 gap-0.5 transition-colors ${
              active ? 'text-[#FF4D8A]' : 'text-[#8BA870] active:text-white'
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span className="text-xs font-medium">{tab.label}</span>
            <span className={`w-1 h-1 rounded-full mt-0.5 ${active ? 'bg-[#FF4D8A]' : 'bg-transparent'}`} />
          </button>
        );
      })}
    </nav>
  );
}
