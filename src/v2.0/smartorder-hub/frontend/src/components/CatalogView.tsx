import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Boxes,
  Loader2,
  Package,
  RefreshCw,
  Search,
  Truck,
} from 'lucide-react';
import { IndustryProfile } from '../types/order';
import {
  CatalogProduct,
  CatalogSupplier,
  fetchCatalog,
} from '../services/workspaceApi';
import { useI18n } from '../i18n/I18nContext';

interface CatalogViewProps {
  industry: IndustryProfile;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  }).format(value || 0);

export const CatalogView: React.FC<CatalogViewProps> = ({ industry }) => {
  const { t } = useI18n();
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [suppliers, setSuppliers] = useState<CatalogSupplier[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCatalog();
      setProducts(data.products);
      setSuppliers(data.suppliers);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('catalog.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load, industry.id]);

  const supplierById = useMemo(
    () => Object.fromEntries(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.aliases.some((alias) => alias.toLowerCase().includes(query))
    );
  }, [products, search]);

  const belowSafety = products.filter(
    (product) => product.stock < product.safetyStock
  ).length;
  const stockValue = products.reduce(
    (total, product) => total + product.stock * product.unitCost,
    0
  );
  const hasCapacity = products.some((product) => product.capacityKg);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('catalog.title', { industry: industry.name })}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('catalog.subtitle')}
            {industry.inventoryMode !== 'stock'
              ? ` ${t('catalog.modeNote', { mode: industry.inventoryMode })}`
              : ''}
          </p>
        </div>
        <button
          onClick={load}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {[
          {
            label: t('catalog.products'),
            value: products.length,
            Icon: Package,
          },
          { label: t('catalog.suppliers'), value: suppliers.length, Icon: Truck },
          { label: t('catalog.belowSafety'), value: belowSafety, Icon: AlertCircle },
          { label: t('catalog.stockValue'), value: money(stockValue), Icon: Boxes },
        ].map(({ label, value, Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <Icon className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">
              {value}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('catalog.search')}
          className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400"
        />
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          {t('catalog.loading')}
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[1050px]">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">{t('catalog.sku')}</th>
                  <th className="py-2.5 px-3">{t('catalog.name')}</th>
                  <th className="py-2.5 px-3 text-right">
                    {t(
                      industry.inventoryMode === 'capacity'
                        ? 'inventory.capacity'
                        : industry.inventoryMode === 'material'
                        ? 'inventory.material'
                        : 'inventory.stock'
                    )}
                  </th>
                  <th className="py-2.5 px-3 text-right">{t('catalog.safety')}</th>
                  <th className="py-2.5 px-3 text-right">{t('catalog.sell')}</th>
                  <th className="py-2.5 px-3 text-right">{t('catalog.cost')}</th>
                  <th className="py-2.5 px-3 text-right">{t('catalog.unitMargin')}</th>
                  <th className="py-2.5 px-3">{t('catalog.supplier')}</th>
                  <th className="py-2.5 px-3 text-right">{t('catalog.lead')}</th>
                  {hasCapacity && (
                    <th className="py-2.5 px-3 text-right">{t('catalog.capacity')}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((product) => {
                  const supplier = supplierById[product.supplierId];
                  const margin =
                    product.sellPrice > 0
                      ? (product.sellPrice - product.unitCost) /
                        product.sellPrice
                      : 0;
                  const low = product.stock < product.safetyStock;
                  return (
                    <tr
                      key={product.sku}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">
                        {product.sku}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {product.name}
                        <p className="text-[10px] font-normal text-slate-400">
                          {product.aliases.slice(0, 3).join(', ')}
                        </p>
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-semibold ${
                          low
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {product.stock}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {product.safetyStock}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {money(product.sellPrice)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {money(product.unitCost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {(margin * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {supplier?.name || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        {supplier ? `${supplier.leadTimeDays}d` : '—'}
                      </td>
                      {hasCapacity && (
                        <td className="py-2.5 px-3 text-right text-slate-500">
                          {product.capacityKg
                            ? `${product.capacityKg.toLocaleString()} kg`
                            : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {t('catalog.suppliers')}
              </h3>
            </div>
            <table className="w-full text-xs text-left min-w-[620px]">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-3">{t('catalog.supplier')}</th>
                  <th className="py-2 px-3 text-right">{t('catalog.leadTime')}</th>
                  <th className="py-2 px-3 text-right">{t('catalog.moq')}</th>
                  <th className="py-2 px-3">{t('catalog.contact')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td className="py-2 px-3 font-medium text-slate-700 dark:text-slate-300">
                      {supplier.name}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {t('catalog.days', { count: supplier.leadTimeDays })}
                    </td>
                    <td className="py-2 px-3 text-right">{supplier.moq}</td>
                    <td className="py-2 px-3 text-slate-500">
                      {supplier.contact}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
