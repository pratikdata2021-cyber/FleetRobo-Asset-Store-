import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Cpu,
  Radio,
  Smartphone,
  Truck,
  User,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Infinity as InfinityIcon,
  Clock,
  StopCircle,
  Star,
  Package,
  ArrowRight,
  Link2
} from 'lucide-react';
import {
  ModalMasterStore,
  ConnectionRecord,
  HardwareMembership,
  HardwareBinding,
  HardwareBindingMode,
  HardwareCategory,
  ResourceAllocation,
  ResourceType,
  DeviceRecord,
  SensorRecord,
  SimRecord,
  MODAL_OWNERS,
  SUPPORTED_TIMEZONES,
  COMPANY_NAME_TO_ID,
  MODAL_FIELD_TOOLTIPS,
  buildExpandableBindingRows,
  computeHardwareBindingStatus,
  formatDateTimeWithTz,
  buildIsoWithTimezone
} from '../../types/modalMaster';
import {
  getEnabledModelsForCompanyName,
  getAvailableClientCompanies,
  loadClientCompanies
} from '../../types/companyModelEnablement';
import { Vehicle, loadVehicleMasterStore, saveVehicleMasterStore } from '../../types/vehicle';
import { Driver, loadDriverMasterStore, saveDriverMasterStore } from '../../types/driver';
import { MappingInfoTooltip } from './ModalConnectionOverlays';
import { HardwareUnitIcon } from './ExpandableHardwareRows';
import {
  HardwareCompositionModal,
  BindingDefaults,
  HardwareCompositionSaveResult
} from './HardwareCompositionModal';
import { ResourceRelationshipsPanel } from './ResourceRelationshipsPanel';
import { VehicleDrawer } from '../VehicleDrawer';
import { DriverDrawer } from '../DriverDrawer';

interface MappingFormDrawerProps {
  mode: 'create' | 'edit';
  initialConnection?: ConnectionRecord | null;
  store: ModalMasterStore;
  activeCompanyScope: string;
  isPlatformAdmin?: boolean;
  actorName: string;
  onClose: () => void;
  onQuickRegisterHardware?: (unit: {
    device?: DeviceRecord;
    sensor?: SensorRecord;
    sim?: SimRecord;
  }) => void;
  onCommit: (payload: {
    connection: ConnectionRecord;
    bindings: HardwareBinding[];
    allocations: ResourceAllocation[];
    addedDevices: DeviceRecord[];
    addedSensors: SensorRecord[];
    addedSims: SimRecord[];
    isEdit: boolean;
  }) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const SectionBadge: React.FC<{
  num: number;
  title: string;
  subtitle?: string;
  tooltip?: string;
  right?: React.ReactNode;
}> = ({ num, title, subtitle, tooltip, right }) => (
  <div className="flex items-start justify-between gap-3 mb-3.5 flex-wrap">
    <div className="flex items-start gap-2.5">
      <span className="w-6 h-6 rounded-full bg-[#F26522] text-white text-[12px] font-bold inline-flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
        {num}
      </span>
      <div>
        <div className="flex items-center gap-1.5">
          <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
          {tooltip && <MappingInfoTooltip text={tooltip} align="left" />}
        </div>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {right}
  </div>
);

export const MappingFormDrawer: React.FC<MappingFormDrawerProps> = ({
  mode,
  initialConnection,
  store,
  activeCompanyScope,
  isPlatformAdmin = false,
  actorName,
  onClose,
  onQuickRegisterHardware,
  onCommit,
  showToast
}) => {
  const isEdit = mode === 'edit' && !!initialConnection;
  const availableOrganizations = useMemo(() => getAvailableClientCompanies(), []);
  const defaultClient =
    initialConnection?.companyName ||
    (activeCompanyScope === 'All Clients'
      ? availableOrganizations[0] || MODAL_OWNERS[0]
      : activeCompanyScope);

  // 1. Basic Details
  const [targetClient, setTargetClient] = useState<string>(defaultClient);
  const [connName, setConnName] = useState(initialConnection?.name || '');
  const [connId] = useState(() => {
    if (initialConnection?.id) return initialConnection.id;
    const nums = store.connections
      .map((c) => Number(c.id.replace(/\D/g, '')))
      .filter((n) => !Number.isNaN(n));
    const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1283;
    return `CON-${nextNum}`;
  });
  const [description, setDescription] = useState(initialConnection?.description || '');
  const [site] = useState(initialConnection?.site || '');

  const liveVersion = isEdit
    ? store.connections.find((c) => c.id === initialConnection!.id)?.version || initialConnection!.version
    : 1;
  const hasVersionConflict = isEdit && liveVersion !== initialConnection!.version;

  // 2. Hardware Composition & Pairwise Bindings
  const [members, setMembers] = useState<HardwareMembership[]>(() =>
    initialConnection ? [...initialConnection.members] : []
  );
  const [draftBindings, setDraftBindings] = useState<HardwareBinding[]>(() =>
    initialConnection
      ? store.hardwareBindings.filter((b) => b.connectionId === initialConnection.id)
      : []
  );
  const [localDevices, setLocalDevices] = useState<DeviceRecord[]>(store.devices);
  const [localSensors, setLocalSensors] = useState<SensorRecord[]>(store.sensors);
  const [localSims, setLocalSims] = useState<SimRecord[]>(store.sims);

  // Sync live changes from Model Access & Vehicle/Driver Masters
  const [modelAccessTick, setModelAccessTick] = useState(0);
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => loadVehicleMasterStore());
  const [drivers, setDrivers] = useState<Driver[]>(() => loadDriverMasterStore());

  useEffect(() => {
    const onModels = () => setModelAccessTick((t) => t + 1);
    const onResources = () => {
      setVehicles(loadVehicleMasterStore());
      setDrivers(loadDriverMasterStore());
    };
    window.addEventListener('fleetrobo:model-access-updated', onModels);
    window.addEventListener('fleetrobo:resources-updated', onResources);
    return () => {
      window.removeEventListener('fleetrobo:model-access-updated', onModels);
      window.removeEventListener('fleetrobo:resources-updated', onResources);
    };
  }, []);

  const enabledModels = useMemo(() => {
    void modelAccessTick;
    return getEnabledModelsForCompanyName(targetClient);
  }, [targetClient, modelAccessTick]);

  // Nested Hardware Composition / Binding Modal state
  const [composerState, setComposerState] = useState<{
    mode: 'add-hardware' | 'edit-binding';
    category: HardwareCategory;
    parentHardwareId?: string | null;
    editingBinding?: HardwareBinding | null;
  } | null>(null);

  const [lastBindingDefaults, setLastBindingDefaults] = useState<BindingDefaults>({
    mode: 'Permanent',
    startDate: '2026-11-13',
    startTime: '10:30:00',
    endDate: '2026-11-28',
    endTime: '23:59:59',
    timezone: 'Asia/Kolkata'
  });

  // Hovered parent row highlighting inside Section 2 tree table
  const [hoveredParentId, setHoveredParentId] = useState<string | null>(null);

  // Safe Removal / Reassign dialog when removing a Device that has child bindings
  const [removingDevice, setRemovingDevice] = useState<{
    member: HardwareMembership;
    impactedBindings: HardwareBinding[];
    impactedChildren: HardwareMembership[];
  } | null>(null);
  const [reassignTargetDeviceId, setReassignTargetDeviceId] = useState<string>('');

  // End Binding inline modal (preserves historical binding audit records)
  const [endingBinding, setEndingBinding] = useState<HardwareBinding | null>(null);
  const [endBindDate, setEndBindDate] = useState('2026-11-13');
  const [endBindTime, setEndBindTime] = useState('18:00:00');
  const [endBindReason, setEndBindReason] = useState('Replaced / decommissioned hardware pair');

