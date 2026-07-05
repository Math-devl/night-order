'use client';

import { DailyOrder } from '@/lib/db';
import { inventaireDateStr } from '@/lib/dates';
import { formatDate } from './helpers';
import InventoryModalBase from './InventoryModalBase';

export default function EditInventoryModal({ order, onSave, onClose }: { order: DailyOrder; onSave: (u: Partial<DailyOrder>) => void; onClose: () => void }) {
  return (
    <InventoryModalBase
      title="Modifier l'inventaire"
      subtitle={`${formatDate(inventaireDateStr(order.date))} au soir`}
      defaults={order}
      submitLabel="Enregistrer"
      onSubmit={onSave}
      onClose={onClose}
    />
  );
}
