import { create } from 'zustand';

export type AssetLevel = 'company' | 'plant' | 'area' | 'machine' | 'equipment' | 'equipmentType';
export type EquipmentTypeId = string;

export interface AssetNode {
  id: string;
  label: string;
  code?: string;
}

export interface AssetTreeNode {
  id: string;
  label: string;
  code: string;
  level: AssetLevel;
  bridge_url?: string;
  children: AssetTreeNode[];
}

export interface EquipmentTypeNode extends AssetNode {
  id: EquipmentTypeId;
}

// Fallback hierarchy used when API is unreachable
const FALLBACK_HIERARCHY: AssetTreeNode[] = [
  {
    id: 'oswar-software', label: 'Oswar Software', code: 'OSWAR', level: 'company',
    children: [{
      id: 'phase-1-demo-plant', label: 'Phase 1 Demo Plant', code: 'P1', level: 'plant',
      children: [{
        id: 'production-area-a', label: 'Production Area A', code: 'AREA-A', level: 'area',
        children: [{
          id: 'rav-line-01', label: 'RAV Line 01', code: 'RAV-01', level: 'machine',
          children: [{
            id: 'feed-system-01', label: 'Feed System 01', code: 'FS-01', level: 'equipment',
            children: [
              { id: 'motor-fs01', label: 'Motor', code: 'MTR', level: 'equipmentType', children: [] },
              { id: 'pump-fs01', label: 'Pump', code: 'PMP', level: 'equipmentType', children: [] },
              { id: 'fan-fs01', label: 'Fan', code: 'FAN', level: 'equipmentType', children: [] },
              { id: 'rotary-airlock-valve-fs01', label: 'Rotary Airlock Valve', code: 'RAV', level: 'equipmentType', children: [] },
            ],
          }],
        }],
      }],
    }],
  },
  {
    id: 'oswar-test-company', label: 'Oswar Test Company', code: 'TEST', level: 'company',
    children: [{
      id: 'training-plant', label: 'Training Plant', code: 'TRN', level: 'plant',
      children: [{
        id: 'demo-area', label: 'Demo Area', code: 'DEMO', level: 'area',
        children: [{
          id: 'training-machine', label: 'Training Machine', code: 'TM-01', level: 'machine',
          children: [{
            id: 'training-equipment', label: 'Training Equipment', code: 'TE-01', level: 'equipment',
            children: [
              { id: 'motor-te01', label: 'Motor', code: 'MTR', level: 'equipmentType', children: [] },
              { id: 'pump-te01', label: 'Pump', code: 'PMP', level: 'equipmentType', children: [] },
              { id: 'fan-te01', label: 'Fan', code: 'FAN', level: 'equipmentType', children: [] },
              { id: 'rotary-airlock-valve-te01', label: 'Rotary Airlock Valve', code: 'RAV', level: 'equipmentType', children: [] },
            ],
          }],
        }],
      }],
    }],
  },
];

