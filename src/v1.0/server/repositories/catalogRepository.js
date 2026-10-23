import { normalizeEmail, normalizeName, phoneKey } from '../domain/validation.js';

export class CatalogRepository {
  constructor({ products, suppliers, stock, customers }) {
    this.products = products;
    this.suppliers = suppliers;
    this.stock = stock;
    this.customers = customers;
  }

  async getProducts() {
    return this.products.read();
  }

  async getProductBySku(sku) {
    if (!sku) return null;
    const products = await this.products.read();
    return products.find((product) => product.sku === sku) || null;
  }

  async getSuppliers() {
    return this.suppliers.read();
  }

  async getSupplierById(id) {
    if (!id) return null;
    const suppliers = await this.suppliers.read();
    return suppliers.find((supplier) => supplier.id === id) || null;
  }

  async getStock() {
    return this.stock.read();
  }

  async getStockBySku(sku) {
    const rows = await this.stock.read();
    return rows.find((row) => row.sku === sku) || null;
  }

  async getCustomers() {
    return this.customers.read();
  }

  async getCustomerById(id) {
    if (!id) return null;
    const customers = await this.customers.read();
    return customers.find((customer) => customer.id === id) || null;
  }

  async findCustomer({ phone, email, name } = {}) {
    const customers = await this.customers.read();
    const normalizedPhone = phoneKey(phone);
    if (normalizedPhone) {
      const byPhone = customers.find((customer) => phoneKey(customer.phone) === normalizedPhone);
      if (byPhone) return byPhone;
    }
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail) {
      const byEmail = customers.find((customer) => normalizeEmail(customer.email) === normalizedEmail);
      if (byEmail) return byEmail;
    }
    const normalized = normalizeName(name);
    if (normalized) {
      const byName = customers.find(
        (customer) =>
          normalizeName(customer.name) === normalized || normalizeName(customer.businessName) === normalized,
      );
      if (byName) return byName;
    }
    return null;
  }

  /**
   * Apply onHand/reserved deltas atomically.
   * updates: [{ sku, onHandDelta?, reservedDelta? }]
   */
  async adjustStock(updates) {
    if (!Array.isArray(updates) || updates.length === 0) return [];
    return this.stock.update((rows) => {
      const changed = [];
      for (const update of updates) {
        const row = rows.find((entry) => entry.sku === update.sku);
        if (!row) continue;
        if (update.onHandDelta) row.onHand = Math.max(0, Number(row.onHand) + Number(update.onHandDelta));
        if (update.reservedDelta) row.reserved = Math.max(0, Number(row.reserved) + Number(update.reservedDelta));
        changed.push({ ...row });
      }
      return changed;
    });
  }

  async getSnapshot() {
    const [products, suppliers, stock, customers] = await Promise.all([
      this.products.read(),
      this.suppliers.read(),
      this.stock.read(),
      this.customers.read(),
    ]);
    return { products, suppliers, stock, customers };
  }
}
