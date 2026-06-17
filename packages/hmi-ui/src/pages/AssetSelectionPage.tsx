import React from 'react';
import {
  ASSET_HIERARCHY,
  getSelectedArea,
  getSelectedCompany,
  getSelectedEquipment,
  getSelectedMachine,
  getSelectedPlant,
  useAssetHierarchyStore,
  type AssetLevel,
  type AssetNode,
  type EquipmentTypeId,
} from '../store/assetHierarchyStore';

const LEVEL_TITLES: Record<AssetLevel, string> = {
  company: 'Select Company',
  plant: 'Select Plant',
  area: 'Select Site / Area',
  machine: 'Select Machine',
  equipment: 'Select Equipment',
  equipmentType: 'Select Equipment Type',
};

const LEVEL_HELP: Record<AssetLevel, string> = {
  company: 'Choose a company to view its plants.',
  plant: 'Choose a plant to view its site and area structure.',
  area: 'Choose a site or area to view machines.',
  machine: 'Choose a machine to view its equipments.',
  equipment: 'Choose an equipment group to view available equipment types.',
  equipmentType: 'Motor, Pump, Fan, and Rotary Airlock Valve are at the same hierarchy level.',
};

function OptionCard({ node, selected, onClick }: {
  node: AssetNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded transition-colors min-h-[86px] p-4"
      style={{
        background: selected ? 'var(--accent-dim)' : 'var(--panel)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        color: selected ? 'var(--accent)' : 'var(--text)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{node.label}</div>
          {node.code && (
            <div className="mt-1 text-2xs font-mono tracking-widest uppercase" style={{ color: 'var(--text-3)' }}>
              {node.code}
            </div>
          )}
        </div>
        <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </button>
  );
}

export const AssetSelectionPage: React.FC = () => {
  const selectedCompanyId = useAssetHierarchyStore((s) => s.selectedCompanyId);
  const selectedPlantId = useAssetHierarchyStore((s) => s.selectedPlantId);
  const selectedAreaId = useAssetHierarchyStore((s) => s.selectedAreaId);
  const selectedMachineId = useAssetHierarchyStore((s) => s.selectedMachineId);
  const selectedEquipmentId = useAssetHierarchyStore((s) => s.selectedEquipmentId);
  const selectedEquipmentTypeId = useAssetHierarchyStore((s) => s.selectedEquipmentTypeId);
  const selectCompany = useAssetHierarchyStore((s) => s.selectCompany);
  const selectPlant = useAssetHierarchyStore((s) => s.selectPlant);
  const selectArea = useAssetHierarchyStore((s) => s.selectArea);
  const selectMachine = useAssetHierarchyStore((s) => s.selectMachine);
  const selectEquipment = useAssetHierarchyStore((s) => s.selectEquipment);
  const selectEquipmentType = useAssetHierarchyStore((s) => s.selectEquipmentType);

  const company = getSelectedCompany(selectedCompanyId);
  const plant = getSelectedPlant(company, selectedPlantId);
  const area = getSelectedArea(plant, selectedAreaId);
  const machine = getSelectedMachine(area, selectedMachineId);
  const equipment = getSelectedEquipment(machine, selectedEquipmentId);
  const equipmentType = equipment?.equipmentTypes.find((type) => type.id === selectedEquipmentTypeId);

  const selectedPath = [company, plant, area, machine, equipment, equipmentType]
    .filter(Boolean)
    .map((node) => node!.label)
    .join(' / ');

  const level: AssetLevel =
    !company ? 'company' :
    !plant ? 'plant' :
    !area ? 'area' :
    !machine ? 'machine' :
    !equipment ? 'equipment' :
    'equipmentType';

  const nodes =
    level === 'company' ? ASSET_HIERARCHY.companies :
    level === 'plant' ? company?.plants ?? [] :
    level === 'area' ? plant?.areas ?? [] :
    level === 'machine' ? area?.machines ?? [] :
    level === 'equipment' ? machine?.equipments ?? [] :
    equipment?.equipmentTypes ?? [];

  const selectNode = (id: string) => {
    if (level === 'company') selectCompany(id);
    else if (level === 'plant') selectPlant(id);
    else if (level === 'area') selectArea(id);
    else if (level === 'machine') selectMachine(id);
    else if (level === 'equipment') selectEquipment(id);
    else selectEquipmentType(id as EquipmentTypeId);
  };

  const title = equipmentType
    ? `${equipmentType.label} HMI is not configured yet`
    : 'Select Rotary Airlock Valve';

  const description = equipmentType
    ? 'Motor, Pump, and Fan are available in the hierarchy for future HMI screens. Select Rotary Airlock Valve to open the current live dashboard, trends, alarms, and digital twin.'
    : 'Start from Company in the left hierarchy, drill down to Equipments, then select Rotary Airlock Valve to view the current live HMI.';

  return (
    <div className="h-full overflow-auto p-6">
      <div className="w-full max-w-6xl mx-auto space-y-4">
        <div className="scada-panel overflow-hidden">
          <div className="scada-panel-header">
            <div>
              <span className="scada-panel-title">{LEVEL_TITLES[level]}</span>
              <p className="text-2xs mt-1 normal-case tracking-normal font-normal" style={{ color: 'var(--text-3)' }}>
                {LEVEL_HELP[level]}
              </p>
            </div>
            <span className="text-2xs font-mono" style={{ color: 'var(--text-3)' }}>
              {nodes.length} option{nodes.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="p-4">
            {selectedPath && (
              <div className="mb-4 rounded px-3 py-2 text-xs font-mono selectable"
                style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                {selectedPath}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {nodes.map((node) => (
                <OptionCard
                  key={node.id}
                  node={node}
                  selected={level === 'equipmentType' && node.id === selectedEquipmentTypeId}
                  onClick={() => selectNode(node.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="scada-panel w-full overflow-hidden">
        <div className="scada-panel-header">
          <span className="scada-panel-title">{title}</span>
        </div>
        <div className="p-5">
          {selectedPath && (
            <div className="mb-4 rounded px-3 py-2 text-xs font-mono selectable"
              style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
              {selectedPath}
            </div>
          )}
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {description}
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};
