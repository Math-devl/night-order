'use client';

import { useState, useEffect } from 'react';
import { CalculatedOrders } from '@/lib/types';

interface Props {
  orders: CalculatedOrders | null;
  preparationDate?: string | null;
}

const WEEKLY_TASKS: Record<number, string[]> = {
  0: ["Filtrer l'huile"],
  1: ['Nettoyer les filtres'],
  2: ["Changer l'huile", 'Nettoyer le lave-vaisselle'],
  3: ['Sauce Spé', 'Nettoyer intérieur de la hotte'],
  4: ["Filtrer l'huile"],
  5: ['Pickle de cornichons', 'Pickles de coleslaw'],
  6: [],
};

function formatFrDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function parseDateLocal(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-');
  return new Date(Number(year), Number(month) - 1, Number(day));
}

function BigStat({ emoji, label, value, unit }: { emoji: string; label: string; value: number; unit: string }) {
  return (
    <div className="bg-[#596643] rounded-2xl p-6 border border-[#6B7A50] text-center">
      <div className="text-4xl mb-3">{emoji}</div>
      <p className="text-[#8BA870] text-xs font-bold uppercase tracking-widest mb-2">{label}</p>
      <p className="text-white text-6xl font-bold mb-1">
        {value > 0 ? value : <span className="text-[#6B7A50]">—</span>}
      </p>
      {value > 0 && <p className="text-[#C8D4B0] text-lg">{unit}</p>}
    </div>
  );
}

function TaskRow({ text, done, onToggle, onDelete }: { text: string; done: boolean; onToggle: () => void; onDelete?: () => void }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[#F0E0E8]">
      <button
        onClick={onToggle}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${done ? 'bg-[#596643] border-[#596643]' : 'border-[#C4A8B5]'}`}
      >
        {done && <span className="text-white text-xs leading-none">✓</span>}
      </button>
      <span className={`flex-1 text-sm ${done ? 'line-through text-[#A0909A]' : 'text-[#1A1209]'}`}>{text}</span>
      {onDelete && (
        <button onClick={onDelete} className="text-[#C4A8B5] text-xl px-1 leading-none">×</button>
      )}
    </div>
  );
}

export default function PreparationScreen({ orders, preparationDate }: Props) {
  const fritesABlanchir = orders?.fritesABlanchir ?? 0;
  const boulesViande = orders ? Math.round(orders.viandeTotal / 0.0625) : 0;

  const dayOfWeek = preparationDate ? parseDateLocal(preparationDate).getDay() : null;
  const fixedTasks = dayOfWeek !== null ? (WEEKLY_TASKS[dayOfWeek] ?? []) : [];
  const storageKey = preparationDate ? `prep_tasks_${preparationDate}` : null;

  const [fixedDone, setFixedDone] = useState<boolean[]>([]);
  const [customTasks, setCustomTasks] = useState<{ text: string; done: boolean }[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const saved = storageKey ? localStorage.getItem(storageKey) : null;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const fd: boolean[] = parsed.fixedDone ?? [];
        while (fd.length < fixedTasks.length) fd.push(false);
        setFixedDone(fd);
        setCustomTasks(parsed.customTasks ?? []);
        return;
      } catch { /* fall through */ }
    }
    setFixedDone(new Array(fixedTasks.length).fill(false));
    setCustomTasks([]);
  }, [storageKey]);

  const persist = (fd: boolean[], ct: { text: string; done: boolean }[]) => {
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify({ fixedDone: fd, customTasks: ct }));
  };

  const toggleFixed = (i: number) => {
    const next = fixedDone.map((v, j) => j === i ? !v : v);
    setFixedDone(next);
    persist(next, customTasks);
  };

  const toggleCustom = (i: number) => {
    const next = customTasks.map((t, j) => j === i ? { ...t, done: !t.done } : t);
    setCustomTasks(next);
    persist(fixedDone, next);
  };

  const deleteCustom = (i: number) => {
    const next = customTasks.filter((_, j) => j !== i);
    setCustomTasks(next);
    persist(fixedDone, next);
  };

  const addTask = () => {
    if (!newTaskText.trim()) { setAdding(false); return; }
    const next = [...customTasks, { text: newTaskText.trim(), done: false }];
    setCustomTasks(next);
    persist(fixedDone, next);
    setNewTaskText('');
    setAdding(false);
  };

  const subtitle = preparationDate
    ? `Préparation pour le ${formatFrDate(preparationDate)}`
    : 'Pour le service de ce soir';

  return (
    <div className="pb-28 px-4">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[#1A1209]">Préparation</h1>
        {preparationDate && (
          <p className="text-[#A0909A] text-sm mt-1">{subtitle}</p>
        )}
      </div>

      {!orders || (fritesABlanchir === 0 && boulesViande === 0) ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="text-5xl mb-4">🔪</div>
          <p className="text-[#A0909A]">Aucune commande validée pour ce soir.</p>
          <p className="text-[#C4A8B5] text-sm mt-2">Faites l'inventaire et la prévision d'abord.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <BigStat emoji="🍟" label="Frites à blanchir" value={fritesABlanchir} unit="kg" />
          <BigStat emoji="🥩" label="Boules de bœuf à former" value={boulesViande} unit="boules" />
        </div>
      )}

      <div className="mt-6">
        {fixedTasks.map((task, i) => (
          <TaskRow key={task} text={task} done={fixedDone[i] ?? false} onToggle={() => toggleFixed(i)} />
        ))}
        {customTasks.map((task, i) => (
          <TaskRow key={i} text={task.text} done={task.done} onToggle={() => toggleCustom(i)} onDelete={() => deleteCustom(i)} />
        ))}

        {adding && (
          <div className="flex gap-2 mt-3">
            <input
              autoFocus
              value={newTaskText}
              onChange={e => setNewTaskText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') { setAdding(false); setNewTaskText(''); } }}
              className="flex-1 border border-[#C4A8B5] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#596643]"
              placeholder="Nouvelle tâche..."
            />
            <button onClick={addTask} className="px-4 py-2 bg-[#596643] text-white rounded-xl text-sm font-semibold">OK</button>
            <button onClick={() => { setAdding(false); setNewTaskText(''); }} className="px-3 py-2 text-[#A0909A] text-sm">✕</button>
          </div>
        )}

        {!adding && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setAdding(true)}
              className="text-pink-500 text-base font-semibold flex items-center gap-1"
            >
              <span className="text-xl leading-none">+</span> Ajouter une tâche
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
