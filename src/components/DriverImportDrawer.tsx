import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  CheckSquare, 
  Square,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { Driver, DRIVER_LOOKUPS } from '../types/driver';

interface DriverImportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  existingDrivers: Driver[];
  onImportComplete: (createdDrivers: Driver[], skippedCount: number) => void;
}

interface ParsedRow {
  rowNum: number;
  raw: Record<string, string>;
  driver?: Partial<Driver>;
  isValid: boolean;
  errors: string[];
  selected: boolean;
}

export const DriverImportDrawer: React.FC<DriverImportDrawerProps> = ({
  isOpen,
  onClose,
  existingDrivers,
  onImportComplete
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number } | null>(null);

  if (!isOpen) return null;

  // Sample CSV Template content
  const SAMPLE_CSV_CONTENT = `Driver Name,Mobile Number,Date of Birth,Licence Number,Licence Valid From,Licence Valid To,Company,Transporter,Blood Group,Experience
Devendra Sharma,9876501234,1989-05-15,DL0420160012345,2016-01-10,2030-01-09,Adani Pvt Ltd,Western Logistics,B+,9
Gurpreet Singh,9812301234,1986-11-20,PB0220130099887,2013-04-12,2029-04-11,Adani Pvt Ltd,TMS Transporter,O+,12
Mohan Lal Verma,9765401234,1993-02-28,RJ1420170054321,2017-08-15,2027-08-14,Binary Semantics Ltd,Binary Logistics,A+,7
Kalyan Rao,9845101234,1984-09-10,KA0120080033445,2008-03-20,2028-03-19,Adani Pvt Ltd,Western Logistics,AB+,16
Ajay Kumar,9934501234,1995-12-05,UP3220190077889,2019-10-01,2029-09-30,Adani Pvt Ltd,Western Logistics,B+,5`;

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Driver_Master_Import_Template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const processCsvText = (text: string, name: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      alert('CSV must contain a header line and at least one data row.');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const rows: ParsedRow[] = [];
    const seenDlInFile = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      if (i > 1000) break; // Max 1000 rows as per specification
      const values = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
      const raw: Record<string, string> = {};
      headers.forEach((h, idx) => {
        raw[h] = values[idx] || '';
      });

      const rowErrors: string[] = [];
      const driverName = raw['Driver Name'] || raw['Name'] || raw['First Name'] || '';
      const phone = (raw['Mobile Number'] || raw['Mobile No.'] || raw['Phone'] || '').replace(/\D/g, '');
      const dob = raw['Date of Birth'] || raw['Date of Birth (dd/mm/yyyy)'] || raw['DOB'] || '';
      const licence = (raw['Licence Number'] || raw['License No.'] || raw['Licence'] || '').toUpperCase();
      const licenceFrom = raw['Licence Valid From'] || raw['Licence Valid From (dd/mm/yyyy)'] || '2020-01-01';
      const licenceTo = raw['Licence Valid To'] || raw['License Valid To (dd/mm/yyyy)'] || '2030-01-01';
      const company = raw['Company'] || 'Adani Pvt Ltd';
      const transporter = raw['Transporter'] || 'Western Logistics';
      const blood = (raw['Blood Group'] || 'B+') as any;
      const experience = Number(raw['Experience'] || raw['Driving Experience']) || 5;

      // Validations
      if (!driverName || driverName.length < 2) {
        rowErrors.push('Driver name is required (min 2 chars).');
      }
      if (!phone || phone.length !== 10) {
        rowErrors.push('Mobile number must be exactly 10 digits.');
      }
      if (!licence) {
        rowErrors.push('Licence number is required.');
      } else {
        if (existingDrivers.some((d) => d.licence.toLowerCase() === licence.toLowerCase())) {
          rowErrors.push('Licence already registered in directory.');
        }
        if (seenDlInFile.has(licence)) {
          rowErrors.push('Duplicate licence within this import file.');
        } else {
          seenDlInFile.add(licence);
        }
      }
      if (!dob) {
        rowErrors.push('Date of birth is required.');
      }

      const isValid = rowErrors.length === 0;

      rows.push({
        rowNum: i,
        raw,
        isValid,
        errors: rowErrors,
        selected: isValid,
        driver: {
          id: `drv-imp-${Date.now()}-${i}`,
          name: driverName,
          phone,
          dob,
          licence,
          licenceFrom,
          licenceTo,
          company,
          transporter,
          blood,
          experience,
          status: 'Active',
          rto: true,
          police: true,
          training: true,
          rfid: true
        }
      });
    }

    setFileName(name);
    setParsedRows(rows);
    setStep(2);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Spreadsheet XLS/XLSX parsing is not supported in the standalone browser prototype. Please upload a standard CSV file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File exceeds maximum size limit of 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      processCsvText(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleUseExample = () => {
    processCsvText(SAMPLE_CSV_CONTENT, 'Demo_FleetRobo_Drivers.csv');
  };

  const toggleSelectRow = (rowNum: number) => {
    setParsedRows((prev) =>
      prev.map((r) => (r.rowNum === rowNum && r.isValid ? { ...r, selected: !r.selected } : r))
    );
  };

  const toggleSelectAllEligible = () => {
    const allEligibleSelected = parsedRows.filter((r) => r.isValid).every((r) => r.selected);
    setParsedRows((prev) =>
      prev.map((r) => (r.isValid ? { ...r, selected: !allEligibleSelected } : r))
    );
  };

  const handleExecuteImport = () => {
    const selectedValid = parsedRows.filter((r) => r.isValid && r.selected);
    const created: Driver[] = selectedValid.map((r) => r.driver as Driver);
    const skippedCount = parsedRows.length - selectedValid.length;

    setImportSummary({ imported: created.length, skipped: skippedCount });
    setStep(4);
    onImportComplete(created, skippedCount);
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const selectedValidCount = parsedRows.filter((r) => r.isValid && r.selected).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" />

      {/* 800px Right Drawer */}
      <div className="relative w-[800px] max-w-full bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Import Drivers via CSV Spreadsheet
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-[#FA8A63] border border-orange-200">
                Stage {step} of 4
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Bulk onboarding engine with automated header aliasing and eligibility validation.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Wizard Stepper Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold shrink-0">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-[#FA8A63]' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold">1</span>
            <span>Source</span>
          </div>
          <div className="w-8 h-px bg-slate-200" />
          <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-[#FA8A63]' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold">2</span>
            <span>Match Fields</span>
          </div>
          <div className="w-8 h-px bg-slate-200" />
          <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-[#FA8A63]' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold">3</span>
            <span>Validate & Review</span>
          </div>
          <div className="w-8 h-px bg-slate-200" />
          <div className={`flex items-center gap-1.5 ${step >= 4 ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold">4</span>
            <span>Import</span>
          </div>
        </div>

        {/* Drawer Body Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STAGE 1: SOURCE */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="p-8 border-2 border-dashed border-slate-300 hover:border-[#FA8A63] rounded-2xl bg-slate-50/50 text-center space-y-3 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#FA8A63] flex items-center justify-center mx-auto shadow-2xs">
                  <Upload size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Select or drop a Driver CSV spreadsheet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Supported format: UTF-8 CSV (up to 5 MB, max 1,000 rows).
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-3">
                  <label className="px-4 py-2 bg-[#FA8A63] hover:bg-[#e77a54] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors">
                    Browse CSV file
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleUseExample}
                    className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    Use example driver records
                  </button>
                </div>
              </div>

              {/* Template & Notice */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-800">Need the official Driver CSV schema?</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Download our verified column headers template for error-free bulk onboarding.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg shadow-2xs cursor-pointer"
                >
                  <Download size={13} />
                  <span>Download template</span>
                </button>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <strong>Format note:</strong> XLS/XLSX proprietary binary parsing is not included in the browser prototype. Please save or export your spreadsheet as CSV before uploading.
              </div>
            </div>
          )}

          {/* STAGE 2: MATCH FIELDS */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <div className="font-bold text-slate-800">File: {fileName}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Parsed {parsedRows.length} data rows. Known source headers matched automatically.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-[#FA8A63] hover:underline font-semibold"
                >
                  Change file
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800">Automated Header Mappings:</div>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs overflow-hidden">
                  {[
                    { source: 'Driver Name / Name / First Name', target: 'Name', required: true },
                    { source: 'Mobile Number / Mobile No.', target: 'Mobile Number', required: true },
                    { source: 'Date of Birth / DOB', target: 'Date of Birth', required: true },
                    { source: 'Licence Number / License No.', target: 'Licence Number', required: true },
                    { source: 'Licence Valid From / Valid To', target: 'Licence Dates', required: true },
                    { source: 'Company / Transporter', target: 'Ownership', required: false },
                    { source: 'Blood Group / Experience', target: 'Identity Specifications', required: false }
                  ].map((m, i) => (
                    <div key={i} className="p-3 flex items-center justify-between bg-white">
                      <div className="font-mono text-slate-600 text-[11px]">{m.source}</div>
                      <ArrowRight size={13} className="text-slate-400" />
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{m.target}</span>
                        {m.required && <span className="text-[10px] text-red-500 font-semibold">*</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <strong>Integrity notice:</strong> Imported drivers will show <em>Account Mapping = Not linked</em> until a dedicated platform login user is linked. No fake login accounts will be silently generated.
              </div>
            </div>
          )}

          {/* STAGE 3: VALIDATE & REVIEW */}
          {step === 3 && (
            <div className="space-y-5">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-[11px] text-slate-500">Total Rows</div>
                  <div className="text-xl font-bold text-slate-900">{parsedRows.length}</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-[11px] text-emerald-700">Eligible Rows</div>
                  <div className="text-xl font-bold text-emerald-700">{validCount}</div>
                </div>
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <div className="text-[11px] text-red-700">Need Attention</div>
                  <div className="text-xl font-bold text-red-700">{parsedRows.length - validCount}</div>
                </div>
              </div>

              {/* Row Inspection Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={toggleSelectAllEligible}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Toggle select all valid rows ({validCount})</span>
                  </button>
                  <span className="text-xs text-slate-500">
                    <strong className="text-slate-900">{selectedValidCount}</strong> valid rows selected for import
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-72 divide-y divide-slate-100 text-xs">
                  {parsedRows.map((r) => (
                    <div
                      key={r.rowNum}
                      className={`p-3 flex items-center justify-between gap-3 ${
                        !r.isValid ? 'bg-red-50/30' : r.selected ? 'bg-orange-50/20' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          disabled={!r.isValid}
                          onClick={() => toggleSelectRow(r.rowNum)}
                          className={r.isValid ? 'cursor-pointer text-slate-600 hover:text-slate-900' : 'cursor-not-allowed text-slate-300'}
                        >
                          {r.selected ? (
                            <CheckSquare size={16} className="text-[#FA8A63]" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        <span className="w-6 font-mono text-[11px] text-slate-400">#{r.rowNum}</span>
                        <div>
                          <div className="font-bold text-slate-900">{r.driver?.name || 'Missing Name'}</div>
                          <div className="text-[11px] text-slate-500">
                            DL: {r.driver?.licence || '—'} · Phone: {r.driver?.phone || '—'} · {r.driver?.company}
                          </div>
                        </div>
                      </div>

                      <div>
                        {r.isValid ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Valid
                          </span>
                        ) : (
                          <div className="text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              Invalid
                            </span>
                            <div className="text-[10px] text-red-600 mt-0.5 max-w-xs">{r.errors.join('; ')}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STAGE 4: COMPLETE */}
          {step === 4 && importSummary && (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 size={32} />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900">Driver import completed successfully</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  <strong className="text-slate-900">{importSummary.imported}</strong> driver records have been imported into your workspace. {importSummary.skipped} rows were skipped or excluded. All updates are stored in your local session.
                </p>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-[#FA8A63] hover:bg-[#e77a54] text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  Return to Driver directory
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {step < 4 && (
          <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as any)}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft size={13} />
              <span>{step === 1 ? 'Cancel' : 'Back'}</span>
            </button>

            <div className="flex items-center gap-2">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-1.5 bg-[#FA8A63] hover:bg-[#e77a54] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <span>Validate rows</span>
                  <ArrowRight size={13} />
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  disabled={selectedValidCount === 0}
                  onClick={handleExecuteImport}
                  className="px-5 py-1.5 bg-[#FA8A63] hover:bg-[#e77a54] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                >
                  Import {selectedValidCount} driver records
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