// Compat: legacy static shape for components that still use it
export const ASSET_HIERARCHY = {
  companies: FALLBACK_HIERARCHY.map((c) => ({
    id: c.id,
    label: c.label,
    code: c.code,
    plants: c.children.map((p) => ({
      id: p.id,
      label: p.label,
      code: p.code,
      areas: p.children.map((a) => ({
        id: a.id,
        label: a.label,
        code: a.code,
        machines: a.children.map((m) => ({
          id: m.id,
          label: m.label,
          code: m.code,
          equipments: m.children.map((e) => ({
            id: e.id,
            label: e.label,
            code: e.code,
            equipmentTypes: e.children.map((et) => ({
              id: et.id as EquipmentTypeId,
              label: et.label,
              code: et.code,
            })),
          })),
        })),
      })),
    })),
  })),
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface AssetHierarchyStore {
  tree: AssetTreeNode[];
  loading: boolean;
  error: string | null;

  selectedCompanyId: string | null;
  selectedPlantId: string | null;
  selectedAreaId: string | null;
  selectedMachineId: string | null;
  selectedEquipmentId: string | null;
  selectedEquipmentTypeId: EquipmentTypeId | null;

  selectCompany: (id: string) => void;
  selectPlant: (id: string) => void;
  selectArea: (id: string) => void;
  selectMachine: (id: string) => void;
  selectEquipment: (id: string) => void;
  selectEquipmentType: (id: EquipmentTypeId) => void;
  backTo: (level: AssetLevel) => void;
  reset: () => void;

  fetchTree: (apiBase: string) => Promise<void>;
  addNode: (apiBase: string, parentId: string | null, level: AssetLevel, label: string, code: string) => Promise<void>;
  updateNode: (apiBase: string, nodeId: string, label: string, code: string) => Promise<void>;
  deleteNode: (apiBase: string, nodeId: string) => Promise<void>;
}

export const useAssetHierarchyStore = create<AssetHierarchyStore>((set, get) => ({
  tree: FALLBACK_HIERARCHY,
  loading: false,
  error: null,

  selectedCompanyId: null,
  selectedPlantId: null,
  selectedAreaId: null,
  selectedMachineId: null,
  selectedEquipmentId: null,
  selectedEquipmentTypeId: null,

  selectCompany: (selectedCompanyId) => set({
    selectedCompanyId,
    selectedPlantId: null,
    selectedAreaId: null,
    selectedMachineId: null,
    selectedEquipmentId: null,
    selectedEquipmentTypeId: null,
  }),
  selectPlant: (selectedPlantId) => set({
    selectedPlantId,
    selectedAreaId: null,
    selectedMachineId: null,
    selectedEquipmentId: null,
    selectedEquipmentTypeId: null,
  }),
  selectArea: (selectedAreaId) => set({
    selectedAreaId,
    selectedMachineId: null,
    selectedEquipmentId: null,
    selectedEquipmentTypeId: null,
  }),
  selectMachine: (selectedMachineId) => set({
    selectedMachineId,
    selectedEquipmentId: null,
    selectedEquipmentTypeId: null,
  }),
  selectEquipment: (selectedEquipmentId) => set({
    selectedEquipmentId,
    selectedEquipmentTypeId: null,
  }),
  selectEquipmentType: (selectedEquipmentTypeId) => set({ selectedEquipmentTypeId }),
  backTo: (level) => set((state) => ({
    selectedCompanyId: level === 'company' ? null : state.selectedCompanyId,
    selectedPlantId: ['company', 'plant'].includes(level) ? null : state.selectedPlantId,
    selectedAreaId: ['company', 'plant', 'area'].includes(level) ? null : state.selectedAreaId,
    selectedMachineId: ['company', 'plant', 'area', 'machine'].includes(level) ? null : state.selectedMachineId,
    selectedEquipmentId: ['company', 'plant', 'area', 'machine', 'equipment'].includes(level) ? null : state.selectedEquipmentId,
    selectedEquipmentTypeId: null,
  })),
  reset: () => set({
    selectedCompanyId: null,
    selectedPlantId: null,
    selectedAreaId: null,
    selectedMachineId: null,
    selectedEquipmentId: null,
    selectedEquipmentTypeId: null,
  }),

  fetchTree: async (apiBase: string) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${apiBase}/api/assets`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const tree: AssetTreeNode[] = await res.json();
      set({ tree, loading: false });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  addNode: async (apiBase, parentId, level, label, code) => {
    const res = await fetch(`${apiBase}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_id: parentId, level, label, code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    await get().fetchTree(apiBase);
  },

  updateNode: async (apiBase, nodeId, label, code) => {
    const res = await fetch(`${apiBase}/api/assets/${nodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    await get().fetchTree(apiBase);
  },

  deleteNode: async (apiBase, nodeId) => {
    const res = await fetch(`${apiBase}/api/assets/${nodeId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    await get().fetchTree(apiBase);
  },
}));

// ---------------------------------------------------------------------------
// Selector helpers (using tree structure)
// ---------------------------------------------------------------------------

type Company = { id: string; label: string; code: string; plants: Plant[] };
type Plant = { id: string; label: string; code: string; areas: Area[] };
type Area = { id: string; label: string; code: string; machines: Machine[] };
type Machine = { id: string; label: string; code: string; equipments: Equipment[] };
type Equipment = { id: string; label: string; code: string; equipmentTypes: EquipmentTypeNode[] };

function treeToCompanies(tree: AssetTreeNode[]): Company[] {
  return tree.filter(n => n.level === 'company').map(c => ({
    id: c.id, label: c.label, code: c.code,
    plants: c.children.filter(n => n.level === 'plant').map(p => ({
      id: p.id, label: p.label, code: p.code,
      areas: p.children.filter(n => n.level === 'area').map(a => ({
        id: a.id, label: a.label, code: a.code,
        machines: a.children.filter(n => n.level === 'machine').map(m => ({
          id: m.id, label: m.label, code: m.code,
          equipments: m.children.filter(n => n.level === 'equipment').map(e => ({
            id: e.id, label: e.label, code: e.code,
            equipmentTypes: e.children.filter(n => n.level === 'equipmentType').map(et => ({
              id: et.id as EquipmentTypeId, label: et.label, code: et.code,
            })),
          })),
        })),
      })),
    })),
  }));
}

export function getCompanies(): Company[] {
  const tree = useAssetHierarchyStore.getState().tree;
  return treeToCompanies(tree);
}

export function getSelectedCompany(companyId: string | null): Company | undefined {
  return getCompanies().find((c) => c.id === companyId);
}

export function getSelectedPlant(company: Company | undefined, plantId: string | null): Plant | undefined {
  return company?.plants.find((p) => p.id === plantId);
}

export function getSelectedArea(plant: Plant | undefined, areaId: string | null): Area | undefined {
  return plant?.areas.find((a) => a.id === areaId);
}

export function getSelectedMachine(area: Area | undefined, machineId: string | null): Machine | undefined {
  return area?.machines.find((m) => m.id === machineId);
}

export function getSelectedEquipment(machine: Machine | undefined, equipmentId: string | null): Equipment | undefined {
  return machine?.equipments.find((e) => e.id === equipmentId);
}

export function getAssetSelectionSnapshot() {
  const state = useAssetHierarchyStore.getState();
  const company = getSelectedCompany(state.selectedCompanyId);
  const plant = getSelectedPlant(company, state.selectedPlantId);
  const area = getSelectedArea(plant, state.selectedAreaId);
  const machine = getSelectedMachine(area, state.selectedMachineId);
  const equipment = getSelectedEquipment(machine, state.selectedEquipmentId);
  const equipmentType = equipment?.equipmentTypes.find((type) => type.id === state.selectedEquipmentTypeId);
  return { company, plant, area, machine, equipment, equipmentType };
}
