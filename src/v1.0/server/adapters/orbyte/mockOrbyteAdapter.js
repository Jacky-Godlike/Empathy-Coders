import { OrbyteAdapter } from './orbyteAdapter.js';

/**
 * Local implementation of the Orbyte adapter contract. It is intentionally
 * small: the rest of OrderPilot only talks to this interface, so replacing it
 * with a real Orbyte connector is a contained change.
 */
export class MockOrbyteAdapter extends OrbyteAdapter {
  constructor({ catalog, purchaseDrafts, activities }) {
    super();
    this.catalog = catalog;
    this.purchaseDrafts = purchaseDrafts;
    this.activities = activities;
  }

  async getCatalog() {
    return this.catalog.getProducts();
  }

  async getInventory() {
    return this.catalog.getStock();
  }

  async getSuppliers() {
    return this.catalog.getSuppliers();
  }

  async getCustomers() {
    return this.catalog.getCustomers();
  }

  async createPurchaseDraft(draft) {
    return this.purchaseDrafts.add(draft);
  }

  async emitAuditEvent(event) {
    return this.activities.append(event);
  }

  capabilities() {
    return {
      mode: 'mock',
      read: ['getCatalog', 'getInventory', 'getSuppliers', 'getCustomers'],
      write: ['createPurchaseDraft', 'emitAuditEvent'],
      note: 'Mock adapter backed by synthetic JSON data. No real Orbyte platform is connected.',
    };
  }
}
