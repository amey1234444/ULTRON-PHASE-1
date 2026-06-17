import { create } from 'zustand';

export type AssetLevel = 'company' | 'plant' | 'area' | 'machine' | 'equipment' | 'equipmentType';
export type EquipmentTypeId = 'motor' | 'pump' | 'fan' | 'rotary-airlock-valve';

export interface AssetNode {
  id: string;
  label: string;
  code?: string;
}

export interface EquipmentTypeNode extends AssetNode {
  id: EquipmentTypeId;
}

export const ASSET_HIERARCHY = {
  companies: [
    {
      id: 'oswar-software',
      label: 'Oswar Software',
      code: 'OSWAR',
      plants: [
        {
          id: 'phase-1-demo-plant',
          label: 'Phase 1 Demo Plant',
          code: 'P1',
          areas: [
            {
              id: 'production-area-a',
              label: 'Production Area A',
              code: 'AREA-A',
              machines: [
                {
                  id: 'rav-line-01',
                  label: 'RAV Line 01',
                  code: 'RAV-01',
                  equipments: [
                    {
                      id: 'feed-system-01',
                      label: 'Feed System 01',
                      code: 'FS-01',
                      equipmentTypes: [
                        { id: 'motor', label: 'Motor', code: 'MTR' },
                        { id: 'pump', label: 'Pump', code: 'PMP' },
                        { id: 'fan', label: 'Fan', code: 'FAN' },
                        { id: 'rotary-airlock-valve', label: 'Rotary Airlock Valve', code: 'RAV' },
                      ] satisfies EquipmentTypeNode[],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'oswar-test-company',
      label: 'Oswar Test Company',
      code: 'TEST',
      plants: [
        {
          id: 'training-plant',
          label: 'Training Plant',
          code: 'TRN',
          areas: [
            {
              id: 'demo-area',
              label: 'Demo Area',
              code: 'DEMO',
              machines: [
                {
                  id: 'training-machine',
                  label: 'Training Machine',
                  code: 'TM-01',
                  equipments: [
                    {
                      id: 'training-equipment',
                      label: 'Training Equipment',
                      code: 'TE-01',
                      equipmentTypes: [
                        { id: 'motor', label: 'Motor', code: 'MTR' },
                        { id: 'pump', label: 'Pump', code: 'PMP' },
                        { id: 'fan', label: 'Fan', code: 'FAN' },
                        { id: 'rotary-airlock-valve', label: 'Rotary Airlock Valve', code: 'RAV' },
                      ] satisfies EquipmentTypeNode[],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

type Company = typeof ASSET_HIERARCHY.companies[number];
type Plant = Company['plants'][number];
type Area = Plant['areas'][number];
type Machine = Area['machines'][number];
type Equipment = Machine['equipments'][number];

interface AssetHierarchyStore {
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
}

export const useAssetHierarchyStore = create<AssetHierarchyStore>((set) => ({
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
}));

export function getSelectedCompany(companyId: string | null): Company | undefined {
  return ASSET_HIERARCHY.companies.find((company) => company.id === companyId);
}

export function getSelectedPlant(company: Company | undefined, plantId: string | null): Plant | undefined {
  return company?.plants.find((plant) => plant.id === plantId);
}

export function getSelectedArea(plant: Plant | undefined, areaId: string | null): Area | undefined {
  return plant?.areas.find((area) => area.id === areaId);
}

export function getSelectedMachine(area: Area | undefined, machineId: string | null): Machine | undefined {
  return area?.machines.find((machine) => machine.id === machineId);
}

export function getSelectedEquipment(machine: Machine | undefined, equipmentId: string | null): Equipment | undefined {
  return machine?.equipments.find((equipment) => equipment.id === equipmentId);
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
