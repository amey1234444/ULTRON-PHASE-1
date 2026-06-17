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
} from '../../store/assetHierarchyStore';
import { cn } from '../../utils/cn';

const LABELS: Record<AssetLevel, string> = {
  company: 'Companies',
  plant: 'Plants',
  area: 'Site / Area',
  machine: 'Machines',
  equipment: 'Equipments',
  equipmentType: 'Equipment Type',
};

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function NodeButton({ node, selected, onClick }: {
  node: AssetNode;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between gap-2 rounded px-2 py-2 text-left transition-colors',
        selected && 'asset-node-active',
      )}
      style={{
        background: selected ? 'var(--accent-dim)' : 'var(--panel)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        color: selected ? 'var(--accent)' : 'var(--text-2)',
      }}
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold truncate">{node.label}</span>
        {node.code && <span className="block text-3xs font-mono mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>{node.code}</span>}
      </span>
      <ChevronRight />
    </button>
  );
}

function Breadcrumb({ label, value, onClick }: {
  label: string;
  value?: string;
  onClick: () => void;
}) {
  if (!value) return null;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-1.5 text-left text-3xs font-mono uppercase tracking-wider truncate"
      style={{ color: 'var(--text-3)' }}
      title={`${label}: ${value}`}
    >
      <ChevronLeft />
      <span className="truncate">{label}: {value}</span>
    </button>
  );
}

export const AssetExplorer: React.FC<{ collapsed: boolean }> = ({ collapsed }) => {
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
  const backTo = useAssetHierarchyStore((s) => s.backTo);

  if (collapsed) {
    return (
      <div className="px-1.5 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          title="Asset hierarchy"
          className="w-full h-9 rounded flex items-center justify-center"
          style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--accent)' }}
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path d="M3 6h18M6 6v12m6-12v12m6-12v12M4 18h16" />
          </svg>
        </button>
      </div>
    );
  }

  const company = getSelectedCompany(selectedCompanyId);
  const plant = getSelectedPlant(company, selectedPlantId);
  const area = getSelectedArea(plant, selectedAreaId);
  const machine = getSelectedMachine(area, selectedMachineId);
  const equipment = getSelectedEquipment(machine, selectedEquipmentId);

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

  return (
    <div className="border-b px-2 py-2" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-2xs font-bold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
          Asset Hierarchy
        </span>
        {company && (
          <button
            onClick={() => backTo('company')}
            className="text-3xs uppercase tracking-wider"
            style={{ color: 'var(--text-3)' }}
          >
            Reset
          </button>
        )}
      </div>

      <div className="space-y-1 mb-2">
        <Breadcrumb label="Company" value={company?.label} onClick={() => backTo('plant')} />
        <Breadcrumb label="Plant" value={plant?.label} onClick={() => backTo('area')} />
        <Breadcrumb label="Area" value={area?.label} onClick={() => backTo('machine')} />
        <Breadcrumb label="Machine" value={machine?.label} onClick={() => backTo('equipment')} />
        <Breadcrumb label="Equipment" value={equipment?.label} onClick={() => backTo('equipmentType')} />
      </div>

      <div className="rounded p-1.5" style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)' }}>
        <div className="text-3xs font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-3)' }}>
          {LABELS[level]} ({nodes.length})
        </div>
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {nodes.map((node) => (
            <NodeButton
              key={node.id}
              node={node}
              selected={level === 'equipmentType' && node.id === selectedEquipmentTypeId}
              onClick={() => selectNode(node.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
