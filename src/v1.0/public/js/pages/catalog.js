import { icon } from '../icons.js';
import * as ui from '../ui.js';

function statusBadge(status) {
  if (status === 'out') return ui.el('span', { class: 'badge badge-danger' }, ui.el('span', { class: 'dot' }), 'Out');
  if (status === 'low') return ui.el('span', { class: 'badge badge-warning' }, ui.el('span', { class: 'dot' }), 'Low');
  return ui.el('span', { class: 'badge badge-success' }, ui.el('span', { class: 'dot' }), 'Healthy');
}

function stockBar(row) {
  const safety = Number(row.safetyStock) || 0;
  const available = Number(row.available) || 0;
  const width =
    safety > 0 ? Math.min(100, Math.round((available / (safety * 2)) * 100)) : available > 0 ? 100 : 0;
  return ui.el(
    'div',
    { class: 'row', style: { gap: '7px' } },
    ui.el('div', { class: 'stock-bar' }, ui.el('div', { class: `stock-bar-fill ${row.status}`, style: { width: `${width}%` } })),
    ui.el('span', { class: 'tabular', style: { fontSize: '11px', fontWeight: '700' }, text: String(available) }),
  );
}

function productRows(rows) {
  return rows.map((row) => {
    const margin =
      row.sellingPrice !== null && row.unitCost !== null && Number(row.sellingPrice) > 0
        ? ((Number(row.sellingPrice) - Number(row.unitCost)) / Number(row.sellingPrice)) * 100
        : null;
    return ui.el(
      'tr',
      {},
      ui.el(
        'td',
        {},
        ui.el('div', { style: { fontWeight: '700' }, text: row.productName }),
        ui.el('div', { class: 'form-hint', style: { fontSize: '9.5px' }, text: row.sku }),
      ),
      ui.el('td', { text: row.category || '—' }),
      ui.el('td', { text: row.unit || '—' }),
      ui.el('td', { class: 'tabular', text: row.sellingPrice !== null ? ui.money(row.sellingPrice) : '—' }),
      ui.el('td', { class: 'tabular', text: row.unitCost !== null ? ui.money(row.unitCost) : '—' }),
      ui.el('td', {
        class: 'tabular',
        style: { color: margin !== null && margin < 10 ? 'var(--danger)' : 'var(--success)', fontWeight: '700' },
        text: margin !== null ? ui.pct(margin) : '—',
      }),
      ui.el('td', {}, stockBar(row)),
      ui.el('td', { class: 'tabular', text: String(row.safetyStock ?? '—') }),
      ui.el(
        'td',
        {},
        ui.el('div', { style: { fontSize: '11px' }, text: row.supplierName || '—' }),
        ui.el('div', { class: 'form-hint', style: { fontSize: '9.5px' }, text: row.leadTimeDays !== null ? `${row.leadTimeDays} day lead` : 'No lead time' }),
      ),
      ui.el('td', {}, statusBadge(row.status)),
    );
  });
}

function productTable(rows) {
  if (rows.length === 0) {
    return ui.emptyState({
      iconName: 'box',
      title: 'No products match',
      text: 'Try a different search term.',
    });
  }
  const table = ui.el(
    'table',
    { class: 'catalog-table', 'aria-label': 'Product catalogue and stock' },
    ui.el(
      'thead',
      {},
      ui.el(
        'tr',
        {},
        ui.el('th', { text: 'Product' }),
        ui.el('th', { text: 'Category' }),
        ui.el('th', { text: 'Unit' }),
        ui.el('th', { text: 'Selling price' }),
        ui.el('th', { text: 'Cost' }),
        ui.el('th', { text: 'Margin' }),
        ui.el('th', { text: 'Available' }),
        ui.el('th', { text: 'Safety' }),
        ui.el('th', { text: 'Supplier' }),
        ui.el('th', { text: 'Status' }),
      ),
    ),
    ui.el('tbody', {}, ...productRows(rows)),
  );
  return ui.el('div', { class: 'catalog-shell' }, table);
}

function supplierCards(suppliers) {
  return ui.el(
    'div',
    { class: 'supplier-grid' },
    ...suppliers.map((supplier) =>
      ui.el(
        'div',
        { class: 'supplier-card' },
        ui.el('div', { class: 'supplier-name', text: supplier.name }),
        ui.el(
          'div',
          { class: 'supplier-meta' },
          ui.el('span', { class: 'chip chip-info', text: `${supplier.leadTimeDays} day lead` }),
          ui.el('span', { class: 'chip', text: `MOQ ${ui.money(supplier.minOrderValue)}` }),
          ui.el('span', { class: 'chip', text: supplier.paymentTerms || 'Terms TBC' }),
        ),
        ui.el(
          'div',
          { class: 'form-hint', style: { marginTop: '6px' } },
          `${supplier.contactName || '—'} · ${supplier.phone || '—'} · ${supplier.email || '—'}`,
        ),
        ui.el('div', { class: 'supplier-note', text: supplier.notes || '' }),
      ),
    ),
  );
}

