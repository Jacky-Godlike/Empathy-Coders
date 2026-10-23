import path from 'node:path';

import { config } from '../config.js';
import { JsonStore } from './jsonStore.js';

export function createStores(runtimeDir = config.paths.runtimeDir) {
  const file = (name) => path.join(runtimeDir, name);
  return {
    products: new JsonStore(file('products.json'), []),
    suppliers: new JsonStore(file('suppliers.json'), []),
    stock: new JsonStore(file('stock.json'), []),
    customers: new JsonStore(file('customers.json'), []),
    users: new JsonStore(file('users.json'), []),
    messages: new JsonStore(file('messages.json'), []),
    orders: new JsonStore(file('orders.json'), []),
    activities: new JsonStore(file('activities.json'), []),
    purchaseDrafts: new JsonStore(file('purchase-drafts.json'), []),
  };
}

export function invalidateStores(stores) {
  for (const store of Object.values(stores)) store.invalidate();
}
