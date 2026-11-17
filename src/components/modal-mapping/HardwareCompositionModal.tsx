import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Plus,
  Search,
  Cpu,
  Radio,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Infinity as InfinityIcon,
  Clock,
  Link2
} from 'lucide-react';
import {
  HardwareCategory,
  HardwareMembership,
  HardwareBinding,
  HardwareBindingMode,
  DeviceRecord,
  SensorRecord,
  SimRecord,
  SUPPORTED_TIMEZONES,
  MODAL_FIELD_TOOLTIPS,
  resolveHardwareIdentifierValue,
  validateHardwareBindingPair,
  formatDateTimeWithTz,
  formatLocalInputParts,
  buildIsoWithTimezone
} from '../../types/modalMaster';
import { ModelCategoryRecord, getRecordIdentifierTypes } from '../../types/modelCategoryMaster';
import { MappingInfoTooltip } from './ModalConnectionOverlays';

export interface BindingDefaults {
  mode: HardwareBindingMode;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;
}

export interface HardwareCompositionSaveResult {
  newMember?: HardwareMembership;
  newBinding?: HardwareBinding;
  updatedBinding?: HardwareBinding;
  registeredDevice?: DeviceRecord;
  registeredSensor?: SensorRecord;
  registeredSim?: SimRecord;
  usedDefaults: BindingDefaults;
}

interface HardwareCompositionModalProps {
  mode: 'add-hardware' | 'edit-binding';
  category: HardwareCategory;
  initialParentId?: string | null;
  editingBinding?: HardwareBinding | null;
  connId: string;
  targetClient: string;
  site: string;
  enabledModels: ModelCategoryRecord[];
  members: HardwareMembership[];
  draftBindings: HardwareBinding[];
  allGlobalBindings: HardwareBinding[];
  allConnections: { id: string; name: string; companyName: string; status: string; memberIds: string[] }[];
  localDevices: DeviceRecord[];
  localSensors: SensorRecord[];
  localSims: SimRecord[];
  defaultBinding: BindingDefaults;
  onQuickRegisterHardware?: (unit: {
    device?: DeviceRecord;
    sensor?: SensorRecord;
    sim?: SimRecord;
  }) => void;
  onSave: (result: HardwareCompositionSaveResult, keepOpenAction?: 'add-sensor' | 'add-sim') => void;
  onClose: () => void;
}

