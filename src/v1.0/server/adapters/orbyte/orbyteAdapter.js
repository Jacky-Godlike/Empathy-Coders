/**
 * OrbyteAdapter is the seam between OrderPilot and the Orbyte ecosystem.
 *
 * The demo uses MockOrbyteAdapter, which reads the synthetic JSON dataset and
 * writes purchase drafts and audit events locally. A future production adapter
 * would implement the same methods against Orbyte Connect / Open APIs.
 *
 * Contract:
 *   getCatalog()                      -> Product[]
 *   getInventory()                    -> StockRow[]
 *   getSuppliers()                    -> Supplier[]
 *   getCustomers()                    -> Customer[]
 *   createPurchaseDraft(draft)        -> PurchaseDraft
 *   emitAuditEvent(event)             -> Activity
 */
export class OrbyteAdapter {
  async getCatalog() {
    throw new Error('OrbyteAdapter.getCatalog() is not implemented');
  }

  async getInventory() {
    throw new Error('OrbyteAdapter.getInventory() is not implemented');
  }

  async getSuppliers() {
    throw new Error('OrbyteAdapter.getSuppliers() is not implemented');
  }

  async getCustomers() {
    throw new Error('OrbyteAdapter.getCustomers() is not implemented');
  }

  async createPurchaseDraft() {
    throw new Error('OrbyteAdapter.createPurchaseDraft() is not implemented');
  }

  async emitAuditEvent() {
    throw new Error('OrbyteAdapter.emitAuditEvent() is not implemented');
  }
}
