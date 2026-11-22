import React, { useMemo, useRef, useState } from 'react';
import {
  Search,
  Edit2,
  Trash2,
  RotateCcw,
  X,
  AlertTriangle,
  Bluetooth,
  Check,
  Layers,
} from 'lucide-react';
import {
  BluetoothSupportValue,
  BLUETOOTH_SUPPORT_OPTIONS,
  DEVICE_MODEL_CATEGORIES,
  DeviceModelSeedRecord,
  getDeviceModelCompositeKey,
  getDeviceModelReviewInfo,
  sortDeviceModels,
} from '../data/deviceModelSeed';
import { DeleteConfirmationModal } from './common/DeleteConfirmationModal';
import {
  parseDeviceModelCsv,
  resetDeviceModelStore,
  saveDeviceModelStore,
} from '../data/deviceModelSeed';

interface DeviceModelCatalogueSectionProps {
  models: DeviceModelSeedRecord[];
  onChangeModels: (next: DeviceModelSeedRecord[]) => void;
  onToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  openAddSignal?: number;
  exportSignal?: number;
  resetSignal?: number;
  importSignal?: number;
}

export const DeviceModelCatalogueSection: React.FC<DeviceModelCatalogueSectionProps> = ({
  models,
  onChangeModels,
  onToast,
  openAddSignal = 0,
  exportSignal = 0,
  resetSignal = 0,
  importSignal = 0,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [brandFilter, setBrandFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyReviewFlagged, setOnlyReviewFlagged] = useState<boolean>(false);

  // Add / Edit Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<DeviceModelSeedRecord | null>(null);
  const [formCategory, setFormCategory] = useState<string>(DEVICE_MODEL_CATEGORIES[0]);
  const [formBrand, setFormBrand] = useState<string>('');
  const [customBrandInput, setCustomBrandInput] = useState<string>('');
  const [isAddingNewBrand, setIsAddingNewBrand] = useState<boolean>(false);
  const [formModel, setFormModel] = useState<string>('');
  const [formBluetooth, setFormBluetooth] = useState<BluetoothSupportValue>('Not specified');
  const [formError, setFormError] = useState<string>('');

  // Confirm Delete & Reset states
  const [modelToDelete, setModelToDelete] = useState<DeviceModelSeedRecord | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  const csvFileInputRef = useRef<HTMLInputElement>(null);

  // Sync external header button signals cleanly
  const prevAddSignal = useRef(openAddSignal);
  const prevExportSignal = useRef(exportSignal);
  const prevResetSignal = useRef(resetSignal);
  const prevImportSignal = useRef(importSignal);

  React.useEffect(() => {
    if (openAddSignal !== prevAddSignal.current) {
      prevAddSignal.current = openAddSignal;
      handleOpenAdd();
    }
  }, [openAddSignal]);

  React.useEffect(() => {
    if (exportSignal !== prevExportSignal.current) {
      prevExportSignal.current = exportSignal;
      handleExportCsv();
    }
  }, [exportSignal]);

  React.useEffect(() => {
    if (resetSignal !== prevResetSignal.current) {
      prevResetSignal.current = resetSignal;
      setShowResetConfirm(true);
    }
  }, [resetSignal]);

  React.useEffect(() => {
    if (importSignal !== prevImportSignal.current) {
      prevImportSignal.current = importSignal;
      csvFileInputRef.current?.click();
    }
  }, [importSignal]);

  // Dynamic category list & counts derived directly from data
  const categoryStats = useMemo(() => {
    const counts = new Map<string, number>();
    models.forEach((m) => {
      counts.set(m.deviceCategory, (counts.get(m.deviceCategory) || 0) + 1);
    });

    const orderedCategories: string[] = [];
    DEVICE_MODEL_CATEGORIES.forEach((cat) => {
      if (counts.has(cat)) orderedCategories.push(cat);
    });
    Array.from(counts.keys())
      .filter((c) => !orderedCategories.includes(c))
      .sort((a, b) => a.localeCompare(b))
      .forEach((c) => orderedCategories.push(c));

    return orderedCategories.map((category) => ({
      category,
      count: counts.get(category) || 0,
    }));
  }, [models]);

  // All selectable categories in Add/Edit
  const selectableCategories = useMemo(() => {
    return Array.from(
      new Set([...DEVICE_MODEL_CATEGORIES, ...models.map((m) => m.deviceCategory)])
    );
  }, [models]);

  // Dynamic Brand options for Brand filter (scoped by category filter when selected)
  const filterBrandOptions = useMemo(() => {
    const source =
      categoryFilter === 'All'
        ? models
        : models.filter((m) => m.deviceCategory === categoryFilter);
    return Array.from(new Set(source.map((m) => m.brand))).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [models, categoryFilter]);

  // All unique Brands across master for Add/Edit dropdown
  const allMasterBrands = useMemo(() => {
    return Array.from(new Set(models.map((m) => m.brand))).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [models]);

  const reviewFlaggedCount = useMemo(() => {
    return models.filter((m) => getDeviceModelReviewInfo(m).needsReview).length;
  }, [models]);

  // Filtered & sorted/grouped rows
  const filteredModels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = models.filter((row) => {
      if (categoryFilter !== 'All' && row.deviceCategory !== categoryFilter) return false;
      if (brandFilter !== 'All' && row.brand !== brandFilter) return false;
      if (onlyReviewFlagged && !getDeviceModelReviewInfo(row).needsReview) return false;
      if (q) {
        const matchesBrand = row.brand.toLowerCase().includes(q);
        const matchesModel = row.model.toLowerCase().includes(q);
        const matchesCategory = row.deviceCategory.toLowerCase().includes(q);
        if (!matchesBrand && !matchesModel && !matchesCategory) return false;
      }
      return true;
    });
    return sortDeviceModels(list);
  }, [models, categoryFilter, brandFilter, searchQuery, onlyReviewFlagged]);

  // Grouped view preserving Device Category -> Brand -> Model ordering with sequential Sr No
  const groupedSections = useMemo(() => {
    const groups: { category: string; rows: (DeviceModelSeedRecord & { displaySrNo: number })[] }[] = [];
    let runningSrNo = 1;
    filteredModels.forEach((row) => {
      const last = groups[groups.length - 1];
      const itemWithSr = { ...row, displaySrNo: runningSrNo++ };
      if (!last || last.category !== row.deviceCategory) {
        groups.push({ category: row.deviceCategory, rows: [itemWithSr] });
      } else {
        last.rows.push(itemWithSr);
      }
    });
    return groups;
  }, [filteredModels]);

  const handleOpenAdd = () => {
    setEditingModel(null);
    const defaultCat =
      categoryFilter !== 'All' ? categoryFilter : DEVICE_MODEL_CATEGORIES[0];
    setFormCategory(defaultCat);
    const firstBrand =
      brandFilter !== 'All'
        ? brandFilter
        : allMasterBrands[0] || '';
    setFormBrand(firstBrand);
    setCustomBrandInput('');
    setIsAddingNewBrand(false);
    setFormModel('');
    setFormBluetooth('Not specified');
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (rec: DeviceModelSeedRecord) => {
    setEditingModel(rec);
    setFormCategory(rec.deviceCategory);
    setFormBrand(rec.brand);
    setCustomBrandInput('');
    setIsAddingNewBrand(false);
    setFormModel(rec.model);
    setFormBluetooth(rec.bluetoothSupport);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSaveModelForm = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedCategory = formCategory.trim();
    const resolvedBrand = (isAddingNewBrand ? customBrandInput : formBrand).trim();
    const resolvedModel = formModel.trim();

    if (!resolvedCategory) {
      setFormError('Device Category is required.');
      return;
    }
    if (!resolvedBrand) {
      setFormError('Brand is required.');
      return;
    }
    if (!resolvedModel) {
      setFormError('Model name is required (use "Model Not Specified" if unconfirmed).');
      return;
    }

    const compositeKey = getDeviceModelCompositeKey(
      resolvedCategory,
      resolvedBrand,
      resolvedModel
    );

    const duplicateExists = models.some(
      (m) =>
        m.id !== editingModel?.id &&
        getDeviceModelCompositeKey(m.deviceCategory, m.brand, m.model) === compositeKey
    );

    if (duplicateExists) {
      setFormError(
        `Duplicate prevented: "${resolvedCategory} · ${resolvedBrand} · ${resolvedModel}" already exists in the master.`
      );
      return;
    }

    if (editingModel) {
      const updated = models.map((m) =>
        m.id === editingModel.id
          ? {
              ...m,
              deviceCategory: resolvedCategory,
              brand: resolvedBrand,
              model: resolvedModel,
              bluetoothSupport: formBluetooth,
            }
          : m
      );
      const saved = saveDeviceModelStore(updated);
      onChangeModels(saved);
      onToast(`Updated "${resolvedBrand} · ${resolvedModel}"`, 'success');
    } else {
      const created: DeviceModelSeedRecord = {
        id: `dmod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        srNo: models.length + 1,
        deviceCategory: resolvedCategory,
        brand: resolvedBrand,
        model: resolvedModel,
        bluetoothSupport: formBluetooth,
      };
      const saved = saveDeviceModelStore([...models, created]);
      onChangeModels(saved);
      onToast(`Added "${resolvedBrand} · ${resolvedModel}" to ${resolvedCategory}`, 'success');
    }

    setIsFormOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!modelToDelete) return;
    const next = models.filter((m) => m.id !== modelToDelete.id);
    const saved = saveDeviceModelStore(next);
    onChangeModels(saved);
    onToast(`Deleted "${modelToDelete.brand} · ${modelToDelete.model}"`, 'success');
    setModelToDelete(null);
  };

  const handleConfirmResetSeed = () => {
    const resetRows = resetDeviceModelStore();
    onChangeModels(resetRows);
    setCategoryFilter('All');
    setBrandFilter('All');
    setSearchQuery('');
    setOnlyReviewFlagged(false);
    setShowResetConfirm(false);
    onToast(`Reset to exact ${resetRows.length} seed device models`, 'info');
  };

  const handleExportCsv = () => {
    const headers = ['Sr No', 'Device Category', 'Brand', 'Model', 'Bluetooth Support'];
    const escapeCell = (val: string | number) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const csvLines = [
      headers.join(','),
      ...filteredModels.map((row, index) =>
        [
          index + 1,
          escapeCell(row.deviceCategory),
          escapeCell(row.brand),
          escapeCell(row.model),
          escapeCell(row.bluetoothSupport),
        ].join(',')
      ),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fleetrobo_device_model_master_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onToast(`Exported ${filteredModels.length} device models to CSV`, 'success');
  };

  const handleCsvFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const { rows, skippedInvalid } = parseDeviceModelCsv(text);
      if (rows.length === 0) {
        onToast('No valid rows found in CSV file.', 'error');
        return;
      }

      const existingKeys = new Set(
        models.map((m) =>
          getDeviceModelCompositeKey(m.deviceCategory, m.brand, m.model)
        )
      );

      const additions: DeviceModelSeedRecord[] = [];
      let skippedDuplicates = 0;

      rows.forEach((row, idx) => {
        const key = getDeviceModelCompositeKey(row.deviceCategory, row.brand, row.model);
        if (existingKeys.has(key)) {
          skippedDuplicates++;
          return;
        }
        existingKeys.add(key);
        additions.push({
          id: `dmod-csv-${Date.now()}-${idx}`,
          srNo: models.length + additions.length + 1,
          deviceCategory: row.deviceCategory,
          brand: row.brand,
          model: row.model,
          bluetoothSupport: row.bluetoothSupport,
        });
      });

      if (additions.length === 0) {
        onToast(
          `No new models added (${skippedDuplicates} duplicate${skippedDuplicates === 1 ? '' : 's'} skipped).`,
          'info'
        );
        return;
      }

      const saved = saveDeviceModelStore([...models, ...additions]);
      onChangeModels(saved);
      onToast(
        `Imported ${additions.length} model(s)` +
          (skippedDuplicates > 0 ? `, ${skippedDuplicates} duplicate(s) skipped` : '') +
          (skippedInvalid > 0 ? `, ${skippedInvalid} invalid row(s) ignored` : ''),
        'success'
      );
    } catch {
      onToast('Failed to read CSV file.', 'error');
    }
  };

  const renderBluetoothBadge = (bt: BluetoothSupportValue) => {
    if (bt === 'BLE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Bluetooth className="w-3 h-3" />
          BLE
        </span>
      );
    }
    if (bt === 'Yes') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Check className="w-3 h-3" />
          Yes
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
        Not specified
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Hidden CSV Input */}
      <input
        ref={csvFileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleCsvFileSelected}
        className="hidden"
      />

      {/* Dynamic Category Breakdown Bar */}
      <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('All');
              setBrandFilter('All');
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              categoryFilter === 'All' && !onlyReviewFlagged
                ? 'bg-[#FFF3EE] text-[#B85324] border-[#FA8A63]'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All ({models.length})
          </button>

          {categoryStats.map((stat) => {
            const active = categoryFilter === stat.category && !onlyReviewFlagged;
            return (
              <button
                key={stat.category}
                type="button"
                onClick={() => {
                  setCategoryFilter(stat.category);
                  setBrandFilter('All');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#FFF3EE] text-[#B85324] border-[#FA8A63]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {stat.category} ({stat.count})
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setOnlyReviewFlagged((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
            onlyReviewFlagged
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50/40'
          }`}
          title="Filter models flagged as Review Placeholder or ambiguous combined strings"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>Flagged for Review ({reviewFlaggedCount})</span>
        </button>
      </div>

      {/* Directory Search & Filter Toolbar */}
      <div className="px-6 py-2.5 bg-white border-b border-slate-200/80 flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap">
          <span className="text-sm font-bold text-slate-900 shrink-0">Directory</span>

          {/* Search for model / brand */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={14} className="text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by brand or model..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-[#FA8A63] rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Device Category Filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-semibold text-slate-500">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setBrandFilter('All');
              }}
              className="h-[31px] px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:border-[#FA8A63] cursor-pointer hover:border-slate-300 shadow-2xs"
            >
              <option value="All">All categories ({models.length})</option>
              {categoryStats.map((stat) => (
                <option key={stat.category} value={stat.category}>
                  {stat.category} ({stat.count})
                </option>
              ))}
            </select>
          </div>

          {/* Brand Filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-semibold text-slate-500">Brand:</span>
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="h-[31px] px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:border-[#FA8A63] cursor-pointer hover:border-slate-300 shadow-2xs max-w-[210px]"
            >
              <option value="All">All brands ({filterBrandOptions.length})</option>
              {filterBrandOptions.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          {(searchQuery || categoryFilter !== 'All' || brandFilter !== 'All' || onlyReviewFlagged) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('All');
                setBrandFilter('All');
                setOnlyReviewFlagged(false);
              }}
              className="text-xs text-[#FA8A63] font-semibold hover:underline cursor-pointer whitespace-nowrap shrink-0"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
          <span>
            Showing <strong className="text-slate-900 font-semibold">{filteredModels.length}</strong> of{' '}
            {models.length} models
          </span>
        </div>
      </div>

      {/* Grouped Master Table: Sr No | Device Category | Brand | Model | Bluetooth Support */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[780px] text-left border-collapse text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 sticky top-0 z-10 select-none">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap w-[84px]">
                    Sr No
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap w-[180px]">
                    Device Category
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap w-[220px]">
                    Brand
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                    Model
                  </th>
                  <th className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap w-[170px]">
                    Bluetooth Support
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 whitespace-nowrap w-[110px]">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {groupedSections.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="max-w-sm mx-auto space-y-2">
                        <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                        <div className="text-sm font-semibold text-slate-700">No models found</div>
                        <p className="text-xs text-slate-500">
                          No device models matched your filters. Adjust filters or click "+ Add Model".
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  groupedSections.map((group) => (
                    <React.Fragment key={group.category}>
                      {/* Category Group Divider Row */}
                      <tr className="bg-slate-50/80 border-y border-slate-200/80">
                        <td colSpan={6} className="px-4 py-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                {group.category}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-[#B85324]">
                                {group.rows.length} {group.rows.length === 1 ? 'model' : 'models'}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400">
                              Sorted by Brand → Model
                            </span>
                          </div>
                        </td>
                      </tr>

                      {group.rows.map((row) => {
                        const reviewInfo = getDeviceModelReviewInfo(row);
                        return (
                          <tr
                            key={row.id}
                            className="hover:bg-slate-50/80 transition-colors group"
                          >
                            <td className="px-4 py-2.5 font-mono text-slate-500 font-medium">
                              {row.displaySrNo}
                            </td>

                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {row.deviceCategory}
                              </span>
                            </td>

                            <td className="px-4 py-2.5 font-semibold text-slate-800">
                              <span>{row.brand}</span>
                              {row.brand.trim().toLowerCase() === 'unknown' && (
                                <span
                                  title="Unknown supplier brand — flagged for review"
                                  className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold"
                                >
                                  Review
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={
                                    reviewInfo.kind === 'placeholder'
                                      ? 'font-medium italic text-amber-800'
                                      : 'font-medium text-slate-900'
                                  }
                                >
                                  {row.model}
                                </span>
                                {reviewInfo.needsReview && (
                                  <span
                                    title={reviewInfo.reason}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                      reviewInfo.kind === 'placeholder'
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-sky-50 text-sky-700 border-sky-200'
                                    }`}
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    {reviewInfo.badgeText}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-4 py-2.5">
                              {renderBluetoothBadge(row.bluetoothSupport)}
                            </td>

                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(row)}
                                  title="Edit model"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#FA8A63] hover:bg-orange-50 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setModelToDelete(row)}
                                  title="Delete model"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit Model Drawer */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[130] flex justify-end bg-slate-900/30 backdrop-blur-[1px]">
          <form
            onSubmit={handleSaveModelForm}
            className="w-[460px] max-w-full h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingModel ? 'Edit Device Model' : 'Add Device Model'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure Device Category, Brand, Model, and Bluetooth capability metadata.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Device Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => {
                    setFormCategory(e.target.value);
                    setFormError('');
                  }}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:border-[#FA8A63]"
                >
                  {selectableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-800">
                    Brand <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewBrand((prev) => !prev);
                      setFormError('');
                    }}
                    className="text-[11px] font-semibold text-[#FA8A63] hover:underline cursor-pointer"
                  >
                    {isAddingNewBrand ? 'Select existing brand' : '+ New Brand'}
                  </button>
                </div>

                {!isAddingNewBrand ? (
                  <select
                    value={formBrand}
                    onChange={(e) => {
                      setFormBrand(e.target.value);
                      setFormError('');
                    }}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:border-[#FA8A63]"
                  >
                    <option value="">-- Select Brand --</option>
                    {allMasterBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={customBrandInput}
                    onChange={(e) => {
                      setCustomBrandInput(e.target.value);
                      setFormError('');
                    }}
                    placeholder="Enter new brand name (e.g. Teltonika, Pictor)..."
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#FA8A63]"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Model <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formModel}
                  onChange={(e) => {
                    setFormModel(e.target.value);
                    setFormError('');
                  }}
                  placeholder="Enter model name (or 'Model Not Specified')"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-[#FA8A63]"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Use <code className="px-1 py-0.5 rounded bg-slate-100">Model Not Specified</code> when hardware model is unconfirmed (flagged for review).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  Bluetooth Support <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {BLUETOOTH_SUPPORT_OPTIONS.map((opt) => {
                    const selected = formBluetooth === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFormBluetooth(opt)}
                        className={`h-9 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#FA8A63] bg-[#FFF3EE] text-[#B85324]'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Preserved strictly as metadata (`Yes`, `BLE`, or `Not specified`).
                </p>
              </div>
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="h-8 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-8 px-4 rounded-lg bg-[#FA8A63] hover:bg-[#e57953] text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                {editingModel ? 'Save Changes' : 'Add Model'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Model Confirmation */}
      <DeleteConfirmationModal
        isOpen={Boolean(modelToDelete)}
        title="Delete Device Model?"
        description={
          modelToDelete ? (
            <>
              Are you sure you want to delete{' '}
              <strong className="text-slate-900 font-semibold">
                {modelToDelete.brand} · {modelToDelete.model}
              </strong>{' '}
              from <strong className="text-slate-900">{modelToDelete.deviceCategory}</strong>?
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete Model"
        targetChips={
          modelToDelete
            ? [
                { id: 'cat', label: modelToDelete.deviceCategory, tone: 'blue' },
                { id: 'brand', label: modelToDelete.brand, tone: 'slate' },
                { id: 'model', label: modelToDelete.model, tone: 'orange' },
              ]
            : []
        }
        onCancel={() => setModelToDelete(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Reset to Seed Data Confirmation */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/40">
          <div className="w-[420px] max-w-[92vw] bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <RotateCcw className="w-4 h-4 shrink-0" />
              <span>Reset Device Models to Seed Data?</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will restore all <strong>78 seeded rows</strong> (GPS, AIS GPS, Portable GPS, E-Lock, Video Telematics) and discard local edits in this view. Your existing Hardware Types (Sensors, SIMs, and Devices) will not be affected.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetSeed}
                className="h-8 px-3.5 rounded-lg bg-[#FA8A63] hover:bg-[#e57953] text-white text-xs font-semibold cursor-pointer"
              >
                Reset to 78 Seed Rows
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
