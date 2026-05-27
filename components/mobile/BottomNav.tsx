'use client';

import { Screen } from '@/lib/types';

interface Props {
  current: Screen;
  onChange: (s: Screen) => void;
  inventoryComplete: boolean;
  forecastComplete: boolean;
  inventoryDone: boolean;
}

const tabs: { id: Screen; label: string; icon: string }[] = [
  { id: 'inventaire', label: 'Inventaire', icon: '📋' },
  { id: 'prevision', label: 'Prévision', icon: '🧮' },
  { id: 'validation', label: 'Valider', icon: '✅' },
  { id: 'preparation', label: 'Prép.', icon: '🔪' },
  { id: 'livraison', label: 'Livraison', icon: '📦' },
  { id: 'compte', label: 'Compte', icon: '👤' },
];

export default function BottomNav({ current, onChange, inventoryComplete, forecastComplete, inventoryDone }: Props) {
  const isUnlocked = (id: Screen) => {
    if (id === 'inventaire') return true;
    if (id === 'prevision') return true;
    if (id === 'validation') return (inventoryComplete && forecastComplete) || inventoryDone;
    if (id === 'preparation') return true;
    if (id === 'livraison') return true;
    if (id === 'compte') return true;
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#596643] border-t border-[#6B7A50] flex z-50">
      {tabs.map((tab) => {
        const active = current === tab.id;
        const unlocked = isUnlocked(tab.id);
        return (
          <button
            key={tab.id}
            onClick={() => unlocked && onChange(tab.id)}
            className={`flex-1 flex flex-col items-center pt-2 pb-4 gap-0.5 transition-colors ${
              active
                ? 'text-[#FF4D8A]'
                : unlocked
                ? 'text-[#8BA870] active:text-white'
                : 'text-[#496035] cursor-not-allowed'
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
