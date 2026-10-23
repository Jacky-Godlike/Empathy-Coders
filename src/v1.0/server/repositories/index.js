import { ActivityRepository } from './activityRepository.js';
import { CatalogRepository } from './catalogRepository.js';
import { MessageRepository } from './messageRepository.js';
import { OrderRepository } from './orderRepository.js';
import { PurchaseDraftRepository } from './purchaseDraftRepository.js';
import { UserRepository } from './userRepository.js';
import { createStores, invalidateStores } from './stores.js';

export function createRepositories(runtimeDir) {
  const stores = createStores(runtimeDir);
  const repositories = {
    catalog: new CatalogRepository(stores),
    users: new UserRepository(stores),
    messages: new MessageRepository(stores),
    orders: new OrderRepository(stores),
    activities: new ActivityRepository(stores),
    purchaseDrafts: new PurchaseDraftRepository(stores),
  };
  return {
    stores,
    repositories,
    invalidate() {
      invalidateStores(stores);
    },
  };
}