export const HardwareCompositionModal: React.FC<HardwareCompositionModalProps> = ({
  mode,
  category,
  initialParentId = null,
  editingBinding = null,
  connId,
  targetClient,
  site,
  enabledModels,
  members,
  draftBindings,
  allGlobalBindings,
  allConnections,
  localDevices,
  localSensors,
  localSims,
  defaultBinding,
  onQuickRegisterHardware,
  onSave,
  onClose
}) => {
  const isEditingBinding = mode === 'edit-binding' && !!editingBinding;

  // Parent selection ("Connected To")
  const deviceMembers = useMemo(() => members.filter((m) => m.category === 'Device'), [members]);
  const simParentMembers = useMemo(
    () => members.filter((m) => m.category === 'Device' || m.category === 'Sensor'),
    [members]
  );
  const [parentHardwareId, setParentHardwareId] = useState<string>(() => {
    if (isEditingBinding && editingBinding) return editingBinding.fromHardwareId;
    if (initialParentId) return initialParentId;
    if (category === 'SIM' && simParentMembers.length > 0) return simParentMembers[0].hardwareId;
    return '';
  });

  // Model selector state (searchable combobox)
  const categoryModels = useMemo(
    () => enabledModels.filter((m) => m.category === category),
    [enabledModels, category]
  );
  const [modelSearch, setModelSearch] = useState('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>(() => categoryModels[0]?.id || '');

  const filteredModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    if (!q) return categoryModels;
    return categoryModels.filter((m) =>
      [m.typeName, m.manufacturer, m.modelReference, m.identifierType, m.deviceFunction]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [categoryModels, modelSearch]);

  const activeModelDef = useMemo(
    () => categoryModels.find((m) => m.id === selectedModelId) || categoryModels[0] || null,
    [categoryModels, selectedModelId]
  );

  const activeIdentifierTypes = useMemo(
    () => getRecordIdentifierTypes(activeModelDef),
    [activeModelDef]
  );
  const activeIdentifierLabel =
    activeIdentifierTypes.join(' / ') || activeModelDef?.identifierType || 'ID';

  // Hardware search & selection
  const [idSearchQuery, setIdSearchQuery] = useState('');
  const [selectedHardwareId, setSelectedHardwareId] = useState<string>(() =>
    isEditingBinding && editingBinding ? editingBinding.toHardwareId : ''
  );

  // Inline registration form when identifier not found or user clicks Create & Register
  const [showRegisterInline, setShowRegisterInline] = useState(false);
  const [regIdValue, setRegIdValue] = useState('');
  const [regSerialValue, setRegSerialValue] = useState('');
  const [regNameValue, setRegNameValue] = useState('');
  const [regLocationValue, setRegLocationValue] = useState(site || 'Mundra CT2');
  const [regLifecycle, setRegLifecycle] = useState<'Inventory' | 'Active'>('Inventory');
  const [regSimOperator, setRegSimOperator] = useState('Airtel');
  const [regSimMsisdn, setRegSimMsisdn] = useState('');
  const [regSimFormFactor, setRegSimFormFactor] = useState<'Nano (4FF)' | 'Micro (3FF)' | 'Standard (2FF)' | 'eSIM'>('Nano (4FF)');
  const [regSimPlan, setRegSimPlan] = useState('IoT Business 10GB');
  const [regError, setRegError] = useState<string | null>(null);
  const [pendingRegisteredUnit, setPendingRegisteredUnit] = useState<{
    device?: DeviceRecord;
    sensor?: SensorRecord;
    sim?: SimRecord;
  } | null>(null);

  // Binding validity state
  const [portOrSlot, setPortOrSlot] = useState<string>(() =>
    isEditingBinding && editingBinding ? editingBinding.portOrSlot || '' : ''
  );
  const [bMode, setBMode] = useState<HardwareBindingMode>(() =>
    isEditingBinding && editingBinding ? editingBinding.mode : defaultBinding.mode
  );
  const [bTimezone, setBTimezone] = useState<string>(() =>
    isEditingBinding && editingBinding ? editingBinding.timezone || 'Asia/Kolkata' : defaultBinding.timezone
  );
  const [bStartDate, setBStartDate] = useState<string>(() => {
    if (isEditingBinding && editingBinding) {
      return formatLocalInputParts(editingBinding.effectiveStartAt, editingBinding.timezone).date || defaultBinding.startDate;
    }
    return defaultBinding.startDate;
  });
  const [bStartTime, setBStartTime] = useState<string>(() => {
    if (isEditingBinding && editingBinding) {
      return formatLocalInputParts(editingBinding.effectiveStartAt, editingBinding.timezone).time || defaultBinding.startTime;
    }
    return defaultBinding.startTime;
  });
  const [bEndDate, setBEndDate] = useState<string>(() => {
    if (isEditingBinding && editingBinding?.effectiveEndAt) {
      return formatLocalInputParts(editingBinding.effectiveEndAt, editingBinding.timezone).date || defaultBinding.endDate;
    }
    return defaultBinding.endDate;
  });
  const [bEndTime, setBEndTime] = useState<string>(() => {
    if (isEditingBinding && editingBinding?.effectiveEndAt) {
      return formatLocalInputParts(editingBinding.effectiveEndAt, editingBinding.timezone).time || defaultBinding.endTime;
    }
    return defaultBinding.endTime;
  });
  const [bNotes, setBNotes] = useState<string>(() =>
    isEditingBinding && editingBinding ? editingBinding.notes || '' : ''
  );
  const [localError, setLocalError] = useState<string | null>(null);

  // Track effective local pool (includes any inline newly registered unit)
  const effectiveDevices = useMemo(
    () => (pendingRegisteredUnit?.device ? [pendingRegisteredUnit.device, ...localDevices] : localDevices),
    [pendingRegisteredUnit, localDevices]
  );
  const effectiveSensors = useMemo(
    () => (pendingRegisteredUnit?.sensor ? [pendingRegisteredUnit.sensor, ...localSensors] : localSensors),
    [pendingRegisteredUnit, localSensors]
  );
  const effectiveSims = useMemo(
    () => (pendingRegisteredUnit?.sim ? [pendingRegisteredUnit.sim, ...localSims] : localSims),
    [pendingRegisteredUnit, localSims]
  );

  // Parent device capability metadata
  const parentMember = useMemo(
    () => members.find((m) => m.hardwareId === parentHardwareId) || null,
    [members, parentHardwareId]
  );
  const parentDeviceRecord = useMemo(
    () => effectiveDevices.find((d) => d.id === parentHardwareId) || null,
    [effectiveDevices, parentHardwareId]
  );
  const parentSensorRecord = useMemo(
    () => effectiveSensors.find((s) => s.id === parentHardwareId) || null,
    [effectiveSensors, parentHardwareId]
  );

  const availablePortsForParent = useMemo(() => {
    if (category === 'SIM' && parentSensorRecord) {
      return ['SIM Slot 1'];
    }
    if (!parentDeviceRecord) return [];
    const ports = parentDeviceRecord.supportedPorts || [];
    if (category === 'SIM') {
      return ports.filter((p) => p.toLowerCase().includes('sim'));
    }
    return ports.filter((p) => !p.toLowerCase().includes('sim'));
  }, [parentDeviceRecord, parentSensorRecord, category]);

  // Suggest next unoccupied port automatically when parent/category changes
  useEffect(() => {
    if (isEditingBinding || !parentHardwareId || availablePortsForParent.length === 0) return;
    if (portOrSlot && availablePortsForParent.includes(portOrSlot)) return;
    const occupiedPorts = new Set(
      draftBindings
        .filter((b) => !b.endedAt && b.fromHardwareId === parentHardwareId && b.portOrSlot)
        .map((b) => b.portOrSlot!)
    );
    const freePort = availablePortsForParent.find((p) => !occupiedPorts.has(p)) || '';
    if (freePort) setPortOrSlot(freePort);
  }, [parentHardwareId, availablePortsForParent, draftBindings, isEditingBinding, portOrSlot]);

  // Existing binding inspection helper across all connections
  const getExistingHardwareAssignments = (hwId: string) => {
    const activeBindings = allGlobalBindings.filter(
      (b) => !b.endedAt && b.statusOverride !== 'Canceled' && (b.toHardwareId === hwId || b.fromHardwareId === hwId)
    );
    const activeConns = allConnections.filter(
      (c) => c.id !== connId && (c.status === 'Active' || c.status === 'Scheduled') && c.memberIds.includes(hwId)
    );
    return { activeBindings, activeConns };
  };

  // Matching client-owned hardware units
  const matchingUnits = useMemo(() => {
    if (isEditingBinding || !activeModelDef) return [];
    const q = idSearchQuery.trim().toLowerCase();
    const clientLower = targetClient.trim().toLowerCase();

    if (category === 'Device') {
      return effectiveDevices
        .filter((d) => {
          if ((d.company || '').trim().toLowerCase() !== clientLower) return false;
          const matchesModel =
            d.modelTypeId === activeModelDef.id ||
            d.kind.toLowerCase().includes(activeModelDef.typeName.toLowerCase()) ||
            (activeModelDef.modelReference &&
              d.modelText.toLowerCase().includes(activeModelDef.modelReference.toLowerCase()));
          if (!matchesModel) return false;
          const ident = resolveHardwareIdentifierValue(d, 'Device', activeModelDef.identifierType);
          return (
            !q ||
            ident.toLowerCase().includes(q) ||
            d.deviceId.toLowerCase().includes(q) ||
            d.serial.toLowerCase().includes(q) ||
            d.imei.toLowerCase().includes(q) ||
            d.name.toLowerCase().includes(q)
          );
        })
        .slice(0, 18)
        .map((d) => ({
          hardwareId: d.id,
          code: d.deviceId,
          identifierValue: resolveHardwareIdentifierValue(d, 'Device', activeModelDef.identifierType),
          manufacturer: d.manufacturer,
          modelText: d.modelText,
          subtitle: `${d.deviceId} · ${d.manufacturer} ${d.modelText}`,
          status: d.hardwareLifecycle,
          simSlots: d.simSlots || 0
        }));
    }

    if (category === 'Sensor') {
      return effectiveSensors
        .filter((s) => {
          if ((s.company || '').trim().toLowerCase() !== clientLower) return false;
          const matchesModel =
            s.modelTypeId === activeModelDef.id ||
            s.kind.toLowerCase().includes(activeModelDef.typeName.toLowerCase().replace(' level', ''));
          if (!matchesModel) return false;
          const ident = resolveHardwareIdentifierValue(s, 'Sensor', activeModelDef.identifierType);
          return (
            !q ||
            ident.toLowerCase().includes(q) ||
            s.deviceId.toLowerCase().includes(q) ||
            s.serial.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q)
          );
        })
        .slice(0, 18)
        .map((s) => ({
          hardwareId: s.id,
          code: s.deviceId,
          identifierValue: resolveHardwareIdentifierValue(s, 'Sensor', activeModelDef.identifierType),
          manufacturer: s.manufacturer,
          modelText: s.modelText,
          subtitle: `${s.deviceId} · ${s.manufacturer} ${s.modelText}`,
          status: s.hardwareLifecycle,
          simSlots: 0
        }));
    }

    return effectiveSims
      .filter((sim) => {
        if ((sim.owner || '').trim().toLowerCase() !== clientLower) return false;
        const matchesModel =
          sim.modelTypeId === activeModelDef.id ||
          (sim.category || '').toLowerCase() === activeModelDef.typeName.toLowerCase();
        if (!matchesModel) return false;
        return (
          !q ||
          sim.iccid.toLowerCase().includes(q) ||
          sim.id.toLowerCase().includes(q) ||
          sim.msisdn.toLowerCase().includes(q) ||
          sim.operator.toLowerCase().includes(q)
        );
      })
      .slice(0, 18)
      .map((sim) => ({
        hardwareId: sim.id,
        code: sim.id,
        identifierValue: sim.iccid,
        manufacturer: sim.operator,
        modelText: `${sim.formFactor} · ${sim.plan}`,
        subtitle: `${sim.operator} · ${sim.formFactor} · ${sim.msisdn || 'No MSISDN'}`,
        status: sim.status,
        simSlots: 0
      }));
  }, [
    isEditingBinding,
    activeModelDef,
    idSearchQuery,
    targetClient,
    category,
    effectiveDevices,
    effectiveSensors,
    effectiveSims
  ]);

  const selectedUnitSummary = useMemo(
    () => matchingUnits.find((u) => u.hardwareId === selectedHardwareId) || null,
    [matchingUnits, selectedHardwareId]
  );

  // Cross-client guard when searching
  const crossTenantConflict = useMemo(() => {
    const q = idSearchQuery.trim().toLowerCase();
    if (!q || q.length < 4 || isEditingBinding) return null;
    const clientLower = targetClient.trim().toLowerCase();
    if (category === 'Device') {
      const f = effectiveDevices.find(
        (d) =>
          (d.company || '').trim().toLowerCase() !== clientLower &&
          (d.imei.toLowerCase() === q || d.serial.toLowerCase() === q || d.deviceId.toLowerCase() === q)
      );
      return f ? `Identifier "${idSearchQuery.trim()}" belongs to ${f.company}. Cross-client selection is blocked.` : null;
    }
    if (category === 'Sensor') {
      const f = effectiveSensors.find(
        (s) =>
          (s.company || '').trim().toLowerCase() !== clientLower &&
          (s.deviceId.toLowerCase() === q || s.serial.toLowerCase() === q)
      );
      return f ? `Sensor "${idSearchQuery.trim()}" belongs to ${f.company}. Cross-client selection is blocked.` : null;
    }
    const fs = effectiveSims.find(
      (s) => (s.owner || '').trim().toLowerCase() !== clientLower && s.iccid.toLowerCase() === q
    );
    return fs ? `SIM ${activeIdentifierLabel || 'ICCID'} "${idSearchQuery.trim()}" belongs to ${fs.owner}. Cross-client selection is blocked.` : null;
  }, [idSearchQuery, isEditingBinding, targetClient, category, effectiveDevices, effectiveSensors, effectiveSims, activeIdentifierLabel]);

  // Sensor standalone check
  const sensorRequiresParent =
    category === 'Sensor' &&
    activeModelDef?.connectionMode === 'Gateway-connected' &&
    !parentHardwareId;

  // Build candidate membership & validate binding pair live
  const selectedNewMember: HardwareMembership | null = useMemo(() => {
    if (isEditingBinding && editingBinding) {
      return members.find((m) => m.hardwareId === editingBinding.toHardwareId) || null;
    }
    if (!selectedUnitSummary || !activeModelDef) return null;
    const modelLabel = [activeModelDef.typeName, activeModelDef.manufacturer, activeModelDef.modelReference]
      .filter(Boolean)
      .join(' · ');
    return {
      hardwareId: selectedUnitSummary.hardwareId,
      category,
      modelTypeId: activeModelDef.id,
      modelLabel,
      identifierType: activeIdentifierTypes[0] || activeModelDef.identifierType,
      identifierValue:
        category === 'Device' && selectedUnitSummary.code
          ? `${selectedUnitSummary.code}`
          : selectedUnitSummary.identifierValue,
      registrationStatus: selectedUnitSummary.status,
      isPrimary: members.length === 0 && !parentHardwareId
    };
  }, [isEditingBinding, editingBinding, members, selectedUnitSummary, activeModelDef, activeIdentifierTypes, category, parentHardwareId]);

  const liveValidation = useMemo(() => {
    if (!parentHardwareId) {
      if (category === 'SIM') {
        return { errors: ['A SIM must be attached to a registered Device or Sensor.'], warnings: [] };
      }
      if (sensorRequiresParent) {
        return {
          errors: [
            `${activeModelDef?.typeName} is configured as Gateway-connected in Model Category Master. Select a parent Device.`
          ],
          warnings: []
        };
      }
      return { errors: [], warnings: [] };
    }

    const toHwId = isEditingBinding && editingBinding ? editingBinding.toHardwareId : selectedHardwareId;
    if (!toHwId) return { errors: [], warnings: [] };

    const augmentedMembers =
      selectedNewMember && !members.some((m) => m.hardwareId === selectedNewMember.hardwareId)
        ? [...members, selectedNewMember]
        : members;

    const startIso = buildIsoWithTimezone(bStartDate, bStartTime, bTimezone);
    const endIso = bMode === 'Temporal' ? buildIsoWithTimezone(bEndDate, bEndTime, bTimezone) : null;

    const otherGlobal = [
      ...allGlobalBindings.filter((b) => b.connectionId !== connId),
      ...draftBindings
    ];

    return validateHardwareBindingPair(
      {
        id: editingBinding?.id || '__new_inline__',
        connectionId: connId,
        fromHardwareId: parentHardwareId,
        toHardwareId: toHwId,
        mode: bMode,
        effectiveStartAt: startIso,
        effectiveEndAt: endIso,
        timezone: bTimezone,
        portOrSlot: portOrSlot || null
      },
      augmentedMembers,
      draftBindings,
      otherGlobal
    );
  }, [
    parentHardwareId,
    category,
    sensorRequiresParent,
    activeModelDef,
    isEditingBinding,
    editingBinding,
    selectedHardwareId,
    selectedNewMember,
    members,
    bStartDate,
    bStartTime,
    bEndDate,
    bEndTime,
    bMode,
    bTimezone,
    portOrSlot,
    allGlobalBindings,
    connId,
    draftBindings
  ]);

  // Inline quick register when identifier is missing
  const handleInlineRegister = () => {
    if (!activeModelDef) return;
    const val = regIdValue.trim();
    if (!val) {
      setRegError(`Enter ${activeIdentifierLabel} to register.`);
      return;
    }

    const dupDev = effectiveDevices.find(
      (d) =>
        d.imei.toLowerCase() === val.toLowerCase() ||
        d.serial.toLowerCase() === val.toLowerCase() ||
        d.deviceId.toLowerCase() === val.toLowerCase()
    );
    const dupSen = effectiveSensors.find(
      (s) => s.deviceId.toLowerCase() === val.toLowerCase() || s.serial.toLowerCase() === val.toLowerCase()
    );
    const dupSim = effectiveSims.find((s) => s.iccid.toLowerCase() === val.toLowerCase());
    if (dupDev || dupSen || dupSim) {
      setRegError(`Identifier "${val}" already exists in the physical hardware registry.`);
      return;
    }

    const nowDate = new Date().toISOString().slice(0, 10);
    const hasId = (target: string) =>
      activeIdentifierTypes.some((t) => t.toLowerCase() === target.toLowerCase());
    const primaryId = activeIdentifierTypes[0] || activeModelDef.identifierType;

    if (category === 'Device') {
      const newDev: DeviceRecord = {
        id: `dev-reg-${Date.now()}`,
        deviceId: hasId('Device ID') ? val : `DEV-${Date.now().toString().slice(-4)}`,
        name: regNameValue.trim() || `${activeModelDef.typeName} — ${activeModelDef.modelReference || val}`,
        kind: activeModelDef.typeName,
        role: 'gateway',
        manufacturer: activeModelDef.manufacturer || 'Generic',
        modelText: activeModelDef.modelReference || activeModelDef.typeName,
        modelTypeId: activeModelDef.id,
        identifierType: primaryId,
        mode: 'Standard',
        serial:
          regSerialValue.trim() ||
          (hasId('Serial Number') ? val : `SN-${val.slice(-6)}`),
        imei: hasId('IMEI') ? val : '',
        capabilities: activeModelDef.connectivity || ['Cellular'],
        platformProtocol: 'MQTT',
        company: targetClient,
        inventoryLocation: regLocationValue.trim() || site || 'Mundra CT2',
        hardwareLifecycle: regLifecycle,
        registeredAt: nowDate,
        updatedAt: nowDate,
        channelCount: 2,
        simSlots: activeModelDef.simSupported === 'Yes' ? 1 : 0,
        supportedPorts:
          activeModelDef.simSupported === 'Yes'
            ? ['SIM Slot 1', 'BLE-1', 'BLE-2', 'RS485-1']
            : ['ETH-1', 'CH-1'],
        notes: 'Registered inline from Create Mapping'
      };
      setPendingRegisteredUnit({ device: newDev });
      onQuickRegisterHardware?.({ device: newDev });
      setSelectedHardwareId(newDev.id);
    } else if (category === 'Sensor') {
      const newSen: SensorRecord = {
        id: `sen-reg-${Date.now()}`,
        deviceId: val,
        name: regNameValue.trim() || `${activeModelDef.typeName} — ${val}`,
        kind: activeModelDef.typeName,
        role: 'peripheral',
        category: activeModelDef.typeName,
        manufacturer: activeModelDef.manufacturer || 'Generic',
        modelText: activeModelDef.modelReference || activeModelDef.typeName,
        modelTypeId: activeModelDef.id,
        identifierType: primaryId,
        serial: regSerialValue.trim() || `SN-${val}`,
        capabilities: ['BLE'],
        measurementCapability: activeModelDef.measurementType || 'Temperature',
        measurementUnit: activeModelDef.measurementUnit || '°C',
        measurementRange: 'Standard',
        company: targetClient,
        inventoryLocation: regLocationValue.trim() || site || 'Mundra CT2',
        hardwareLifecycle: regLifecycle,
        registeredAt: nowDate,
        updatedAt: nowDate,
        notes: 'Registered inline from Create Mapping'
      };
      setPendingRegisteredUnit({ sensor: newSen });
      onQuickRegisterHardware?.({ sensor: newSen });
      setSelectedHardwareId(newSen.id);
    } else {
      const newSim: SimRecord = {
        id: `SIM-${Date.now().toString().slice(-4)}`,
        iccid: val,
        msisdn: regSimMsisdn.trim(),
        operator: regSimOperator || activeModelDef.manufacturer || 'Airtel',
        plan: regSimPlan || 'IoT Business 10GB',
        formFactor: regSimFormFactor || (activeModelDef.simFormFactor === 'eSIM' ? 'eSIM' : 'Nano (4FF)'),
        network: '4G LTE',
        owner: targetClient,
        location: regLocationValue.trim() || site || 'Mundra CT2',
        status: regLifecycle,
        activationDate: regLifecycle === 'Active' ? nowDate : '',
        renewalDate: '',
        notes: 'Registered inline from Create Mapping',
        category: activeModelDef.typeName,
        modelTypeId: activeModelDef.id,
        identifierType: primaryId || 'ICCID'
      };
      setPendingRegisteredUnit({ sim: newSim });
      onQuickRegisterHardware?.({ sim: newSim });
      setSelectedHardwareId(newSim.id);
    }

    setIdSearchQuery(val);
    setRegIdValue('');
    setRegSerialValue('');
    setRegNameValue('');
    setRegSimMsisdn('');
    setShowRegisterInline(false);
    setRegError(null);
    setLocalError(null);
  };

  const handleCommit = (keepOpenAction?: 'add-sensor' | 'add-sim') => {
    setLocalError(null);

    if (!isEditingBinding && !selectedNewMember) {
      setLocalError(`Search and select a registered ${category} first.`);
      return;
    }

    if (!isEditingBinding && selectedNewMember && members.some((m) => m.hardwareId === selectedNewMember.hardwareId)) {
      setLocalError(`${selectedNewMember.identifierValue} is already added in this connection.`);
      return;
    }

    if (liveValidation.errors.length > 0) {
      setLocalError(liveValidation.errors[0]);
      return;
    }

    // Prevent silently overwriting conflicting active assignments across connections
    if (!isEditingBinding && selectedHardwareId) {
      const { activeBindings } = getExistingHardwareAssignments(selectedHardwareId);
      const startIso = buildIsoWithTimezone(bStartDate, bStartTime, bTimezone);
      const endIso = bMode === 'Temporal' ? buildIsoWithTimezone(bEndDate, bEndTime, bTimezone) : null;
      const conflictOther = activeBindings.find((b) => {
        if (b.connectionId === connId) return false;
        const otherStart = Date.parse(b.effectiveStartAt);
        const otherEnd = b.effectiveEndAt ? Date.parse(b.effectiveEndAt) : Number.POSITIVE_INFINITY;
        const thisStart = Date.parse(startIso);
        const thisEnd = endIso ? Date.parse(endIso) : Number.POSITIVE_INFINITY;
        return thisStart < otherEnd && otherStart < thisEnd;
      });
      if (conflictOther) {
        setLocalError(
          `${category} is actively bound in ${conflictOther.connectionId} (${conflictOther.id}). Choose a non-overlapping future effective window or end the existing binding first.`
        );
        return;
      }
    }

    const usedDefaults: BindingDefaults = {
      mode: bMode,
      startDate: bStartDate,
      startTime: bStartTime,
      endDate: bEndDate,
      endTime: bEndTime,
      timezone: bTimezone
    };

    const nowIso = new Date().toISOString();
    const startIso = buildIsoWithTimezone(bStartDate, bStartTime, bTimezone);
    const endIso = bMode === 'Temporal' ? buildIsoWithTimezone(bEndDate, bEndTime, bTimezone) : null;

    if (isEditingBinding && editingBinding) {
      onSave({
        updatedBinding: {
          ...editingBinding,
          fromHardwareId: parentHardwareId,
          mode: bMode,
          effectiveStartAt: startIso,
          effectiveEndAt: endIso,
          timezone: bTimezone,
          portOrSlot: portOrSlot || null,
          notes: bNotes.trim(),
          updatedAt: nowIso
        },
        usedDefaults
      });
      return;
    }

    const newBinding: HardwareBinding | undefined = parentHardwareId
      ? {
          id: `BND-${3001 + allGlobalBindings.length + draftBindings.length + 1}`,
          connectionId: connId,
          fromHardwareId: parentHardwareId,
          toHardwareId: selectedNewMember!.hardwareId,
          mode: bMode,
          effectiveStartAt: startIso,
          effectiveEndAt: endIso,
          timezone: bTimezone,
          portOrSlot: portOrSlot || null,
          notes: bNotes.trim(),
          createdAt: nowIso,
          updatedAt: nowIso
        }
      : undefined;

    onSave(
      {
        newMember: selectedNewMember!,
        newBinding,
        registeredDevice: pendingRegisteredUnit?.device,
        registeredSensor: pendingRegisteredUnit?.sensor,
        registeredSim: pendingRegisteredUnit?.sim,
        usedDefaults
      },
      keepOpenAction
    );

    if (keepOpenAction) {
      setSelectedHardwareId('');
      setIdSearchQuery('');
      setPendingRegisteredUnit(null);
      setPortOrSlot('');
      setBNotes('');
    }
  };

  const supportsMultipleSims =
    category === 'SIM' && !!parentDeviceRecord && (parentDeviceRecord.simSlots || 0) > 1;

  const CategoryIcon = category === 'Device' ? Cpu : category === 'Sensor' ? Radio : Smartphone;
  const accentPill =
    category === 'Device'
      ? 'bg-sky-50 text-sky-700 border-sky-200'
      : category === 'Sensor'
      ? 'bg-purple-50 text-purple-700 border-purple-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <div className="fixed inset-0 z-[92] flex justify-end bg-slate-900/35 backdrop-blur-[1px]">
      <div className="w-full max-w-[540px] bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
        {/* Compact Drawer Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-8 h-8 rounded-lg border inline-flex items-center justify-center shrink-0 ${accentPill}`}>
              <CategoryIcon className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold text-slate-900 truncate">
                  {isEditingBinding
                    ? `Edit Binding · ${editingBinding?.id}`
                    : `Add ${category}${parentMember ? ` under ${parentMember.identifierValue}` : ''}`}
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {targetClient} · {isEditingBinding ? 'Adjust validity, parent, or port/slot' : 'Select hardware & binding validity together'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-[12px]">
          {localError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{localError}</span>
            </div>
          )}

          {/* Connected To / Parent Hardware Selection */}
          {(((category === 'SIM' ? simParentMembers.length > 0 : deviceMembers.length > 0)) || isEditingBinding) && (
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Link2 className="w-3.5 h-3.5 text-[#F26522]" />
                  Connected To (Parent Hardware)
                </label>
                <MappingInfoTooltip
                  text="Preselected automatically when opened from a Device or Sensor row. Sensors can also be standalone if enabled by their model."
                  align="right"
                />
              </div>

              {initialParentId && parentMember && !isEditingBinding ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-[#F26522]/30">
                  <div className="flex items-center gap-2 min-w-0">
                    {parentMember.category === 'Sensor' ? (
                      <Radio className="w-4 h-4 text-purple-600 shrink-0" />
                    ) : (
                      <Cpu className="w-4 h-4 text-sky-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-slate-900 truncate">{parentMember.identifierValue}</div>
                      <div className="text-[10.5px] text-slate-500 truncate">{parentMember.modelLabel}</div>
                    </div>
                  </div>
                  <span className="text-[10.5px] font-semibold text-[#F26522] shrink-0">Preselected</span>
                </div>
              ) : (
                <select
                  value={parentHardwareId}
                  onChange={(e) => {
                    setParentHardwareId(e.target.value);
                    setPortOrSlot('');
                  }}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-800"
                >
                  {category === 'Device' && !isEditingBinding && (
                    <option value="">Root / Primary Device (No Parent)</option>
                  )}
                  {category === 'Sensor' && !isEditingBinding && (
                    <option value="">Standalone Sensor (No Parent Device)</option>
                  )}
                  {(category === 'SIM' ? simParentMembers : deviceMembers)
                    .filter((d) => !isEditingBinding || d.hardwareId !== editingBinding?.toHardwareId)
                    .map((d) => (
                      <option key={d.hardwareId} value={d.hardwareId}>
                        [{d.category}] {d.identifierValue} — {d.modelLabel}
                      </option>
                    ))}
                </select>
              )}
            </div>
          )}

          {/* Hardware Selection Section (Hidden when only editing an existing binding) */}
          {!isEditingBinding && (
            <div className="space-y-3">
              {categoryModels.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12px]">
                  No <strong>{category}</strong> models are currently enabled for <strong>{targetClient}</strong> in Platform Admin → Company Management → Model Access.
                </div>
              ) : (
                <>
                  {/* Searchable Enabled Model Type Dropdown (Full Width) */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-800">
                        Enabled {category} Model <span className="text-rose-600">*</span>
                      </label>
                      <MappingInfoTooltip text={MODAL_FIELD_TOOLTIPS.mapping.enabledModelType} align="right" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setModelDropdownOpen((v) => !v)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-left flex items-center justify-between gap-2 hover:border-slate-300 cursor-pointer"
                    >
                      <span className="truncate font-medium text-slate-900">
                        {activeModelDef
                          ? [activeModelDef.typeName, activeModelDef.manufacturer, activeModelDef.modelReference]
                              .filter(Boolean)
                              .join(' · ')
                          : 'Select model type...'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>

                    {modelDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden">
                        <div className="p-2 border-b border-slate-100">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              autoFocus
                              value={modelSearch}
                              onChange={(e) => setModelSearch(e.target.value)}
                              placeholder={`Search ${category} model...`}
                              className="w-full h-8 pl-8 pr-2 rounded-lg border border-slate-200 text-[11px] focus:outline-none focus:border-[#F26522]"
                            />
                          </div>
                        </div>
                        <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                          {filteredModels.length === 0 ? (
                            <div className="p-3 text-center text-[11px] text-slate-400">
                              No enabled {category} models match "{modelSearch}".
                            </div>
                          ) : (
                            filteredModels.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setSelectedModelId(m.id);
                                  setSelectedHardwareId('');
                                  setIdSearchQuery('');
                                  setModelDropdownOpen(false);
                                  setModelSearch('');
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-orange-50/60 flex items-center justify-between gap-2 cursor-pointer ${
                                  activeModelDef?.id === m.id ? 'bg-[#FFF3EE]' : ''
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold text-slate-900 truncate">
                                    {[m.typeName, m.manufacturer, m.modelReference].filter(Boolean).join(' · ')}
                                  </div>
                                  <div className="text-[10px] text-slate-500">
                                    Search by: {getRecordIdentifierTypes(m).join(', ') || m.identifierType}
                                    {m.category === 'Sensor' && m.connectionMode ? ` · ${m.connectionMode}` : ''}
                                    {m.category === 'Device' && m.simSupported === 'Yes' ? ' · SIM Supported' : ''}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Identifier Search */}
                  <div>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <div className="flex items-center gap-1.5">
                        <label className="font-semibold text-slate-800">
                          Search Registered {category} ({activeIdentifierLabel || 'ID'}) <span className="text-rose-600">*</span>
                        </label>
                        <MappingInfoTooltip text={MODAL_FIELD_TOOLTIPS.mapping.searchIdentifier} align="left" />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRegIdValue(idSearchQuery.trim());
                          setRegError(null);
                          setShowRegisterInline(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F26522] hover:underline cursor-pointer shrink-0"
                      >
                        <Plus className="w-3 h-3" /> Add New {category}
                      </button>
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={idSearchQuery}
                        onChange={(e) => {
                          setIdSearchQuery(e.target.value);
                          setSelectedHardwareId('');
                          setShowRegisterInline(false);
                        }}
                        placeholder={
                          category === 'Device'
                            ? `Search ${activeIdentifierLabel} or unit ID (e.g. GTW-9032, GTW-9062)...`
                            : category === 'Sensor'
                            ? 'Search Sensor ID (e.g. SENS-10017, SENS-10027, DSR-8891)...'
                            : 'Search SIM ICCID (e.g. 89918610431245100006)...'
                        }
                        className="w-full h-9 pl-8 pr-8 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#F26522]"
                      />
                      {idSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setIdSearchQuery('');
                            setSelectedHardwareId('');
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {crossTenantConflict && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{crossTenantConflict}</span>
                    </div>
                  )}

                  {/* Search Results List */}
                  <div className="border border-slate-200 rounded-xl bg-white max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {matchingUnits.length === 0 ? (
                      <div className="p-4 text-center space-y-2">
                        <div className="text-[11.5px] text-slate-500">
                          No registered {category} matching "{idSearchQuery || activeModelDef?.typeName}" found under{' '}
                          <strong className="text-slate-700">{targetClient}</strong>.
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setRegIdValue(idSearchQuery.trim());
                            setShowRegisterInline(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F26522] hover:bg-[#d95417] text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Register {category} for {targetClient}
                        </button>
                      </div>
                    ) : (
                      matchingUnits.map((unit) => {
                        const alreadyInConn = members.some((m) => m.hardwareId === unit.hardwareId);
                        const isSelected = selectedHardwareId === unit.hardwareId;
                        const { activeBindings, activeConns } = getExistingHardwareAssignments(unit.hardwareId);
                        const otherConnLabel = activeConns.map((c) => c.id).join(', ');
                        const otherBind = activeBindings.find((b) => b.connectionId !== connId);

                        return (
                          <button
                            key={unit.hardwareId}
                            type="button"
                            disabled={alreadyInConn}
                            onClick={() => {
                              setSelectedHardwareId(unit.hardwareId);
                              setLocalError(null);
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                              alreadyInConn
                                ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                : isSelected
                                ? 'bg-[#FFF3EE] border-l-2 border-[#F26522]'
                                : 'hover:bg-slate-50 cursor-pointer'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-slate-900">
                                  {category === 'Device' && unit.code !== unit.identifierValue
                                    ? `${unit.code} · ${unit.identifierValue}`
                                    : unit.identifierValue}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                                    unit.status === 'Inventory'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-sky-50 text-sky-700'
                                  }`}
                                >
                                  {unit.status}
                                </span>
                                {otherConnLabel && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                    Bound in {otherConnLabel}
                                    {otherBind
                                      ? ` (${otherBind.mode} from ${formatDateTimeWithTz(otherBind.effectiveStartAt, otherBind.timezone)})`
                                      : ''}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">{unit.subtitle}</div>
                            </div>
                            <span
                              className={`text-[11px] font-semibold shrink-0 px-2 py-0.5 rounded-md ${
                                alreadyInConn
                                  ? 'bg-slate-100 text-slate-400'
                                  : isSelected
                                  ? 'bg-[#F26522] text-white'
                                  : 'text-[#F26522] bg-[#FFF3EE]'
                              }`}
                            >
                              {alreadyInConn ? 'In Mapping' : isSelected ? 'Selected' : 'Select'}
                            </span>
                          </button>
                        );
                      })
                    )}
                    {matchingUnits.length > 0 && (
                      <div className="sticky bottom-0 px-3 py-2 bg-[#FFF9F6] border-t border-slate-200 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-600">
                          Can&apos;t find your {category} in {targetClient}?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setRegIdValue(idSearchQuery.trim());
                            setRegError(null);
                            setShowRegisterInline(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F26522] hover:bg-[#d95417] text-white text-[11px] font-semibold cursor-pointer shrink-0"
                        >
                          <Plus className="w-3 h-3" /> Create &amp; Register {category}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline Register Missing / New Hardware Drawer Panel */}
                  {showRegisterInline && (
                    <div className="p-3.5 rounded-xl border border-[#F26522]/40 bg-[#FFF9F6] space-y-3 shadow-xs">
                      <div className="flex items-center justify-between border-b border-[#F26522]/15 pb-2">
                        <div>
                          <span className="text-[12.5px] font-bold text-slate-900">
                            Create &amp; Register New {category}
                          </span>
                          <div className="text-[10.5px] text-slate-500">
                            Organization: <strong className="text-slate-700">{targetClient}</strong> · Model:{' '}
                            <strong className="text-slate-700">
                              {[activeModelDef?.typeName, activeModelDef?.manufacturer, activeModelDef?.modelReference]
                                .filter(Boolean)
                                .join(' · ')}
                            </strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowRegisterInline(false)}
                          className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {regError && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 font-medium">
                          {regError}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                            {activeIdentifierLabel} <span className="text-rose-600">*</span>
                          </label>
                          <input
                            type="text"
                            value={regIdValue}
                            onChange={(e) => setRegIdValue(e.target.value)}
                            placeholder={`Enter ${activeIdentifierLabel}`}
                            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white font-mono text-[11.5px] focus:outline-none focus:border-[#F26522]"
                          />
                        </div>
                        {category === 'SIM' ? (
                          <div>
                            <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                              Mobile Number / MSISDN
                            </label>
                            <input
                              type="text"
                              value={regSimMsisdn}
                              onChange={(e) => setRegSimMsisdn(e.target.value)}
                              placeholder="e.g. +91 9810000000"
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11.5px] focus:outline-none focus:border-[#F26522]"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                              {category} Name / Label (Optional)
                            </label>
                            <input
                              type="text"
                              value={regNameValue}
                              onChange={(e) => setRegNameValue(e.target.value)}
                              placeholder={category === 'Device' ? 'e.g. Cabin Dashcam #04' : 'e.g. Reefer Temp #2'}
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11.5px] focus:outline-none focus:border-[#F26522]"
                            />
                          </div>
                        )}

                        {category === 'SIM' ? (
                          <>
                            <div>
                              <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                                Operator / Provider
                              </label>
                              <select
                                value={regSimOperator}
                                onChange={(e) => setRegSimOperator(e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11.5px]"
                              >
                                {['Airtel', 'Jio', 'Vi', 'BSNL'].map((op) => (
                                  <option key={op} value={op}>
                                    {op}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                                Form Factor
                              </label>
                              <select
                                value={regSimFormFactor}
                                onChange={(e) => setRegSimFormFactor(e.target.value as any)}
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11.5px]"
                              >
                                {['Nano (4FF)', 'Micro (3FF)', 'Standard (2FF)', 'eSIM'].map((ff) => (
                                  <option key={ff} value={ff}>
                                    {ff}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                                Plan / Package
                              </label>
                              <select
                                value={regSimPlan}
                                onChange={(e) => setRegSimPlan(e.target.value)}
                                className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11.5px]"
                              >
                                {['IoT Business 10GB', 'M2M Global 5GB', 'M2M Telemetry 2GB', 'Fleet Unlimited 4G'].map(
                                  (pl) => (
                                    <option key={pl} value={pl}>
                                      {pl}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                                Serial Number (Optional)
                              </label>
                              <input
                                type="text"
                                value={regSerialValue}
                                onChange={(e) => setRegSerialValue(e.target.value)}
                                placeholder="e.g. SN-994021"
                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white font-mono text-[11.5px] focus:outline-none focus:border-[#F26522]"
                              />
                            </div>
                            <div>
                              <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                                Inventory Location
                              </label>
                              <input
                                type="text"
                                value={regLocationValue}
                                onChange={(e) => setRegLocationValue(e.target.value)}
                                placeholder="e.g. Mundra CT2"
                                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11.5px] focus:outline-none focus:border-[#F26522]"
                              />
                            </div>
                          </>
                        )}
                        <div>
                          <label className="block text-[10.5px] font-semibold text-slate-700 mb-1">
                            Lifecycle Status
                          </label>
                          <select
                            value={regLifecycle}
                            onChange={(e) => setRegLifecycle(e.target.value as 'Inventory' | 'Active')}
                            className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11.5px]"
                          >
                            <option value="Inventory">Inventory</option>
                            <option value="Active">Active</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowRegisterInline(false)}
                          className="h-7 px-3 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleInlineRegister}
                          className="h-7 px-3 rounded-lg bg-[#F26522] hover:bg-[#d95417] text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Save {category} &amp; Select
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Selected Hardware Summary Card */}
          {selectedNewMember && (
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Selected {selectedNewMember.category}: {selectedNewMember.identifierValue}
                </div>
                <div className="text-[11px] text-slate-600 truncate mt-0.5">
                  {selectedNewMember.modelLabel} · {selectedNewMember.identifierType} · Status: {selectedNewMember.registrationStatus}
                </div>
              </div>
            </div>
          )}

          {/* Binding Configuration (Shown whenever connecting to a Parent Device) */}
          {parentHardwareId && (
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide">
                  Pairwise Binding & Validity
                </span>
                <span className="text-[10.5px] text-slate-500">Stored as independent binding record</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Binding Mode */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Binding Mode *</label>
                  <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-slate-200/70">
                    {(['Permanent', 'Temporal'] as HardwareBindingMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setBMode(m)}
                        className={`h-8 rounded-md text-[11.5px] font-semibold inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          bMode === m ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m === 'Permanent' ? <InfinityIcon className="w-3.5 h-3.5 text-sky-600" /> : <Clock className="w-3.5 h-3.5 text-[#F26522]" />}
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Port / Slot (Conditional) */}
                {availablePortsForParent.length > 0 ? (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {category === 'SIM' ? 'SIM Slot' : 'Port / Interface'}
                    </label>
                    <select
                      value={portOrSlot}
                      onChange={(e) => setPortOrSlot(e.target.value)}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-[11.5px]"
                    >
                      <option value="">Auto / Unspecified</option>
                      {availablePortsForParent.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Timezone</label>
                    <select
                      value={bTimezone}
                      onChange={(e) => setBTimezone(e.target.value)}
                      className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-[11px]"
                    >
                      {SUPPORTED_TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Effective Start Date & Time *</label>
                  <div className="flex gap-1">
                    <input
                      type="date"
                      value={bStartDate}
                      onChange={(e) => setBStartDate(e.target.value)}
                      className="w-[125px] h-9 px-2 rounded-lg border border-slate-200 bg-white text-[11px]"
                    />
                    <input
                      type="time"
                      step="1"
                      value={bStartTime}
                      onChange={(e) => setBStartTime(e.target.value)}
                      className="flex-1 h-9 px-2 rounded-lg border border-slate-200 bg-white text-[11px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Effective End Date & Time {bMode === 'Temporal' && '*'}
                  </label>
                  {bMode === 'Permanent' ? (
                    <div className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 flex items-center text-[11px]">
                      Empty (Open-ended Permanent)
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <input
                        type="date"
                        value={bEndDate}
                        onChange={(e) => setBEndDate(e.target.value)}
                        className="w-[125px] h-9 px-2 rounded-lg border border-slate-200 bg-white text-[11px]"
                      />
                      <input
                        type="time"
                        step="1"
                        value={bEndTime}
                        onChange={(e) => setBEndTime(e.target.value)}
                        className="flex-1 h-9 px-2 rounded-lg border border-slate-200 bg-white text-[11px]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {availablePortsForParent.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Timezone</label>
                    <select
                      value={bTimezone}
                      onChange={(e) => setBTimezone(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11px]"
                    >
                      {SUPPORTED_TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Audit Note (Optional)</label>
                    <input
                      type="text"
                      value={bNotes}
                      onChange={(e) => setBNotes(e.target.value)}
                      placeholder="e.g. Main cabin port"
                      className="w-full h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                    />
                  </div>
                </div>
              )}

              {liveValidation.errors.length > 0 && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] space-y-1">
                  {liveValidation.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!parentHardwareId && category === 'Sensor' && sensorRequiresParent && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11.5px] flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>{activeModelDef?.typeName}</strong> is configured as Gateway-connected. Select a parent Device above or use{' '}
                <strong>+ Sensor</strong> on a Device row.
              </span>
            </div>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {!isEditingBinding && category === 'Sensor' && parentHardwareId && (
              <button
                type="button"
                disabled={liveValidation.errors.length > 0}
                onClick={() => handleCommit('add-sensor')}
                className="h-8 px-3 rounded-lg border border-[#F26522]/40 bg-[#FFF3EE] hover:bg-[#ffe5db] disabled:opacity-50 text-[#F26522] text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
              >
                Add & Add Another Sensor
              </button>
            )}

            {!isEditingBinding && supportsMultipleSims && (
              <button
                type="button"
                disabled={liveValidation.errors.length > 0}
                onClick={() => handleCommit('add-sim')}
                className="h-8 px-3 rounded-lg border border-[#F26522]/40 bg-[#FFF3EE] hover:bg-[#ffe5db] disabled:opacity-50 text-[#F26522] text-[11.5px] font-semibold cursor-pointer whitespace-nowrap"
              >
                Add & Add Another SIM
              </button>
            )}

            <button
              type="button"
              disabled={liveValidation.errors.length > 0}
              onClick={() => handleCommit(undefined)}
              className="h-8 px-4 rounded-lg bg-[#F26522] hover:bg-[#d95417] disabled:bg-slate-300 text-white text-[12px] font-semibold cursor-pointer whitespace-nowrap"
            >
              {isEditingBinding
                ? 'Update Binding'
                : parentHardwareId
                ? `Save ${category} & Binding`
                : `Add Primary ${category}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
