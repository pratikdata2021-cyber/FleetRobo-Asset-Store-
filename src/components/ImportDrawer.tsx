import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft, 
  Download 
} from 'lucide-react';
import { Vehicle, DEMO_LOOKUPS } from '../types/vehicle';

interface ImportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (createdCount: number, updatedCount: number, skippedCount: number) => void;
  existingVehicles: Vehicle[];
}

export const ImportDrawer: React.FC<ImportDrawerProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  existingVehicles
}) => {
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importMode, setImportMode] = useState<'create_only' | 'upsert'>('create_only');
  const [validationResults, setValidationResults] = useState<{
    valid: { rowIdx: number; row: Record<string, string> }[];
    invalid: { rowIdx: number; row: Record<string, string>; error: string }[];
  }>({ valid: [], invalid: [] });

  if (!isOpen) return null;

  const CANONICAL_KEYS = [
    'company',
    'registration_number',
    'name',
    'internal_id',
    'vin',
    'make',
    'model',
    'year',
    'type',
    'status',
    'transporter',
    'vendor',
    'driver',
    'fleet',
    'odometer',
    'odometer_unit',
    'fuel_type'
  ];

  const handleUseSampleCSV = () => {
    const sampleHeaders = ['Company', 'Registration Number', 'Vehicle Name', 'Make', 'Model', 'Year', 'Status', 'TransPorter', 'Internal ID', 'VIN'];
    const sampleData: Record<string, string>[] = [
      {
        'Company': 'Adani Port',
        'Registration Number': 'MH14XY9900',
        'Vehicle Name': 'Tata Signa 5530',
        'Make': 'Tata Motors',
        'Model': 'Signa 5530',
        'Year': '2023',
        'Status': 'Available',
        'TransPorter': 'Western Logistics',
        'Internal ID': 'TRK-9900',
        'VIN': 'TATA9900XYZ123'
      },
      {
        'Company': 'Adani Port',
        'Registration Number': 'GJ01AB1122',
        'Vehicle Name': 'Ashok Leyland 2820',
        'Make': 'Ashok Leyland',
        'Model': '2820',
        'Year': '2022',
        'Status': 'Available',
        'TransPorter': 'TMS Transporter',
        'Internal ID': 'TRK-1122',
        'VIN': 'ASHOK1122ABC999'
      },
      {
        'Company': 'Adani Port',
        'Registration Number': 'MH12AB1234', // Existing match for testing
        'Vehicle Name': 'Tata Signa 5530 (Updated)',
        'Make': 'Tata Motors',
        'Model': 'Signa 5530',
        'Year': '2024',
        'Status': 'In Use',
        'TransPorter': 'Western Logistics',
        'Internal ID': 'TRK-0019',
        'VIN': 'MA3FJEB1S00654321'
      }
    ];

    setCsvHeaders(sampleHeaders);
    setCsvRows(sampleData);
    setFile(new File(['sample'], 'sample_vehicles.csv', { type: 'text/csv' }));

    // Auto-map
    const initialMapping: Record<string, string> = {
      company: 'Company',
      registration_number: 'Registration Number',
      name: 'Vehicle Name',
      make: 'Make',
      model: 'Model',
      year: 'Year',
      status: 'Status',
      transporter: 'TransPorter',
      internal_id: 'Internal ID',
      vin: 'VIN'
    };
    setColumnMapping(initialMapping);
    setStage(2);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.endsWith('.csv')) {
      alert('This standalone prototype supports CSV import.');
      return;
    }

    setFile(uploadedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        alert('CSV must contain a header and at least one data row.');
        return;
      }
      if (lines.length > 1000) {
        alert('Standalone prototype supports maximum 1,000 rows.');
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
      const rows: Record<string, string>[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        rows.push(rowObj);
      }

      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-map based on common labels
      const autoMap: Record<string, string> = {};
      CANONICAL_KEYS.forEach((key) => {
        const matched = headers.find(
          (h) =>
            h.toLowerCase() === key.toLowerCase() ||
            h.toLowerCase().replace(/[^a-z0-9]/g, '') === key.toLowerCase().replace(/[^a-z0-9]/g, '') ||
            (key === 'registration_number' && (h.toLowerCase().includes('plate') || h.toLowerCase().includes('registration')))
        );
        if (matched) autoMap[key] = matched;
      });
      setColumnMapping(autoMap);
      setStage(2);
    };
    reader.readAsText(uploadedFile);
  };

  const handleValidate = () => {
    if (!columnMapping['company'] || !columnMapping['registration_number']) {
      alert('Company and Registration Number mappings are mandatory.');
      return;
    }

    const valid: { rowIdx: number; row: Record<string, string> }[] = [];
    const invalid: { rowIdx: number; row: Record<string, string>; error: string }[] = [];
    const seenPlates = new Set<string>();

    csvRows.forEach((row, idx) => {
      const compCol = columnMapping['company'];
      const regCol = columnMapping['registration_number'];

      const companyVal = row[compCol]?.trim();
      const regVal = row[regCol]?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

      if (!companyVal) {
        invalid.push({ rowIdx: idx + 1, row, error: 'Missing company' });
        return;
      }
      if (!regVal || regVal.length < 7) {
        invalid.push({ rowIdx: idx + 1, row, error: 'Invalid registration number (<7 chars)' });
        return;
      }
      if (seenPlates.has(regVal)) {
        invalid.push({ rowIdx: idx + 1, row, error: 'Duplicate plate in file' });
        return;
      }
      seenPlates.add(regVal);

      // Check existing in DB
      const exists = existingVehicles.some(
        (v) => v.company.toLowerCase() === companyVal.toLowerCase() && v.registration_number.replace(/[^A-Z0-9]/g, '') === regVal
      );

      if (exists && importMode === 'create_only') {
        invalid.push({ rowIdx: idx + 1, row, error: 'Vehicle already exists in company (Create only mode)' });
        return;
      }

      valid.push({ rowIdx: idx + 1, row });
    });

    setValidationResults({ valid, invalid });
    setStage(3);
  };

  const handleConfirmImport = () => {
    let created = 0;
    let updated = 0;

    validationResults.valid.forEach(({ row }) => {
      const compCol = columnMapping['company'];
      const regCol = columnMapping['registration_number'];
      const comp = row[compCol]?.trim();
      const reg = row[regCol]?.trim().toUpperCase();

      const exists = existingVehicles.some(
        (v) => v.company.toLowerCase() === comp.toLowerCase() && v.registration_number === reg
      );

      if (exists) {
        updated++;
      } else {
        created++;
      }
    });

    onImportComplete(created, updated, validationResults.invalid.length);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" />

      {/* 790px Right Drawer */}
      <div className="relative w-[790px] max-w-full bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h2 className="text-base font-bold text-slate-900">Import Vehicles via CSV</h2>
            <div className="flex items-center gap-4 mt-2 text-xs">
              <span className={`font-semibold ${stage === 1 ? 'text-[#FA8A63] border-b-2 border-[#FA8A63]' : 'text-slate-400'}`}>
                1 · Upload
              </span>
              <span className={`font-semibold ${stage === 2 ? 'text-[#FA8A63] border-b-2 border-[#FA8A63]' : 'text-slate-400'}`}>
                2 · Map
              </span>
              <span className={`font-semibold ${stage === 3 ? 'text-[#FA8A63] border-b-2 border-[#FA8A63]' : 'text-slate-400'}`}>
                3 · Validate
              </span>
              <span className={`font-semibold ${stage === 4 ? 'text-[#FA8A63] border-b-2 border-[#FA8A63]' : 'text-slate-400'}`}>
                4 · Import
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STAGE 1: Upload */}
          {stage === 1 && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-orange-50 text-[#FA8A63] flex items-center justify-center mx-auto">
                  <Upload size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Choose CSV or drag & drop</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Maximum 1,000 vehicle records per import file</p>
                </div>
                <div className="pt-2">
                  <label className="px-4 py-2 bg-[#FA8A63] hover:bg-[#e77a54] text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-xs inline-block">
                    Choose CSV file
                    <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-800">Need a starting format?</div>
                  <div className="text-[11px] text-slate-500">Download canonical CSV header template or load sample vehicles.</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const csvContent = 'data:text/csv;charset=utf-8,Company,Registration Number,Vehicle Name,Make,Model,Year,Status,TransPorter,Internal ID,VIN\nAdani Port,MH12AA0001,Tata Signa 5530,Tata Motors,Signa 5530,2023,Available,Western Logistics,TRK-001,MA3FJEB1S00000001';
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement('a');
                      link.setAttribute('href', encodedUri);
                      link.setAttribute('download', 'fleetrobo_vehicle_template.csv');
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded-lg hover:bg-white text-slate-700"
                  >
                    <Download size={13} />
                    Download template
                  </button>
                  <button
                    onClick={handleUseSampleCSV}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg"
                  >
                    Use sample CSV
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2: Map */}
          {stage === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Map CSV Columns to Canonical Keys</h3>
                  <p className="text-xs text-slate-500">Company and Registration Number mappings are required.</p>
                </div>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                  {csvRows.length} rows found in {file?.name}
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {CANONICAL_KEYS.map((key) => {
                  const isMandatory = key === 'company' || key === 'registration_number';
                  return (
                    <div key={key} className="px-4 py-2.5 flex items-center justify-between bg-white hover:bg-slate-50 text-xs">
                      <div className="w-1/2">
                        <span className="font-semibold text-slate-800 capitalize">
                          {key.replace(/_/g, ' ')}
                        </span>
                        {isMandatory && <span className="text-red-500 font-bold ml-1">*</span>}
                      </div>
                      <div className="w-1/2">
                        <select
                          value={columnMapping[key] || ''}
                          onChange={(e) =>
                            setColumnMapping({
                              ...columnMapping,
                              [key]: e.target.value
                            })
                          }
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FA8A63]"
                        >
                          <option value="">— Do not import —</option>
                          {csvHeaders.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  onClick={() => setStage(1)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={handleValidate}
                  className="px-5 py-2 bg-[#FA8A63] hover:bg-[#e77a54] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  Validate records →
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: Validate */}
          {stage === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Total Rows</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{csvRows.length}</div>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                  <div className="text-[10px] uppercase font-bold text-emerald-700">Valid</div>
                  <div className="text-lg font-bold text-emerald-800 mt-1">{validationResults.valid.length}</div>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <div className="text-[10px] uppercase font-bold text-amber-700">Invalid / Skipped</div>
                  <div className="text-lg font-bold text-amber-800 mt-1">{validationResults.invalid.length}</div>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-800">Import Operation Mode</label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'create_only'}
                      onChange={() => {
                        setImportMode('create_only');
                      }}
                      className="text-[#FA8A63] focus:ring-[#FA8A63]"
                    />
                    <span>Create new (skip existing)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'upsert'}
                      onChange={() => {
                        setImportMode('upsert');
                      }}
                      className="text-[#FA8A63] focus:ring-[#FA8A63]"
                    />
                    <span>Create or update matching Company + Registration</span>
                  </label>
                </div>
              </div>

              {/* Error preview table */}
              {validationResults.invalid.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-amber-600" />
                    <span>Row Issues ({validationResults.invalid.length})</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-amber-200 rounded-lg divide-y divide-amber-100 bg-amber-50/20 text-xs">
                    {validationResults.invalid.map((item, idx) => (
                      <div key={idx} className="px-3 py-1.5 flex items-center justify-between">
                        <span className="font-semibold text-slate-800">Row {item.rowIdx}</span>
                        <span className="text-amber-700 font-medium">{item.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  onClick={() => setStage(2)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Back
                </button>
                <button
                  disabled={validationResults.valid.length === 0}
                  onClick={() => setStage(4)}
                  className={`px-5 py-2 text-xs font-semibold rounded-lg shadow-xs transition-colors ${
                    validationResults.valid.length === 0
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-[#FA8A63] hover:bg-[#e77a54] text-white cursor-pointer'
                  }`}
                >
                  Proceed to Confirm →
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: Confirm */}
          {stage === 4 && (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <span>Ready to commit {validationResults.valid.length} records</span>
                </div>
                <p className="text-xs text-emerald-700">
                  {importMode === 'create_only'
                    ? 'Creating valid new vehicles only. Existing records will be skipped.'
                    : 'Creating new and updating matching Company + Registration Number records with provided non-empty values.'}
                </p>
              </div>

              {/* Sample preview of valid records */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                  Preview Eligible Records
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {validationResults.valid.slice(0, 15).map(({ rowIdx, row }) => (
                    <div key={rowIdx} className="px-4 py-2 flex items-center justify-between">
                      <span className="font-bold text-slate-900">{row[columnMapping['registration_number']]}</span>
                      <span className="text-slate-600">{row[columnMapping['name']] || '—'}</span>
                      <span className="text-slate-500">{row[columnMapping['company']]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  onClick={() => setStage(3)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="px-6 py-2 bg-[#FA8A63] hover:bg-[#e77a54] text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Confirm & Commit Import
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