  // 3. Resource Allocation (Optional, multi-resource + scoped hardware + Resource-to-Resource)
  const [step3Tab, setStep3Tab] = useState<'hardware-resource' | 'resource-resource'>('hardware-resource');
  const [draftAllocations, setDraftAllocations] = useState<ResourceAllocation[]>(() =>
    initialConnection
      ? store.resourceAllocations.filter((a) => a.connectionId === initialConnection.id && !a.endedAt)
      : []
  );
  const [resType, setResType] = useState<ResourceType>('Vehicle');
  const [resSearch, setResSearch] = useState('');
  const [resDropdownOpen, setResDropdownOpen] = useState(false);
  const [selectedResourcePick, setSelectedResourcePick] = useState<{
    resourceId: string;
    resourceIdentifier: string;
    resourceDisplayName: string;
  } | null>(null);
  const [resHardwareScopeId, setResHardwareScopeId] = useState<string>(''); // '' = All hardware
  const [resMode, setResMode] = useState<HardwareBindingMode>('Permanent');
  const [resTimezone, setResTimezone] = useState('Asia/Kolkata');
  const [resStartDate, setResStartDate] = useState('2026-11-13');
  const [resStartTime, setResStartTime] = useState('10:30:00');
  const [resEndDate, setResEndDate] = useState('2026-11-28');
  const [resEndTime, setResEndTime] = useState('18:00:00');