function customerTable(customers) {
  return ui.el(
    'details',
    { class: 'card', style: { marginTop: '16px' } },
    ui.el(
      'summary',
      {
        style: {
          cursor: 'pointer',
          padding: '14px 16px',
          fontFamily: 'var(--font-display)',
          fontSize: '17px',
          listStyle: 'none',
        },
      },
      `Customer master · ${customers.length} synthetic records`,
      ui.el('span', { class: 'form-hint', style: { marginLeft: '8px', fontFamily: 'var(--font-sans)', fontSize: '10px' }, text: 'click to expand' }),
    ),
    ui.el(
      'div',
      { class: 'customer-shell', style: { border: '0', borderRadius: '0 0 14px 14px', boxShadow: 'none' } },
      ui.el(
        'table',
        { class: 'customer-table' },
        ui.el(
          'thead',
          {},
          ui.el(
            'tr',
            {},
            ui.el('th', { text: 'Business' }),
            ui.el('th', { text: 'Contact' }),
            ui.el('th', { text: 'Phone' }),
            ui.el('th', { text: 'Email' }),
            ui.el('th', { text: 'Address' }),
            ui.el('th', { text: 'Type' }),
          ),
        ),
        ui.el(
          'tbody',
          {},
          ...customers.map((customer) =>
            ui.el(
              'tr',
              {},
              ui.el('td', { text: customer.businessName || customer.name }),
              ui.el('td', { text: customer.name || '—' }),
              ui.el('td', { text: customer.phone || '—' }),
              ui.el('td', { text: customer.email || '—' }),
              ui.el('td', { text: customer.address || 'Not on file' }),
              ui.el('td', { text: customer.type || '—' }),
            ),
          ),
        ),
      ),
    ),
  );
}

export async function renderCatalog(root, ctx) {
  const { api } = ctx;
  const data = await api.catalog();
  const stock = data.stock || [];
  const suppliers = data.suppliers || [];
  const customers = data.customers || [];

  const counts = {
    healthy: stock.filter((row) => row.status === 'healthy').length,
    low: stock.filter((row) => row.status === 'low').length,
    out: stock.filter((row) => row.status === 'out').length,
  };

  const pageActions = ui.el(
    'div',
    { class: 'page-actions' },
    ui.el(
      'div',
      { class: 'page-actions-left' },
      ui.el(
        'span',
        { class: 'last-scan' },
        icon('info', 12),
        'Available = on hand − reserved. Safety stock is a warning line, not a hard block.',
      ),
    ),
    ui.el(
      'div',
      { class: 'page-actions-right' },
      ui.el('span', { class: 'badge badge-neutral' }, `${stock.length} SKUs · ${suppliers.length} suppliers`),
    ),
  );

  const summary = ui.el(
    'div',
    { class: 'stock-summary' },
    ui.el(
      'div',
      { class: 'stock-card healthy' },
      ui.el('div', { class: 'stock-card-label', text: 'Healthy' }),
      ui.el('div', { class: 'stock-card-value', text: String(counts.healthy) }),
      ui.el('div', { class: 'stock-card-note', text: 'Available at or above the safety line.' }),
    ),
    ui.el(
      'div',
      { class: 'stock-card low' },
      ui.el('div', { class: 'stock-card-label', text: 'Low' }),
      ui.el('div', { class: 'stock-card-value', text: String(counts.low) }),
      ui.el('div', { class: 'stock-card-note', text: 'Available below the safety line. Review before promising stock.' }),
    ),
    ui.el(
      'div',
      { class: 'stock-card out' },
      ui.el('div', { class: 'stock-card-label', text: 'Out' }),
      ui.el('div', { class: 'stock-card-value', text: String(counts.out) }),
      ui.el('div', { class: 'stock-card-note', text: 'No available units. A shortage needs a supplier restock.' }),
    ),
  );

  const searchInput = ui.el('input', {
    type: 'search',
    placeholder: 'Search product or SKU…',
    'aria-label': 'Search catalogue',
  });
  let search = '';
  searchInput.addEventListener('input', (event) => {
    search = event.target.value;
    renderProducts();
  });

  const tableHost = ui.el('div');
  function renderProducts() {
    const query = search.trim().toLowerCase();
    const visible = query
      ? stock.filter((row) =>
          [row.productName, row.sku, row.category, row.supplierName]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query),
        )
      : stock;
    ui.mount(tableHost, productTable(visible));
  }

  const catalogueCard = ui.el(
    'div',
    { class: 'card', style: { marginTop: '14px' } },
    ui.el(
      'div',
      { class: 'card-header', style: { padding: '14px 16px 10px', alignItems: 'center' } },
      ui.el(
        'div',
        {},
        ui.el('div', { class: 'card-title', text: 'Product catalogue & stock' }),
        ui.el('div', { class: 'card-sub', text: 'Prices and costs in MYR. Red margin is below the 10% rule.' }),
      ),
      ui.el('div', { class: 'search-box' }, icon('search', 14), searchInput),
    ),
    ui.el('div', { style: { padding: '0 12px 12px' } }, tableHost),
  );

  ui.mount(
    root,
    ui.el(
      'div',
      {},
      pageActions,
      summary,
      catalogueCard,
      ui.el(
        'div',
        { class: 'row between', style: { margin: '22px 0 9px', flexWrap: 'wrap', gap: '8px' } },
        ui.el(
          'div',
          {},
          ui.el('div', { class: 'card-title', text: 'Suppliers' }),
          ui.el('div', { class: 'card-sub', text: 'Lead times and minimum order values drive the procurement recommendation.' }),
        ),
        ui.el('span', { class: 'badge badge-neutral' }, `${suppliers.length} suppliers`),
      ),
      supplierCards(suppliers),
      customerTable(customers),
      ui.el(
        'div',
        { class: 'form-hint', style: { marginTop: '14px' } },
        'All customer, supplier and product records are synthetic demo data. No real company or personal data is used.',
      ),
    ),
  );
  renderProducts();
}
