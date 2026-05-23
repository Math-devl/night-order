'use client';

import { useState } from 'react';
import FournisseursTab from './FournisseursTab';
import MultiplicateursTab from './MultiplicateursTab';
import CommandesFixesTab from './CommandesFixesTab';

type ParamTab = 'fournisseurs' | 'multiplicateurs' | 'fixes';

const TABS: { id: ParamTab; label: string }[] = [
  { id: 'fournisseurs', label: 'Fournisseurs' },
  { id: 'multiplicateurs', label: 'Multiplicateurs' },
  { id: 'fixes', label: 'Cmd. fixes' },
];

export default function ParametresSection() {
  const [tab, setTab] = useState<ParamTab>('fournisseurs');

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-[#596643] rounded-xl p-1 border border-[#6B7A50]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-[#FF4D8A] text-white' : 'text-[#C8D4B0] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'fournisseurs' && <FournisseursTab />}
      {tab === 'multiplicateurs' && <MultiplicateursTab />}
      {tab === 'fixes' && <CommandesFixesTab />}
    </div>
  );
}