  // Inline Quick Create Vehicle / Driver
  const resBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (resBoxRef.current && !resBoxRef.current.contains(e.target as Node)) {
        setResDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const [qcResType, setQcResType] = useState<null | 'Vehicle' | 'Driver'>(null);
  const [qcVehReg, setQcVehReg] = useState('');
  const [qcDrvPhone, setQcDrvPhone] = useState('');

  // Form Errors & Confirmation
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<boolean>(false);

  const allGlobalBindings = useMemo(
    () => [
      ...store.hardwareBindings.filter((b) => b.connectionId !== connId),
      ...draftBindings
    ],
    [store.hardwareBindings, connId, draftBindings]
  );

  // Build hierarchical tree rows directly from saved/staged HardwareBindings
  const compositionRows = useMemo(
    () => buildExpandableBindingRows(members, draftBindings, allGlobalBindings),
    [members, draftBindings, allGlobalBindings]
  );

  const memberMap = useMemo(() => new Map(members.map((m) => [m.hardwareId, m])), [members]);

  // Handle saving from HardwareCompositionModal
  const handleCompositionSave = (
    res: HardwareCompositionSaveResult,
    keepOpenAction?: 'add-sensor' | 'add-sim'
  ) => {
    setLastBindingDefaults(res.usedDefaults);

    if (res.registeredDevice) {
      setLocalDevices((prev) => [res.registeredDevice!, ...prev]);
      showToast(`Registered Device ${res.registeredDevice.deviceId} under ${targetClient}.`);
    }
    if (res.registeredSensor) {
      setLocalSensors((prev) => [res.registeredSensor!, ...prev]);
      showToast(`Registered Sensor ${res.registeredSensor.deviceId} under ${targetClient}.`);
    }
    if (res.registeredSim) {
      setLocalSims((prev) => [res.registeredSim!, ...prev]);
      showToast(`Registered SIM ${res.registeredSim.iccid} under ${targetClient}.`);
    }

    if (res.newMember) {
      setMembers((prev) => {
        const hasDevicePrimary = prev.some((m) => m.category === 'Device' && m.isPrimary);
        const shouldBePrimary =
          res.newMember!.category === 'Device' ? !hasDevicePrimary : prev.length === 0;
        return [
          ...prev.map((m) =>
            shouldBePrimary && res.newMember!.category === 'Device' && m.isPrimary
              ? { ...m, isPrimary: false }
              : m
          ),
          { ...res.newMember!, isPrimary: shouldBePrimary }
        ];
      });
    }

    if (res.newBinding) {
      setDraftBindings((prev) => [...prev, res.newBinding!]);
    }

    if (res.updatedBinding) {
      setDraftBindings((prev) =>
        prev.map((b) => (b.id === res.updatedBinding!.id ? res.updatedBinding! : b))
      );
      showToast(`Updated binding ${res.updatedBinding.id}.`);
    }

    if (!keepOpenAction) {
      setComposerState(null);
    }
    setFormError(null);
  };

  // Safe Remove Hardware Unit
  const handleRequestRemoveMember = (member: HardwareMembership) => {
    const activeChildBindings = draftBindings.filter(
      (b) => b.fromHardwareId === member.hardwareId && !b.endedAt
    );
    if ((member.category === 'Device' || member.category === 'Sensor') && activeChildBindings.length > 0) {
      const impactedChildren = activeChildBindings
        .map((b) => memberMap.get(b.toHardwareId))
        .filter((m): m is HardwareMembership => !!m);
      const otherParent = members.find(
        (m) =>
          (m.category === 'Device' || (member.category === 'Sensor' && m.category === 'Sensor')) &&
          m.hardwareId !== member.hardwareId
      );
      setReassignTargetDeviceId(otherParent?.hardwareId || '');
      setRemovingDevice({
        member,
        impactedBindings: activeChildBindings,
        impactedChildren
      });
      return;
    }

    // No active children -> remove member & end/remove inbound binding safely
    setMembers((prev) => {
      const filtered = prev.filter((x) => x.hardwareId !== member.hardwareId);
      if (member.isPrimary && filtered.length > 0) {
        const nextPrimary = filtered.find((f) => f.category === 'Device') || filtered[0];
        return filtered.map((f) => ({
          ...f,
          isPrimary: f.hardwareId === nextPrimary.hardwareId
        }));
      }
      return filtered;
    });
    if (isEdit) {
      const nowIso = new Date().toISOString();
      setDraftBindings((prev) =>
        prev.map((b) =>
          (b.toHardwareId === member.hardwareId || b.fromHardwareId === member.hardwareId) && !b.endedAt
            ? {
                ...b,
                endedAt: nowIso,
                effectiveEndAt: nowIso,
                endReason: `Hardware ${member.identifierValue} removed from connection`,
                updatedAt: nowIso
              }
            : b
        )
      );
    } else {
      setDraftBindings((prev) =>
        prev.filter(
          (b) => b.fromHardwareId !== member.hardwareId && b.toHardwareId !== member.hardwareId
        )
      );
    }
  };

  const handleConfirmRemoveDeviceWithChildren = (action: 'reassign' | 'remove-bindings') => {
    if (!removingDevice) return;
    const targetDevId = removingDevice.member.hardwareId;
    const nowIso = new Date().toISOString();

    if (action === 'reassign' && reassignTargetDeviceId) {
      setDraftBindings((prev) =>
        prev
          .map((b) => {
            if (b.fromHardwareId === targetDevId && !b.endedAt) {
              return {
                ...b,
                fromHardwareId: reassignTargetDeviceId,
                portOrSlot: null,
                updatedAt: nowIso
              };
            }
            return b;
          })
          .filter((b) => (isEdit ? true : b.toHardwareId !== targetDevId))
      );
      if (isEdit) {
        setDraftBindings((prev) =>
          prev.map((b) =>
            b.toHardwareId === targetDevId && !b.endedAt
              ? { ...b, endedAt: nowIso, effectiveEndAt: nowIso, endReason: 'Parent device removed', updatedAt: nowIso }
              : b
          )
        );
      }
      showToast(`Reassigned ${removingDevice.impactedChildren.length} child unit(s) & removed ${removingDevice.member.identifierValue}.`);
    } else {
      if (isEdit) {
        setDraftBindings((prev) =>
          prev.map((b) =>
            (b.fromHardwareId === targetDevId || b.toHardwareId === targetDevId) && !b.endedAt
              ? {
                  ...b,
                  endedAt: nowIso,
                  effectiveEndAt: nowIso,
                  endReason: `Parent ${removingDevice.member.identifierValue} removed`,
                  updatedAt: nowIso
                }
              : b
          )
        );
      } else {
        setDraftBindings((prev) =>
          prev.filter((b) => b.fromHardwareId !== targetDevId && b.toHardwareId !== targetDevId)
        );
      }
      showToast(`Removed ${removingDevice.member.identifierValue} and its affected bindings.`);
    }

    setMembers((prev) => {
      const next = prev.filter((x) => x.hardwareId !== targetDevId);
      if (removingDevice.member.isPrimary && next.length > 0) {
        const nextPrimary = next.find((f) => f.category === 'Device') || next[0];
        return next.map((f) => ({ ...f, isPrimary: f.hardwareId === nextPrimary.hardwareId }));
      }
      return next;
    });
    setRemovingDevice(null);
  };

  const handleConfirmEndBinding = () => {
    if (!endingBinding) return;
    const endIso = buildIsoWithTimezone(endBindDate, endBindTime, endingBinding.timezone || 'Asia/Kolkata');
    const nowIso = new Date().toISOString();
    setDraftBindings((prev) =>
      prev.map((b) =>
        b.id === endingBinding.id
          ? {
              ...b,
              endedAt: endIso || nowIso,
              effectiveEndAt: endIso || nowIso,
              endReason: endBindReason.trim() || 'Ended during mapping edit',
              updatedAt: nowIso
            }
          : b
      )
    );
    setEndingBinding(null);
    showToast(`Ended binding ${endingBinding.id}; historical record preserved.`);
  };

  // Client-scoped Vehicle & Driver lists
  const clientVehicles = useMemo(
    () =>
      vehicles.filter(
        (v) => (v.client || v.company || '').trim().toLowerCase() === targetClient.trim().toLowerCase()
      ),
    [vehicles, targetClient]
  );
  const clientDrivers = useMemo(
    () =>
      drivers.filter(
        (d) => (d.company || '').trim().toLowerCase() === targetClient.trim().toLowerCase()
      ),
    [drivers, targetClient]
  );

  const resourceMatches = useMemo(() => {
    const q = resSearch.trim().toLowerCase();
    if (resType === 'Vehicle') {
      return clientVehicles
        .filter(
          (v) =>
            !q ||
            v.registration_number.toLowerCase().includes(q) ||
            (v.machine_model || '').toLowerCase().includes(q)
        )
        .slice(0, 8)
        .map((v) => ({
          resourceId: v.id,
          resourceIdentifier: v.registration_number,
          resourceDisplayName: `${v.machine_model || v.model || 'Vehicle'} · ${v.registration_number}`,
          subtitle: `${v.machine_model || v.model} · ${v.status}`,
          existingConn: store.resourceAllocations.find(
            (a) =>
              !a.endedAt &&
              a.connectionId !== connId &&
              a.resourceType === 'Vehicle' &&
              a.resourceIdentifier === v.registration_number
          )?.connectionId
        }));
    }
    if (resType === 'Driver') {
      return clientDrivers
        .filter((d) => !q || d.phone.toLowerCase().includes(q) || d.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map((d) => {
          const phoneFormatted = d.phone.startsWith('+') ? d.phone : `+91 ${d.phone}`;
          return {
            resourceId: d.id,
            resourceIdentifier: phoneFormatted,
            resourceDisplayName: d.name,
            subtitle: `${d.name} · ${d.status} · ${d.licence}`,
            existingConn: store.resourceAllocations.find(
              (a) =>
                !a.endedAt &&
                a.connectionId !== connId &&
                a.resourceType === 'Driver' &&
                a.resourceId === d.id
            )?.connectionId
          };
        });
    }
    return [];
  }, [resType, resSearch, clientVehicles, clientDrivers, store.resourceAllocations, connId]);

  const handleStageResourceAllocation = () => {
    let pick = selectedResourcePick;
    if (!pick && resSearch.trim()) {
      // Allow manual identifier entry for other resource types (Equipment / Fleet / Place / Vendor)
      if (resType !== 'Vehicle' && resType !== 'Driver') {
        pick = {
          resourceId: `res-${resType.toLowerCase()}-${Date.now()}`,
          resourceIdentifier: resSearch.trim(),
          resourceDisplayName: `${resType} · ${resSearch.trim()}`
        };
      }
    }
    if (!pick) {
      setFormError(`Select a ${resType} from the lookup list first.`);
      return;
    }
    if (
      resMode === 'Temporal' &&
      Date.parse(buildIsoWithTimezone(resEndDate, resEndTime, resTimezone)) <=
        Date.parse(buildIsoWithTimezone(resStartDate, resStartTime, resTimezone))
    ) {
      setFormError('Resource allocation Effective End must be strictly after Effective Start.');
      return;
    }

    const nowIso = new Date().toISOString();
    const companyId =
      loadClientCompanies().find(
        (c) => c.name.trim().toLowerCase() === targetClient.trim().toLowerCase()
      )?.id ||
      COMPANY_NAME_TO_ID[targetClient] ||
      'comp-adani-mundra';
    const rcaSeq = 2100 + store.resourceAllocations.length + draftAllocations.length + 1;
    const newAlloc: ResourceAllocation = {
      id: `RCA-${rcaSeq}`,
      companyId,
      companyName: targetClient,
      connectionId: connId,
      resourceType: resType,
      resourceId: pick.resourceId,
      resourceIdentifier: pick.resourceIdentifier,
      resourceDisplayName: pick.resourceDisplayName,
      hardwareId: resHardwareScopeId || null,
      mode: resMode,
      effectiveStartAt: buildIsoWithTimezone(resStartDate, resStartTime, resTimezone),
      effectiveEndAt:
        resMode === 'Temporal' ? buildIsoWithTimezone(resEndDate, resEndTime, resTimezone) : null,
      timezone: resTimezone,
      site,
      assignedBy: actorName,
      assignedOn: nowIso,
      updatedAt: nowIso
    };

    setDraftAllocations((prev) => [...prev, newAlloc]);
    setSelectedResourcePick(null);
    setResSearch('');
    setResHardwareScopeId('');
    setResDropdownOpen(false);
    setFormError(null);
    showToast(`Added ${resType} allocation (${pick.resourceIdentifier}).`);
  };

  const handleCreatedVehicle = (newVeh: Vehicle) => {
    const vehicleRecord: Vehicle = {
      ...newVeh,
      company: newVeh.company || targetClient,
      client: newVeh.client || targetClient
    };
    const next = [vehicleRecord, ...vehicles.filter((v) => v.id !== vehicleRecord.id)];
    setVehicles(next);
    saveVehicleMasterStore(next);
    setResType('Vehicle');
    setSelectedResourcePick({
      resourceId: vehicleRecord.id,
      resourceIdentifier: vehicleRecord.registration_number,
      resourceDisplayName: `${vehicleRecord.machine_model || vehicleRecord.model || 'Vehicle'} · ${vehicleRecord.registration_number}`
    });
    setResSearch(vehicleRecord.registration_number);
    setResDropdownOpen(false);
    setQcResType(null);
    setQcVehReg('');
    setFormError(null);
    showToast(`Vehicle ${vehicleRecord.registration_number} created in ${vehicleRecord.company} Master & selected.`);
  };

  const handleCreatedDriver = (newDrv: Driver) => {
    const driverRecord: Driver = {
      ...newDrv,
      company: newDrv.company || targetClient
    };
    const next = [driverRecord, ...drivers.filter((d) => d.id !== driverRecord.id)];
    setDrivers(next);
    saveDriverMasterStore(next);
    setResType('Driver');
    setSelectedResourcePick({
      resourceId: driverRecord.id,
      resourceIdentifier: driverRecord.phone,
      resourceDisplayName: driverRecord.name
    });
    setResSearch(driverRecord.phone);
    setResDropdownOpen(false);
    setQcResType(null);
    setQcDrvPhone('');
    setFormError(null);
    showToast(`Driver ${driverRecord.name} created in ${driverRecord.company} Master & selected.`);
  };

  // Validation Checklist for Section 4 (Review & Submit)
  const validationChecks = useMemo(() => {
    const checks: { id: string; ok: boolean; label: string; section: string }[] = [];

    checks.push({
      id: 'name',
      ok: true,
      label: connName.trim() ? `Connection Name: "${connName.trim()}"` : `Connection Name: (Auto-generated as "${connId}")`,
      section: '1. Basic Details'
    });

    checks.push({
      id: 'hw-present',
      ok: members.length > 0,
      label:
        members.length > 0
          ? `${members.length} hardware unit(s) composed (${members.filter((m) => m.category === 'Device').length} Device, ${members.filter((m) => m.category === 'Sensor').length} Sensor, ${members.filter((m) => m.category === 'SIM').length} SIM)`
          : 'Add at least one registered Device or supported standalone Sensor in Section 2.',
      section: '2. Hardware Composition'
    });

    const onlySims = members.length > 0 && members.every((m) => m.category === 'SIM');
    checks.push({
      id: 'not-sim-only',
      ok: !onlySims,
      label: !onlySims
        ? 'Hardware hierarchy includes valid root Device or Sensor'
        : 'SIM-only mapping can be saved as Draft, but needs a Device before activation.',
      section: '2. Hardware Composition'
    });

    const pendingReview = members.some((m) => m.registrationStatus === 'Pending Hardware Review');
    checks.push({
      id: 'review-status',
      ok: !pendingReview,
      label: !pendingReview
        ? 'All selected hardware passed registration verification'
        : 'Hardware Pending Hardware Review must stay in Draft until approved.',
      section: '2. Hardware Composition'
    });

    const conflictBindings = draftBindings.filter(
      (b) => computeHardwareBindingStatus(b, allGlobalBindings, members).status === 'Conflict'
    );
    checks.push({
      id: 'no-binding-conflict',
      ok: conflictBindings.length === 0,
      label:
        conflictBindings.length === 0
          ? `${draftBindings.length} pairwise binding(s) validated cleanly`
          : `${conflictBindings.length} binding(s) have conflicts (${conflictBindings.map((b) => b.id).join(', ')})`,
      section: '2. Hardware Composition'
    });

    // Check unlinked non-standalone sensors/SIMs when multiple hardware exist
    const linkedTargets = new Set(draftBindings.filter((b) => !b.endedAt).map((b) => b.toHardwareId));
    const unlinkedNonDevice = members.filter(
      (m) =>
        m.category === 'SIM' &&
        !linkedTargets.has(m.hardwareId)
    );
    checks.push({
      id: 'sim-bound',
      ok: unlinkedNonDevice.length === 0,
      label:
        unlinkedNonDevice.length === 0
          ? 'Every SIM is bound to a valid Device or Sensor'
          : `${unlinkedNonDevice.map((s) => s.identifierValue).join(', ')} must be bound to a Device or Sensor`,
      section: '2. Hardware Composition'
    });

    return checks;
  }, [connName, connId, members, draftBindings, allGlobalBindings]);

  const canActivate = useMemo(() => {
    const failed = validationChecks.find((c) => !c.ok);
    return { ok: !failed, reason: failed?.label || '' };
  }, [validationChecks]);

  const computedTargetStatus: ConnectionRecord['status'] = useMemo(() => {
    if (!canActivate.ok) return 'Draft';
    const activeOrFuture = draftBindings.filter((b) => !b.endedAt);
    const allFuture =
      activeOrFuture.length > 0 &&
      activeOrFuture.every((b) => Date.parse(b.effectiveStartAt) > Date.now());
    return allFuture ? 'Scheduled' : 'Active';
  }, [canActivate.ok, draftBindings]);

  const executeCommit = (targetMode: 'draft' | 'activate') => {
    const nowIso = new Date().toISOString();
    const companyId =
      loadClientCompanies().find(
        (c) => c.name.trim().toLowerCase() === targetClient.trim().toLowerCase()
      )?.id ||
      COMPANY_NAME_TO_ID[targetClient] ||
      'comp-adani-mundra';

    let finalStatus: ConnectionRecord['status'] = 'Draft';
    if (targetMode === 'activate') {
      finalStatus = computedTargetStatus === 'Scheduled' ? 'Scheduled' : 'Active';
    } else if (members.some((m) => m.registrationStatus === 'Pending Hardware Review')) {
      finalStatus = 'Needs Attention';
    }

    const updatedConn: ConnectionRecord = {
      id: connId,
      connectionId: connId,
      companyId,
      companyName: targetClient,
      name: connName.trim() || `${targetClient} Mapping · ${connId}`,
      description: description.trim(),
      site,
      memberIds: members.map((m) => m.hardwareId),
      members,
      status: finalStatus,
      verification: finalStatus === 'Active' ? 'Demo — simulated pass' : 'Not checked',
      version: (initialConnection?.version || 0) + 1,
      createdAt: initialConnection?.createdAt || nowIso,
      updatedAt: nowIso,
      createdBy: initialConnection?.createdBy || actorName,
      updatedBy: actorName,
      activity: [
        {
          id: `act-${Date.now()}`,
          timestamp: nowIso,
          actor: actorName,
          action: isEdit
            ? `Updated mapping (${finalStatus})`
            : targetMode === 'draft'
            ? 'Saved mapping as Draft'
            : `Activated mapping (${finalStatus})`,
          afterSummary: `${members.length} hardware unit(s), ${draftBindings.length} binding(s), ${draftAllocations.length} resource(s)`
        },
        ...(initialConnection?.activity || [])
      ]
    };

    // Include any selected-but-not-yet-staged resource pick seamlessly if user didn't click "+ Add Another Resource"
    const finalAllocations = [...draftAllocations];
    if (selectedResourcePick) {
      const exists = finalAllocations.some(
        (a) => a.resourceType === resType && a.resourceId === selectedResourcePick.resourceId
      );
      if (!exists) {
        const rcaSeq = 2100 + store.resourceAllocations.length + finalAllocations.length + 1;
        finalAllocations.push({
          id: `RCA-${rcaSeq}`,
          companyId,
          companyName: targetClient,
          connectionId: connId,
          resourceType: resType,
          resourceId: selectedResourcePick.resourceId,
          resourceIdentifier: selectedResourcePick.resourceIdentifier,
          resourceDisplayName: selectedResourcePick.resourceDisplayName,
          hardwareId: resHardwareScopeId || null,
          mode: resMode,
          effectiveStartAt: buildIsoWithTimezone(resStartDate, resStartTime, resTimezone),
          effectiveEndAt:
            resMode === 'Temporal' ? buildIsoWithTimezone(resEndDate, resEndTime, resTimezone) : null,
          timezone: resTimezone,
          site,
          assignedBy: actorName,
          assignedOn: nowIso,
          updatedAt: nowIso
        });
      }
    }

    const existingDevIds = new Set(store.devices.map((d) => d.id));
    const existingSenIds = new Set(store.sensors.map((s) => s.id));
    const existingSimIds = new Set(store.sims.map((s) => s.id));

    onCommit({
      connection: updatedConn,
      bindings: draftBindings,
      allocations: finalAllocations,
      addedDevices: localDevices.filter((d) => !existingDevIds.has(d.id)),
      addedSensors: localSensors.filter((s) => !existingSenIds.has(s.id)),
      addedSims: localSims.filter((s) => !existingSimIds.has(s.id)),
      isEdit
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-900/45 backdrop-blur-[1px]">
      <div className="w-full max-w-[1040px] bg-[#F8FAFC] h-full shadow-2xl border-l border-slate-200 flex flex-col">
        {/* Sticky Drawer Header */}
        <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>Assets Mapping</span>
              <span>·</span>
              <span className="font-semibold text-slate-700">{targetClient}</span>
              <span>·</span>
              <span className="font-mono text-slate-600">{connId}</span>
            </div>
            <h2 className="text-[16px] font-bold text-slate-900 mt-0.5">
              {isEdit ? `Edit Mapping · ${connName || connId}` : 'Create Mapping'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable 3-Section Workflow */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {hasVersionConflict && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Concurrent modification notice: Another user updated {connId} to version {liveVersion} while this form was open.
              </span>
            </div>
          )}

          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[12px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
              <button type="button" onClick={() => setFormError(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* SECTION 1: BASIC DETAILS */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <SectionBadge
              num={1}
              title="Basic Details"
              subtitle="Connection metadata and optional purpose label"
            />
            <div className="space-y-3 text-[12px]">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-800">
                    Organization Name <span className="text-rose-600">*</span>
                  </label>
                  <MappingInfoTooltip
                    text={
                      isPlatformAdmin
                        ? 'Select the parent or child organization whose hardware and vehicles/drivers will be mapped in this connection.'
                        : 'Organization prefilled from your active top-bar company context.'
                    }
                    align="right"
                  />
                </div>
                <select
                  value={targetClient}
                  disabled={!isPlatformAdmin}
                  onChange={(e) => {
                    setTargetClient(e.target.value);
                    setSelectedResourcePick(null);
                    setResSearch('');
                  }}
                  className={`w-full h-9 px-3 rounded-lg border border-slate-200 font-semibold focus:outline-none focus:border-[#F26522] ${
                    !isPlatformAdmin
                      ? 'bg-slate-50 text-slate-600 cursor-not-allowed'
                      : 'bg-white text-slate-900'
                  }`}
                >
                  {Array.from(new Set([targetClient, ...availableOrganizations].filter(Boolean))).map((org) => (
                    <option key={org} value={org}>
                      {org}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-800">
                    Connection Name (Optional)
                  </label>
                  <MappingInfoTooltip text={MODAL_FIELD_TOOLTIPS.mapping.connectionName} align="right" />
                </div>
                <input
                  type="text"
                  value={connName}
                  onChange={(e) => setConnName(e.target.value)}
                  placeholder="e.g. Mundra – Vehicle Kit 01 (Optional)"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#F26522]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-800">Purpose / Description (Optional)</label>
                  <span className="text-[10.5px] text-slate-400 tabular-nums">{description.length}/200</span>
                </div>
                <input
                  type="text"
                  maxLength={200}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. ADAS + Temperature & Fuel Sensors + M2M SIM + Auxiliary GPS Tracker"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 focus:outline-none focus:border-[#F26522]"
                />
              </div>
            </div>
          </section>

          {/* SECTION 2: HARDWARE COMPOSITION & BINDING (UNIFIED) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <SectionBadge
              num={2}
              title="Hardware Composition & Binding"
              subtitle="Add registered Devices, Sensors & SIMs and define their parent-child validity together inline."
              tooltip="Every parent-child link is stored as an independent pairwise binding record with exact date-time validity. Use + Device, + Sensor, or + SIM directly on any Device row to skip re-selecting the parent."
              right={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setComposerState({
                        mode: 'add-hardware',
                        category: 'Device',
                        parentHardwareId: members.find((m) => m.category === 'Device' && m.isPrimary)?.hardwareId || null
                      })
                    }
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#F26522]/35 bg-[#FFF3EE] hover:bg-[#ffe5db] text-[#F26522] text-[12px] font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <Cpu className="w-3.5 h-3.5" /> + Add Device
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setComposerState({
                        mode: 'add-hardware',
                        category: 'Sensor',
                        parentHardwareId: members.find((m) => m.category === 'Device' && m.isPrimary)?.hardwareId || null
                      })
                    }
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[12px] font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <Radio className="w-3.5 h-3.5" /> + Add Sensor
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setComposerState({
                        mode: 'add-hardware',
                        category: 'SIM',
                        parentHardwareId:
                          members.find((m) => m.category === 'Device' && m.isPrimary)?.hardwareId ||
                          members.find((m) => m.category === 'Sensor')?.hardwareId ||
                          null
                      })
                    }
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[12px] font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <Smartphone className="w-3.5 h-3.5" /> + Add SIM
                  </button>
                </div>
              }
            />

            {members.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-[#FFF3EE] text-[#F26522] inline-flex items-center justify-center mx-auto">
                  <Package className="w-5 h-5" />
                </div>
                <div className="text-[13px] font-bold text-slate-900">Start by adding Hardware units</div>
                <p className="text-[11.5px] text-slate-500 max-w-md mx-auto">
                  Add a registered Device (such as an ADAS/DMS Dashcam, GPS Tracker, or MDVR) or a supported Standalone Sensor for{' '}
                  <strong className="text-slate-700">{targetClient}</strong>. Then attach Sensors, SIMs, and chained Devices directly from each row.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                    type="button"
                    onClick={() => setComposerState({ mode: 'add-hardware', category: 'Device', parentHardwareId: null })}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-[#F26522] hover:bg-[#d95417] text-white text-[12px] font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Device
                  </button>
                  <button
                    type="button"
                    onClick={() => setComposerState({ mode: 'add-hardware', category: 'Sensor', parentHardwareId: null })}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-semibold cursor-pointer"
                  >
                    Add Standalone Sensor
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
                <table className="w-full border-collapse text-left text-[11.5px]">
                  <thead className="bg-[#F8FAFC] border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 w-8">#</th>
                      <th className="px-3 py-2 min-w-[235px]">Hardware & Relationship</th>
                      <th className="px-2.5 py-2 min-w-[140px]">Model / Type</th>
                      <th className="px-2.5 py-2 min-w-[155px]">Unique Identifier</th>
                      <th className="px-2.5 py-2 min-w-[125px]">Connected To</th>
                      <th className="px-2.5 py-2 min-w-[100px]">Binding Mode</th>
                      <th className="px-2.5 py-2 min-w-[145px]">Effective Start</th>
                      <th className="px-2.5 py-2 min-w-[145px]">Effective End</th>
                      <th className="px-2.5 py-2 min-w-[95px]">Status</th>
                      <th className="px-3 py-2 text-right min-w-[215px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {compositionRows.map((row) => {
                      const b = row.binding;
                      const m = row.member;
                      const isHoveredParent = hoveredParentId && row.member.hardwareId === hoveredParentId;
                      const isHoveredChild = hoveredParentId && b?.fromHardwareId === hoveredParentId;
                      const isDevice = m.category === 'Device';
                      const isSensor = m.category === 'Sensor';
                      const hasChildren = compositionRows.some((r) => r.binding?.fromHardwareId === m.hardwareId);

                      return (
                        <tr
                          key={row.rowKey}
                          onMouseEnter={() => {
                            if (isDevice || hasChildren) setHoveredParentId(m.hardwareId);
                            else if (b) setHoveredParentId(b.fromHardwareId);
                          }}
                          onMouseLeave={() => setHoveredParentId(null)}
                          className={`transition-colors ${
                            row.isPrimaryRoot
                              ? 'bg-[#FFF9F6]'
                              : isHoveredParent || isHoveredChild
                              ? 'bg-orange-50/40'
                              : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="px-3 py-2 text-slate-500 tabular-nums align-middle">{row.rowNumber}</td>

                          {/* Hardware & Relationship Tree Connectors */}
                          <td className="px-3 py-2 align-middle">
                            <div className="flex items-center">
                              {row.depth > 0 && (
                                <div className="flex items-center shrink-0">
                                  {row.ancestorHasNext.map((hasNext, idx) => (
                                    <div key={idx} className="w-5 h-9 relative shrink-0">
                                      {hasNext && (
                                        <span className="absolute left-2.5 top-0 bottom-0 w-px bg-slate-300" />
                                      )}
                                    </div>
                                  ))}
                                  <div className="w-6 h-9 relative shrink-0 mr-1">
                                    <span
                                      className={`absolute left-2.5 top-0 w-px bg-slate-300 ${
                                        row.isLastSibling ? 'h-[18px]' : 'bottom-0'
                                      }`}
                                    />
                                    <span className="absolute left-2.5 top-[18px] w-3 h-px bg-slate-300" />
                                    <span className="absolute left-[19px] top-[15.5px] w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  </div>
                                </div>
                              )}

                              <div
                                className={`flex items-center gap-2 min-w-0 ${
                                  row.isPrimaryRoot
                                    ? 'px-2.5 py-1.5 rounded-lg bg-[#FFF3EE] border border-[#F26522]/30'
                                    : ''
                                }`}
                              >
                                <HardwareUnitIcon category={m.category} modelLabel={m.modelLabel} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900 truncate">
                                      {m.category}
                                    </span>
                                    {false && m.isPrimary && (
                                      <span className="text-[10px] font-bold text-[#F26522]">
                                        (Primary)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10.5px] font-mono font-semibold text-slate-700 truncate">
                                    {m.identifierValue}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-2.5 py-2 text-slate-700 align-middle">
                            <div className="truncate max-w-[165px]" title={m.modelLabel}>
                              {m.modelLabel}
                            </div>
                          </td>

                          <td className="px-2.5 py-2 align-middle">
                            <div className="font-mono font-semibold text-slate-900">{m.identifierValue}</div>
                            <div className="text-[10px] text-slate-400">{m.identifierType}</div>
                          </td>

                          <td className="px-2.5 py-2 align-middle">
                            {row.parentMember ? (
                              <div>
                                <div className="font-mono font-semibold text-slate-800">
                                  {row.parentMember.identifierValue}
                                </div>
                                {b?.portOrSlot && (
                                  <div className="text-[10px] text-slate-500">Port: {b.portOrSlot}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="px-2.5 py-2 align-middle whitespace-nowrap">
                            {b ? (
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                  b.mode === 'Permanent' ? 'text-sky-700' : 'text-[#F26522]'
                                }`}
                              >
                                {b.mode === 'Permanent' ? (
                                  <InfinityIcon className="w-3 h-3" />
                                ) : (
                                  <Clock className="w-3 h-3" />
                                )}
                                {b.mode}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="px-2.5 py-2 text-[10.5px] text-slate-700 whitespace-nowrap align-middle tabular-nums">
                            {b ? formatDateTimeWithTz(b.effectiveStartAt, b.timezone, true) : '—'}
                          </td>

                          <td className="px-2.5 py-2 text-[10.5px] text-slate-700 whitespace-nowrap align-middle tabular-nums">
                            {b && (b.endedAt || b.effectiveEndAt)
                              ? formatDateTimeWithTz(b.endedAt || b.effectiveEndAt, b.timezone, true)
                              : '—'}
                          </td>

                          <td className="px-2.5 py-2 align-middle whitespace-nowrap">
                            <span
                              title={row.statusReason}
                              className={`text-[11px] font-semibold ${
                                row.displayStatus === 'Root (Primary)' || row.displayStatus === 'Bound'
                                  ? 'text-emerald-700'
                                  : row.displayStatus === 'Scheduled'
                                  ? 'text-sky-700'
                                  : row.displayStatus === 'Conflict'
                                  ? 'text-rose-700'
                                  : row.displayStatus === 'Expired'
                                  ? 'text-slate-500'
                                  : 'text-amber-700'
                              }`}
                            >
                              {row.displayStatus === 'Unbound' && !b && m.category === 'Sensor'
                                ? 'Standalone'
                                : row.displayStatus}
                            </span>
                          </td>

                          {/* Contextual Actions on Device & Binding Rows */}
                          <td className="px-3 py-2 text-right align-middle whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1">
                              {isDevice && (
                                <>
                                  <button
                                    type="button"
                                    title={`Connect another Device under ${m.identifierValue}`}
                                    onClick={() =>
                                      setComposerState({
                                        mode: 'add-hardware',
                                        category: 'Device',
                                        parentHardwareId: m.hardwareId
                                      })
                                    }
                                    className="px-1.5 py-1 rounded border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10.5px] font-semibold cursor-pointer"
                                  >
                                    + Device
                                  </button>
                                  <button
                                    type="button"
                                    title={`Attach Sensor under ${m.identifierValue}`}
                                    onClick={() =>
                                      setComposerState({
                                        mode: 'add-hardware',
                                        category: 'Sensor',
                                        parentHardwareId: m.hardwareId
                                      })
                                    }
                                    className="px-1.5 py-1 rounded border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-[10.5px] font-semibold cursor-pointer"
                                  >
                                    + Sensor
                                  </button>
                                  <button
                                    type="button"
                                    title={`Attach SIM to ${m.identifierValue}`}
                                    onClick={() =>
                                      setComposerState({
                                        mode: 'add-hardware',
                                        category: 'SIM',
                                        parentHardwareId: m.hardwareId
                                      })
                                    }
                                    className="px-1.5 py-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10.5px] font-semibold cursor-pointer"
                                  >
                                    + SIM
                                  </button>
                                  {false && !m.isPrimary && (
                                    <button
                                      type="button"
                                      title="Designate as Primary Device"
                                      onClick={() =>
                                        setMembers((prev) =>
                                          prev.map((x) => ({
                                            ...x,
                                            isPrimary: x.hardwareId === m.hardwareId
                                          }))
                                        )
                                      }
                                      className="p-1 rounded text-slate-400 hover:text-[#F26522] cursor-pointer"
                                    >
                                      <Star className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}

                              {isSensor && (
                                <button
                                  type="button"
                                  title={`Attach SIM to ${m.identifierValue}`}
                                  onClick={() =>
                                    setComposerState({
                                      mode: 'add-hardware',
                                      category: 'SIM',
                                      parentHardwareId: m.hardwareId
                                    })
                                  }
                                  className="px-1.5 py-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10.5px] font-semibold cursor-pointer"
                                >
                                  + SIM
                                </button>
                              )}

                              {b && row.displayStatus !== 'Expired' && (
                                <button
                                  type="button"
                                  title="Edit binding validity / parent / port"
                                  onClick={() =>
                                    setComposerState({
                                      mode: 'edit-binding',
                                      category: m.category,
                                      editingBinding: b
                                    })
                                  }
                                  className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {b && isEdit && row.displayStatus !== 'Expired' && (
                                <button
                                  type="button"
                                  title="End binding now (preserves audit history)"
                                  onClick={() => setEndingBinding(b)}
                                  className="p-1 rounded text-amber-600 hover:bg-amber-50 cursor-pointer"
                                >
                                  <StopCircle className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {!row.isAdditionalBindingRef && (
                                <button
                                  type="button"
                                  title="Remove hardware unit"
                                  onClick={() => handleRequestRemoveMember(m)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* End Binding Inline Prompt (Edit Mode History Preservation) */}
            {endingBinding && (
              <div className="mt-3 p-3 rounded-xl border border-amber-200 bg-amber-50/70 space-y-2 text-[12px]">
                <div className="font-bold text-amber-900">
                  End Binding {endingBinding.id} (Preserves Historical Record)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="date"
                    value={endBindDate}
                    onChange={(e) => setEndBindDate(e.target.value)}
                    className="h-8 px-2 rounded border border-amber-200 bg-white text-[11px]"
                  />
                  <input
                    type="time"
                    step="1"
                    value={endBindTime}
                    onChange={(e) => setEndBindTime(e.target.value)}
                    className="h-8 px-2 rounded border border-amber-200 bg-white text-[11px]"
                  />
                  <input
                    type="text"
                    value={endBindReason}
                    onChange={(e) => setEndBindReason(e.target.value)}
                    placeholder="Reason..."
                    className="h-8 px-2 rounded border border-amber-200 bg-white text-[11px]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEndingBinding(null)}
                    className="h-7 px-2.5 rounded border border-slate-200 bg-white text-[11px] font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmEndBinding}
                    className="h-7 px-3 rounded bg-amber-600 text-white text-[11px] font-semibold cursor-pointer"
                  >
                    Confirm End Binding
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* SECTION 3: RESOURCE ALLOCATION (OPTIONAL) */}
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <SectionBadge
              num={3}
              title="Resource Allocation (Optional)"
              subtitle="Associate one or more Vehicles, Drivers, or client resources independently."
              tooltip="Vehicle lookup uses Registration Number; Driver lookup uses Contact Number. Driver allocation remains independent of physical Device-to-Vehicle mapping."
            />

            {/* Step 3 Sub-Tabs: Hardware -> Resource (Default) | Resource -> Resource (New) */}
            <div className="flex items-center gap-1 border-b border-slate-200 mb-3.5">
              <button
                type="button"
                onClick={() => setStep3Tab('hardware-resource')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer ${
                  step3Tab === 'hardware-resource'
                    ? 'border-[#F26522] text-[#F26522]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                Hardware → Resource
                {draftAllocations.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#FFF3EE] text-[#F26522] border border-[#F26522]/30 tabular-nums">
                    {draftAllocations.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setStep3Tab('resource-resource')}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold border-b-2 transition-colors cursor-pointer ${
                  step3Tab === 'resource-resource'
                    ? 'border-[#F26522] text-[#F26522]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                Resource → Resource
                {(() => {
                  const hasSelected = (t: string, id: string, ident: string) =>
                    draftAllocations.some(
                      (a) =>
                        a.resourceType === t &&
                        (a.resourceId === id ||
                          a.resourceIdentifier.trim().toLowerCase() === ident.trim().toLowerCase())
                    );
                  const cnt = (store.resourceRelationships || []).filter(
                    (r) =>
                      !r.endedAt &&
                      r.companyName === targetClient &&
                      hasSelected(r.sourceResourceType, r.sourceResourceId, r.sourceResourceIdentifier) &&
                      hasSelected(r.targetResourceType, r.targetResourceId, r.targetResourceIdentifier)
                  ).length;
                  return cnt > 0 ? (
                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                      {cnt}
                    </span>
                  ) : null;
                })()}
              </button>
            </div>

            {step3Tab === 'hardware-resource' ? (
              <>
            {/* Multi-Resource Allocation Builder */}
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 text-[12px]">
              <div className="grid grid-cols-4 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Resource Type</label>
                  <select
                    value={resType}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '__create_vehicle__') {
                        setResType('Vehicle');
                        setResSearch('');
                        setSelectedResourcePick(null);
                        setResDropdownOpen(false);
                        setQcResType('Vehicle');
                        return;
                      }
                      if (val === '__create_driver__') {
                        setResType('Driver');
                        setResSearch('');
                        setSelectedResourcePick(null);
                        setResDropdownOpen(false);
                        setQcResType('Driver');
                        return;
                      }
                      setResType(val as ResourceType);
                      setResSearch('');
                      setSelectedResourcePick(null);
                      setQcResType(null);
                    }}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white font-semibold"
                  >
                    <option value="Vehicle">Vehicle (Reg No.)</option>
                    <option value="Driver">Driver (Contact No.)</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Fleet">Fleet</option>
                    <option value="Place">Place / Site</option>
                    <option value="__create_vehicle__">+ Create New Vehicle...</option>
                    <option value="__create_driver__">+ Create New Driver...</option>
                  </select>
                </div>

                <div className="col-span-2 relative" ref={resBoxRef}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <label className="font-semibold text-slate-700">
                      {resType === 'Vehicle'
                        ? 'Search Vehicle Registration No.'
                        : resType === 'Driver'
                        ? 'Search Driver Contact No. / Name'
                        : `Enter ${resType} Identifier`}
                    </label>
                    {(resType === 'Vehicle' || resType === 'Driver') && (
                      <button
                        type="button"
                        onClick={() => {
                          if (resType === 'Vehicle') setQcVehReg(resSearch.trim().toUpperCase());
                          else setQcDrvPhone(resSearch.trim());
                          setQcResType(resType);
                          setResDropdownOpen(false);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#F26522] hover:underline cursor-pointer shrink-0"
                      >
                        <Plus className="w-3 h-3" /> New {resType}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={resSearch}
                      onFocus={() => setResDropdownOpen(true)}
                      onChange={(e) => {
                        setResSearch(e.target.value);
                        setSelectedResourcePick(null);
                        setResDropdownOpen(true);
                      }}
                      placeholder={
                        resType === 'Vehicle'
                          ? 'e.g. MH26AH1192...'
                          : resType === 'Driver'
                          ? 'e.g. 9876543210...'
                          : `Enter ${resType} identifier...`
                      }
                      className="w-full h-9 pl-3 pr-8 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#F26522]"
                    />
                    {resSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setResSearch('');
                          setSelectedResourcePick(null);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {resDropdownOpen && (resType === 'Vehicle' || resType === 'Driver') && (
                    <div className="absolute left-0 right-0 top-full mt-1 border border-slate-200 rounded-xl bg-white shadow-xl max-h-56 overflow-y-auto z-20 divide-y divide-slate-100">
                      {resourceMatches.length === 0 ? (
                        <div className="p-3 text-center space-y-1.5">
                          <div className="text-[11px] text-slate-500">
                            No matching {resType} found in {targetClient} Master.
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (resType === 'Vehicle') setQcVehReg(resSearch.trim().toUpperCase());
                              else setQcDrvPhone(resSearch.trim());
                              setQcResType(resType);
                              setResDropdownOpen(false);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F26522] hover:bg-[#d95417] text-white text-[11px] font-semibold cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> Create New {resType}
                          </button>
                        </div>
                      ) : (
                        <>
                          {resourceMatches.map((m) => (
                            <button
                              key={m.resourceId}
                              type="button"
                              onClick={() => {
                                setSelectedResourcePick({
                                  resourceId: m.resourceId,
                                  resourceIdentifier: m.resourceIdentifier,
                                  resourceDisplayName: m.resourceDisplayName
                                });
                                setResSearch(m.resourceIdentifier);
                                setResDropdownOpen(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 flex items-center gap-2">
                                  <span>{m.resourceIdentifier}</span>
                                  {m.existingConn && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                      Linked in {m.existingConn}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10.5px] text-slate-500 truncate">{m.subtitle}</div>
                              </div>
                              <span className="text-[11px] text-[#F26522] font-semibold shrink-0">Select</span>
                            </button>
                          ))}
                          <div className="sticky bottom-0 px-3 py-2 bg-[#FFF9F6] border-t border-slate-200 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-600">
                              Not listed in {targetClient} Master?
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (resType === 'Vehicle') setQcVehReg(resSearch.trim().toUpperCase());
                                else setQcDrvPhone(resSearch.trim());
                                setQcResType(resType);
                                setResDropdownOpen(false);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F26522] hover:bg-[#d95417] text-white text-[11px] font-semibold cursor-pointer shrink-0"
                            >
                              <Plus className="w-3 h-3" /> Create New {resType}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hardware Scope</label>
                  <select
                    value={resHardwareScopeId}
                    onChange={(e) => setResHardwareScopeId(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-[11.5px]"
                  >
                    <option value="">All Connected Hardware</option>
                    {members
                      .filter((m) => m.category !== 'SIM')
                      .map((m) => (
                        <option key={m.hardwareId} value={m.hardwareId}>
                          [{m.category}] {m.identifierValue}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Independent Resource Validity + Add Button */}
              <div className="grid grid-cols-12 gap-2.5 items-end">
                <div className="col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">Allocation Validity</label>
                  <select
                    value={resMode}
                    onChange={(e) => setResMode(e.target.value as HardwareBindingMode)}
                    className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-[11.5px]"
                  >
                    <option value="Permanent">Permanent (Open-ended)</option>
                    <option value="Temporal">Temporal (Defined End)</option>
                  </select>
                </div>

                <div className="col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">Start Date & Time</label>
                  <div className="flex gap-1">
                    <input
                      type="date"
                      value={resStartDate}
                      onChange={(e) => setResStartDate(e.target.value)}
                      className="w-[115px] h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                    />
                    <input
                      type="time"
                      step="1"
                      value={resStartTime}
                      onChange={(e) => setResStartTime(e.target.value)}
                      className="flex-1 h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                    />
                  </div>
                </div>

                <div className="col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">
                    End Date & Time {resMode === 'Temporal' && '*'}
                  </label>
                  {resMode === 'Permanent' ? (
                    <div className="h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 flex items-center text-[11px]">
                      Open-ended
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <input
                        type="date"
                        value={resEndDate}
                        onChange={(e) => setResEndDate(e.target.value)}
                        className="w-[115px] h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                      />
                      <input
                        type="time"
                        step="1"
                        value={resEndTime}
                        onChange={(e) => setResEndTime(e.target.value)}
                        className="flex-1 h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                      />
                    </div>
                  )}
                </div>

                <div className="col-span-1">
                  <label className="block font-semibold text-slate-700 mb-1">TZ</label>
                  <select
                    value={resTimezone}
                    onChange={(e) => setResTimezone(e.target.value)}
                    className="w-full h-8 px-1.5 rounded-lg border border-slate-200 bg-white text-[11px]"
                  >
                    {SUPPORTED_TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label.split(' ')[0]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleStageResourceAllocation}
                    className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#FFF3EE] hover:bg-[#ffe5db] border border-[#F26522]/35 text-[#F26522] text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Resource
                  </button>
                </div>
              </div>

            </div>

            {/* Staged Resource Allocations Table */}
            {draftAllocations.length > 0 && (
              <div className="mt-3 border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-[11.5px]">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">Resource Type</th>
                      <th className="px-3 py-2">Identifier</th>
                      <th className="px-3 py-2">Hardware Scope</th>
                      <th className="px-3 py-2">Validity</th>
                      <th className="px-3 py-2">Effective Start</th>
                      <th className="px-3 py-2">Effective End</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {draftAllocations.map((a) => {
                      const scopedMem = a.hardwareId ? memberMap.get(a.hardwareId) : null;
                      return (
                        <tr key={a.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2 font-semibold text-slate-800">
                            <span className="inline-flex items-center gap-1.5">
                              {a.resourceType === 'Vehicle' ? (
                                <Truck className="w-3.5 h-3.5 text-sky-600" />
                              ) : (
                                <User className="w-3.5 h-3.5 text-purple-600" />
                              )}
                              {a.resourceType}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-mono font-bold text-slate-900">{a.resourceIdentifier}</div>
                            <div className="text-[10px] text-slate-500">{a.resourceDisplayName}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {scopedMem ? `[${scopedMem.category}] ${scopedMem.identifierValue}` : 'All Connected Hardware'}
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-700">{a.mode}</td>
                          <td className="px-3 py-2 text-[10.5px] text-slate-600 tabular-nums">
                            {formatDateTimeWithTz(a.effectiveStartAt, a.timezone, true)}
                          </td>
                          <td className="px-3 py-2 text-[10.5px] text-slate-600 tabular-nums">
                            {a.effectiveEndAt ? formatDateTimeWithTz(a.effectiveEndAt, a.timezone, true) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => setDraftAllocations((prev) => prev.filter((x) => x.id !== a.id))}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
              </>
            ) : (
              <ResourceRelationshipsPanel
                targetClient={targetClient}
                actorName={actorName}
                store={store}
                selectedAllocations={draftAllocations}
                onGoToHardwareResource={() => setStep3Tab('hardware-resource')}
                showToast={showToast}
              />
            )}
          </section>
        </div>

        {/* Sticky Drawer Footer */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => executeCommit('draft')}
              className="h-9 px-4 rounded-lg border border-[#F26522]/40 bg-[#FFF3EE] text-[#F26522] hover:bg-[#ffe5db] text-[12px] font-semibold cursor-pointer"
            >
              Save as Draft
            </button>

            <button
              type="button"
              onClick={() => {
                if (!canActivate.ok) {
                  setFormError(canActivate.reason);
                  return;
                }
                setConfirmAction(true);
              }}
              className={`inline-flex items-center gap-1.5 h-9 px-5 rounded-lg text-[12px] font-semibold text-white cursor-pointer ${
                canActivate.ok ? 'bg-[#F26522] hover:bg-[#d95417]' : 'bg-slate-300 hover:bg-slate-400'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isEdit ? 'Save & Activate Mapping' : 'Activate Mapping'}
            </button>
          </div>
        </div>
      </div>

      {/* Nested Hardware Composition & Binding Drawer */}
      {composerState && (
        <HardwareCompositionModal
          mode={composerState.mode}
          category={composerState.category}
          initialParentId={composerState.parentHardwareId}
          editingBinding={composerState.editingBinding}
          connId={connId}
          targetClient={targetClient}
          site={site}
          enabledModels={enabledModels}
          members={members}
          draftBindings={draftBindings}
          allGlobalBindings={allGlobalBindings}
          allConnections={store.connections}
          localDevices={localDevices}
          localSensors={localSensors}
          localSims={localSims}
          defaultBinding={lastBindingDefaults}
          onQuickRegisterHardware={(unit) => {
            if (unit.device) {
              setLocalDevices((prev) =>
                prev.some((d) => d.id === unit.device!.id) ? prev : [unit.device!, ...prev]
              );
            }
            if (unit.sensor) {
              setLocalSensors((prev) =>
                prev.some((s) => s.id === unit.sensor!.id) ? prev : [unit.sensor!, ...prev]
              );
            }
            if (unit.sim) {
              setLocalSims((prev) =>
                prev.some((s) => s.id === unit.sim!.id) ? prev : [unit.sim!, ...prev]
              );
            }
            onQuickRegisterHardware?.(unit);
            const label =
              unit.device?.deviceId || unit.sensor?.deviceId || unit.sim?.iccid || 'Hardware';
            showToast(`Registered ${label} under ${targetClient} & selected.`);
          }}
          onSave={handleCompositionSave}
          onClose={() => setComposerState(null)}
        />
      )}

      {/* Safe Device Removal with Impacted Children Dialog */}
      {removingDevice && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-[14px]">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Impacted Child Hardware ({removingDevice.impactedChildren.length})
              </div>
              <button type="button" onClick={() => setRemovingDevice(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-[12px]">
              <p className="text-slate-600">
                Removing {removingDevice.member.category}{' '}
                <strong className="font-mono text-slate-900">{removingDevice.member.identifierValue}</strong> affects{' '}
                <strong>{removingDevice.impactedChildren.length}</strong> connected unit(s):
              </p>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                {removingDevice.impactedChildren.map((child) => (
                  <div key={child.hardwareId} className="flex items-center gap-2 text-[11.5px]">
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="font-semibold text-slate-700">{child.category}</span>
                    <span className="font-mono text-slate-900">{child.identifierValue}</span>
                  </div>
                ))}
              </div>

              {members.some(
                (m) =>
                  (m.category === 'Device' ||
                    (removingDevice.member.category === 'Sensor' && m.category === 'Sensor')) &&
                  m.hardwareId !== removingDevice.member.hardwareId
              ) && (
                <div className="space-y-1.5 pt-1">
                  <label className="block font-semibold text-slate-800">
                    Reassign children to another valid Device or Sensor:
                  </label>
                  <select
                    value={reassignTargetDeviceId}
                    onChange={(e) => setReassignTargetDeviceId(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 bg-white"
                  >
                    {members
                      .filter(
                        (m) =>
                          (m.category === 'Device' ||
                            (removingDevice.member.category === 'Sensor' && m.category === 'Sensor')) &&
                          m.hardwareId !== removingDevice.member.hardwareId
                      )
                      .map((d) => (
                        <option key={d.hardwareId} value={d.hardwareId}>
                          [{d.category}] {d.identifierValue} · {d.modelLabel}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between gap-2 bg-slate-50 flex-wrap">
              <button
                type="button"
                onClick={() => setRemovingDevice(null)}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirmRemoveDeviceWithChildren('remove-bindings')}
                  className="h-8 px-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-[12px] font-semibold cursor-pointer"
                >
                  {isEdit ? 'Remove & End Bindings' : `Remove ${removingDevice.member.category} & Bindings`}
                </button>
                {reassignTargetDeviceId && (
                  <button
                    type="button"
                    onClick={() => handleConfirmRemoveDeviceWithChildren('reassign')}
                    className="h-8 px-3.5 rounded-lg bg-[#F26522] hover:bg-[#d95417] text-white text-[12px] font-semibold cursor-pointer"
                  >
                    Reassign & Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Summary Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-slate-900">
                Confirm Activation · {connId}
              </h3>
              <button type="button" onClick={() => setConfirmAction(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-[12px]">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div>
                  <span className="font-semibold text-slate-600">Connection:</span>{' '}
                  <strong className="text-slate-900">{connName}</strong> ({targetClient} · {site})
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Hardware:</span>{' '}
                  {members.filter((m) => m.category === 'Device').length} Device(s),{' '}
                  {members.filter((m) => m.category === 'Sensor').length} Sensor(s),{' '}
                  {members.filter((m) => m.category === 'SIM').length} SIM(s)
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Pairwise Bindings:</span> {draftBindings.length} binding(s)
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Target Status:</span>{' '}
                  <strong className="text-emerald-700">{computedTargetStatus}</strong>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                All relationships are stored as independent pairwise binding records. Active binding status confirms configuration validity, not live device online telemetry.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setConfirmAction(false)}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold cursor-pointer"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmAction(false);
                  executeCommit('activate');
                }}
                className="h-8 px-4 rounded-lg bg-[#F26522] hover:bg-[#d95417] text-white text-[12px] font-semibold cursor-pointer"
              >
                Confirm & Save Mapping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Vehicle / Driver Master Create Drawers (z-[110]) */}
      <VehicleDrawer
        isOpen={qcResType === 'Vehicle'}
        onClose={() => setQcResType(null)}
        mode="create"
        initialVehicle={qcVehReg ? ({ registration_number: qcVehReg } as Vehicle) : null}
        onSaveVehicle={handleCreatedVehicle}
        existingVehicles={vehicles}
        companyContext={targetClient}
        zIndexClass="z-[110]"
      />
      <DriverDrawer
        isOpen={qcResType === 'Driver'}
        onClose={() => setQcResType(null)}
        mode="create"
        initialDriver={qcDrvPhone ? ({ phone: qcDrvPhone } as Driver) : null}
        onSaveDriver={handleCreatedDriver}
        existingDrivers={drivers}
        companyContext={targetClient}
        zIndexClass="z-[110]"
      />
    </div>
  );
};
