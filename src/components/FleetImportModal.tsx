import React, { useState } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { Fleet } from '../types/fleet';

interface FleetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingFleets: Fleet[];
  onImportComplete: (createdFleets: Fleet[]) => void;
}

interface ParsedImportRow {
  rowNum: number;
  rawName: string;
  isValid: boolean;
  reason?: string;
  selected: boolean;
}

export const FleetImportModal: React.FC<FleetImportModalProps> = ({
  isOpen,
  onClose,
  existingFleets,
  onImportComplete
}) => {
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState<string>('');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRawRows, setCsvRawRows] = useState<string[][]>([]);
  const [selectedNameHeader, setSelectedNameHeader] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [importedCount, setImportedCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const templateContent = 'fleet_name\r\nAdani Mundra Cargo Hub\r\nHazira Fertilizer Depot';
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'FleetRobo_Fleet_Import_Template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUseDemoFile = () => {
    const demoContent = `fleet_name,status,parent_fleet
Chennai Terminal Transit,active,
Adani Mundra Operations,active,
,active,
Mundra Gate Logistics,scaling,
Extremely Long Fleet Name That Exceeds The Maximum Character Limit Of One Hundred And Ninety One Characters In Length Which Is Specifically Tested By The Validation Logic To Demonstrate Field Length Enforcements In Enterprise Fleet Management Master Module UI,active,
Pune Express Cargo,active,`;

    processCsvText('demo_fleets_sample.csv', demoContent);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setErrorMessage('Only CSV files are supported.');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCsvText(file.name, text);
    };
    reader.readAsText(file);
  };

  const processCsvText = (name: string, text: string) => {
    setFileName(name);
    const lines = text
      .split(/\r\n|\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setErrorMessage('CSV file is empty or missing data rows.');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
    const rawRows = lines.slice(1).map((line) =>
      line.split(',').map((cell) => cell.replace(/^["']|["']$/g, '').trim())
    );

    setCsvHeaders(headers);
    setCsvRawRows(rawRows);

    // Auto-detect alias for fleet_name, fleet, or name
    const detected = headers.find((h) => {
      const lower = h.toLowerCase();
      return lower === 'fleet_name' || lower === 'fleet' || lower === 'name';
    });
    setSelectedNameHeader(detected || headers[0]);
    setStage(2);
  };

  const handleProceedToValidation = () => {
    if (!selectedNameHeader) {
      setErrorMessage('Please select a column header for Fleet Name.');
      return;
    }

    const colIndex = csvHeaders.indexOf(selectedNameHeader);
    if (colIndex === -1) {
      setErrorMessage('Invalid column selection.');
      return;
    }

    const existingNames = new Set(existingFleets.map((f) => f.name.toLowerCase().trim()));
    const seenInFile = new Set<string>();

    const rows: ParsedImportRow[] = csvRawRows.map((row, idx) => {
      const rowNum = idx + 2;
      const rawName = (row[colIndex] || '').trim();

      if (!rawName) {
        return {
          rowNum,
          rawName: '—',
          isValid: false,
          reason: 'Missing fleet name',
          selected: false
        };
      }

      if (rawName.length > 191) {
        return {
          rowNum,
          rawName,
          isValid: false,
          reason: 'Name exceeds 191 characters',
          selected: false
        };
      }

      const lowerName = rawName.toLowerCase();
      if (existingNames.has(lowerName)) {
        return {
          rowNum,
          rawName,
          isValid: false,
          reason: 'Duplicate name (already exists in directory)',
          selected: false
        };
      }

      if (seenInFile.has(lowerName)) {
        return {
          rowNum,
          rawName,
          isValid: false,
          reason: 'Duplicate name within this import file',
          selected: false
        };
      }

      seenInFile.add(lowerName);
      return {
        rowNum,
        rawName,
        isValid: true,
        selected: true
      };
    });

    setParsedRows(rows);
    setStage(3);
  };

  const handleToggleRowSelection = (rowNum: number) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.rowNum === rowNum && r.isValid ? { ...r, selected: !r.selected } : r))
    );
  };

  const handleToggleSelectAllValid = () => {
    const anyUnselected = parsedRows.some((r) => r.isValid && !r.selected);
    setParsedRows((prev) =>
      prev.map((r) => (r.isValid ? { ...r, selected: anyUnselected } : r))
    );
  };

  const handleExecuteImport = () => {
    const validSelected = parsedRows.filter((r) => r.isValid && r.selected);
    if (validSelected.length === 0) return;

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    const newFleets: Fleet[] = validSelected.map((r, idx) => ({
      id: `flt-imp-${Date.now()}-${idx}`,
      public_id: `FLT-${Math.floor(2000 + Math.random() * 8000)}`,
      name: r.rawName,
      company: 'Adani Port',
      parent: '',
      service_area: '',
      zone: '',
      vendor: '',
      status: 'active',
      task: '',
      driverIds: [],
      vehicleIds: [],
      driverVehicleAssignments: {},
      created_at: nowStr,
      updated_at: nowStr
    }));

    onImportComplete(newFleets);
    setImportedCount(newFleets.length);
    setStage(4);
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const selectedValidCount = parsedRows.filter((r) => r.isValid && r.selected).length;

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-6 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col max-h-[85vh] font-sans text-xs">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#FA8A63] flex items-center justify-center font-bold">
              <Upload size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Import fleets</h3>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span className={stage === 1 ? 'text-[#FA8A63] font-bold' : ''}>1 Source</span>
                <span>•</span>
                <span className={stage === 2 ? 'text-[#FA8A63] font-bold' : ''}>2 Map fields</span>
                <span>•</span>
                <span className={stage === 3 ? 'text-[#FA8A63] font-bold' : ''}>3 Review</span>
                <span>•</span>
                <span className={stage === 4 ? 'text-[#FA8A63] font-bold' : ''}>4 Complete</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {errorMessage && (
          <div className="m-4 mb-0 p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STAGE 1: SOURCE */}
        {stage === 1 && (
          <div className="p-6 space-y-5 flex-1 overflow-y-auto">
            <div className="border-2 border-dashed border-slate-200 hover:border-[#FA8A63] rounded-xl p-8 text-center space-y-3 bg-slate-50/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-white shadow-2xs border border-slate-200 flex items-center justify-center mx-auto text-[#FA8A63]">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Choose a CSV file to upload</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Headers accepted: <code className="bg-slate-200 px-1 py-0.2 rounded font-mono">fleet_name</code>, <code className="bg-slate-200 px-1 py-0.2 rounded font-mono">fleet</code>, or <code className="bg-slate-200 px-1 py-0.2 rounded font-mono">name</code>
                </p>
              </div>
              <div>
                <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FA8A63] hover:bg-[#e77a54] text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer transition-colors">
                  <Upload size={14} />
                  <span>Browse CSV file</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="font-semibold text-slate-800 block">Need a starter template?</span>
                <span className="text-[11px] text-slate-500">
                  Download standard template or test with our demo file
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold transition-colors"
                >
                  <Download size={13} />
                  <span>Download template</span>
                </button>
                <button
                  type="button"
                  onClick={handleUseDemoFile}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-[#FA8A63] font-semibold transition-colors"
                >
                  <Sparkles size={13} />
                  <span>Use demo file</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
              <strong>Name-only contract:</strong> Fleet CSV import creates groupings with Fleet Name and Active status under current workspace. Other columns, parent hierarchies, and member assignments are safely ignored.
            </div>
          </div>
        )}

        {/* STAGE 2: MAP FIELDS */}
        {stage === 2 && (
          <div className="p-6 space-y-5 flex-1 overflow-y-auto">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-800 block">File: {fileName}</span>
                <span className="text-[11px] text-slate-500">{csvRawRows.length} data rows found</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                Valid CSV Structure
              </span>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-slate-800 flex items-center gap-1">
                <span>Fleet Name source column</span>
                <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedNameHeader}
                onChange={(e) => setSelectedNameHeader(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-[#FA8A63]"
              >
                {csvHeaders.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Only the Fleet Name field is imported. Secondary columns from CSV are skipped by contract.
              </p>
            </div>
          </div>
        )}

        {/* STAGE 3: REVIEW / VALIDATE */}
        {stage === 3 && (
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <span>
                Total: <strong>{parsedRows.length}</strong> rows • Eligible:{' '}
                <strong className="text-emerald-700">{validCount}</strong> • Attention:{' '}
                <strong className="text-red-600">{parsedRows.length - validCount}</strong>
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAllValid}
                className="text-[#FA8A63] font-bold hover:underline cursor-pointer"
              >
                Toggle select all eligible
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 sticky top-0 font-bold text-[11px]">
                  <tr>
                    <th className="w-10 px-3 py-2 text-center"></th>
                    <th className="w-14 px-2 py-2">Row</th>
                    <th className="px-3 py-2">Fleet Name</th>
                    <th className="px-3 py-2">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r) => (
                    <tr
                      key={r.rowNum}
                      className={r.isValid ? 'hover:bg-slate-50/60' : 'bg-red-50/30'}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          disabled={!r.isValid}
                          checked={r.selected}
                          onChange={() => handleToggleRowSelection(r.rowNum)}
                          className="w-3.5 h-3.5 text-[#FA8A63] rounded border-slate-300"
                        />
                      </td>
                      <td className="px-2 py-2 font-mono text-slate-400 text-[11px]">{r.rowNum}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{r.rawName}</td>
                      <td className="px-3 py-2">
                        {r.isValid ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                            <CheckCircle2 size={12} />
                            Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 font-medium text-[11px]">
                            <AlertCircle size={12} />
                            {r.reason}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STAGE 4: COMPLETE */}
        {stage === 4 && (
          <div className="p-8 text-center space-y-4 flex-1">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">Import complete</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                <strong className="text-slate-800 font-bold">{importedCount} fleet(s)</strong> created successfully in this local prototype.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 max-w-sm mx-auto text-left">
              Drivers and Vehicles are assigned later in the Fleet Details drawer.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {stage === 1 ? (
            <div></div>
          ) : stage === 2 ? (
            <button
              type="button"
              onClick={() => setStage(1)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-semibold"
            >
              <ArrowLeft size={13} />
              <span>Back</span>
            </button>
          ) : stage === 3 ? (
            <button
              type="button"
              onClick={() => setStage(2)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-semibold"
            >
              <ArrowLeft size={13} />
              <span>Back to mapping</span>
            </button>
          ) : (
            <div></div>
          )}

          <div className="flex items-center gap-2">
            {stage < 4 && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
            )}

            {stage === 2 && (
              <button
                type="button"
                onClick={handleProceedToValidation}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FA8A63] hover:bg-[#e77a54] text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                <span>Validate rows</span>
                <ArrowRight size={13} />
              </button>
            )}

            {stage === 3 && (
              <button
                type="button"
                disabled={selectedValidCount === 0}
                onClick={handleExecuteImport}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-[#FA8A63] hover:bg-[#e77a54] text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-50"
              >
                <Upload size={13} />
                <span>Import {selectedValidCount} fleet(s)</span>
              </button>
            )}

            {stage === 4 && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-[#FA8A63] hover:bg-[#e77a54] text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
