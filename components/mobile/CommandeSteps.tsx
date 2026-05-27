'use client';

type SubStep = 'inventaire' | 'prevision' | 'validation';

interface Props {
  current: SubStep;
  onChange: (s: SubStep) => void;
  inventoryComplete: boolean;
  forecastComplete: boolean;
  inventoryDone: boolean;
}

const steps: { id: SubStep; label: string }[] = [
  { id: 'inventaire', label: 'Inventaire' },
  { id: 'prevision', label: 'Prévision' },
  { id: 'validation', label: 'Valider' },
];

export default function CommandeSteps({ current, onChange, inventoryComplete, forecastComplete, inventoryDone }: Props) {
  const isDone = (id: SubStep) => {
    if (id === 'inventaire') return inventoryComplete;
    if (id === 'prevision') return forecastComplete;
    return inventoryDone;
  };

  const isAccessible = (id: SubStep) => {
    if (id === 'validation') return (inventoryComplete && forecastComplete) || inventoryDone;
    return true;
  };

  return (
    <div className="flex items-center justify-center gap-2 px-4 pt-5 pb-2">
      {steps.map((step, i) => {
        const active = current === step.id;
        const done = isDone(step.id);
        const accessible = isAccessible(step.id);

        return (
          <div key={step.id} className="flex items-center gap-2">
            {i > 0 && <span className="text-[#8BA870] text-sm font-light">›</span>}
            <button
              onClick={() => accessible && onChange(step.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                active
                  ? 'bg-[#FF4D8A] text-white shadow-sm'
                  : done
                  ? 'bg-[#496035] text-[#C8D4B0]'
                  : accessible
                  ? 'bg-[#596643] text-[#8BA870]'
                  : 'text-[#496035] cursor-not-allowed'
              }`}
            >
              {done && !active && <span className="text-[10px]">✓</span>}
              {step.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
