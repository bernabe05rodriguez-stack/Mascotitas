'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/components/Analytics';

/**
 * Dispara un evento `view_item` de GA4 cuando se carga la página de un producto.
 */
export function ViewItemTracker({
  itemId,
  itemName,
  price,
  brand,
}: {
  itemId: string;
  itemName: string;
  price: number;
  brand?: string;
}) {
  useEffect(() => {
    trackEvent('view_item', {
      item_id: itemId,
      item_name: itemName,
      value: price,
      item_brand: brand ?? '',
      currency: 'ARS',
    });
  }, [itemId, itemName, price, brand]);

  return null;
}
