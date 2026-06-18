import React, { useCallback, useEffect, useState } from 'react';
import {
  getCompanies,
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
import { useConnectionStore } from '../store/connectionStore';

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

const CHILD_LEVELS: Record<AssetLevel, AssetLevel | null> = {
  company: 'plant',
  plant: 'area',
  area: 'machine',
  machine: 'equipment',
  equipment: 'equipmentType',
  equipmentType: null,
};

// ---------------------------------------------------------------------------
// Modal Component
// ---------------------------------------------------------------------------

function AssetModal({ open, title, initialLabel, initialCode, onSave, onClose }: {
  open: boolean;
  title: string;
  initialLabel?: string;
  initialCode?: string;
  onSave: (label: string, code: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initialLabel ?? '');
  const [code, setCode] = useState(initialCode ?? '');

  useEffect(() => {
    setLabel(initialLabel ?? '');
    setCode(initialCode ?? '');
  }, [initialLabel, initialCode, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-lg p-6 w-full max-w-md shadow-xl" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text)' }}>{title}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-2)' }}>Name</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm outline-none"
              style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', color: 'var(--text)' }}
              autoFocus
              placeholder="Enter name..."
            />
          </div>
          <div>
            <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--text-2)' }}>Code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm outline-none font-mono uppercase"
              style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', color: 'var(--text)' }}
              placeholder="e.g. OSWAR, P1, AREA-A..."
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded text-xs font-medium transition-colors"
            style={{ background: 'var(--panel-alt)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={() => { if (label.trim()) onSave(label.trim(), code.trim()); }}
            disabled={!label.trim()}
            className="px-4 py-2 rounded text-xs font-medium transition-colors"
            style={{ background: 'var(--accent)', color: '#fff', opacity: label.trim() ? 1 : 0.5 }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm Delete Modal
// ---------------------------------------------------------------------------

function ConfirmModal({ open, message, onConfirm, onClose }: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-lg p-6 w-full max-w-sm shadow-xl" style={{ background: 'var(--panel)', border: '1px solid var(--border)' }}>
        <p className="text-sm mb-4" style={{ color: 'var(--text)' }}>{message}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded text-xs font-medium"
            style={{ background: 'var(--panel-alt)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded text-xs font-medium"
            style={{ background: '#ef4444', color: '#fff' }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Option Card with Edit/Delete buttons
// ---------------------------------------------------------------------------

function OptionCard({ node, selected, onClick, onEdit, onDelete }: {
  node: AssetNode;
  selected?: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="group relative rounded transition-colors min-h-[86px]"
      style={{
        background: selected ? 'var(--accent-dim)' : 'var(--panel)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
      }}
    >
      <button
        onClick={onClick}
        className="text-left w-full h-full p-4"
        style={{ color: selected ? 'var(--accent)' : 'var(--text)' }}
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
      {/* Action buttons — visible on hover */}
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded transition-colors" title="Edit"
          style={{ background: 'var(--panel-alt)', color: 'var(--accent)' }}>
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded transition-colors" title="Delete"
          style={{ background: 'var(--panel-alt)', color: '#ef4444' }}>
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export const AssetSelectionPage: React.FC = () => {
  const apiBase = useConnectionStore((s) => s.config?.apiBase ?? 'http://localhost:8000');
  const tree = useAssetHierarchyStore((s) => s.tree);
  const fetchTree = useAssetHierarchyStore((s) => s.fetchTree);
  const addNode = useAssetHierarchyStore((s) => s.addNode);
  const updateNode = useAssetHierarchyStore((s) => s.updateNode);
  const deleteNode = useAssetHierarchyStore((s) => s.deleteNode);

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

  // Fetch tree from API on mount
  useEffect(() => { fetchTree(apiBase); }, [apiBase, fetchTree]);

  const companies = getCompanies();
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

  const nodes: AssetNode[] =
    level === 'company' ? companies :
    level === 'plant' ? company?.plants ?? [] :
    level === 'area' ? plant?.areas ?? [] :
    level === 'machine' ? area?.machines ?? [] :
    level === 'equipment' ? machine?.equipments ?? [] :
    equipment?.equipmentTypes ?? [];

  // Parent ID for new node creation at current level
  const parentIdForAdd: string | null =
    level === 'company' ? null :
    level === 'plant' ? selectedCompanyId :
    level === 'area' ? selectedPlantId :
    level === 'machine' ? selectedAreaId :
    level === 'equipment' ? selectedMachineId :
    selectedEquipmentId;

  const selectNode = (id: string) => {
    if (level === 'company') selectCompany(id);
    else if (level === 'plant') selectPlant(id);
    else if (level === 'area') selectArea(id);
    else if (level === 'machine') selectMachine(id);
    else if (level === 'equipment') selectEquipment(id);
    else selectEquipmentType(id as EquipmentTypeId);
  };

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<AssetNode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AssetNode | null>(null);
  const [busy, setBusy] = useState(false);

  const handleAdd = useCallback(async (label: string, code: string) => {
    setBusy(true);
    try {
      await addNode(apiBase, parentIdForAdd, level, label, code);
      setShowAddModal(false);
    } catch (err) { console.error('Add failed:', err); }
    setBusy(false);
  }, [apiBase, addNode, parentIdForAdd, level]);

  const handleEdit = useCallback(async (label: string, code: string) => {
    if (!editTarget) return;
    setBusy(true);
    try {
      await updateNode(apiBase, editTarget.id, label, code);
      setEditTarget(null);
    } catch (err) { console.error('Update failed:', err); }
    setBusy(false);
  }, [apiBase, updateNode, editTarget]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteNode(apiBase, deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) { console.error('Delete failed:', err); }
    setBusy(false);
  }, [apiBase, deleteNode, deleteTarget]);

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
            <div className="flex items-center gap-3">
              <span className="text-2xs font-mono" style={{ color: 'var(--text-3)' }}>
                {nodes.length} option{nodes.length === 1 ? '' : 's'}
              </span>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                style={{ background: 'var(--accent)', color: '#fff' }}
                title={`Add new ${level}`}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add {level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            </div>
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
                  onEdit={() => setEditTarget(node)}
                  onDelete={() => setDeleteTarget(node)}
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

      {/* Add Modal */}
      <AssetModal
        open={showAddModal}
        title={`Add New ${level.charAt(0).toUpperCase() + level.slice(1)}`}
        onSave={handleAdd}
        onClose={() => setShowAddModal(false)}
      />

      {/* Edit Modal */}
      <AssetModal
        open={!!editTarget}
        title={`Edit ${editTarget?.label ?? ''}`}
        initialLabel={editTarget?.label}
        initialCode={editTarget?.code}
        onSave={handleEdit}
        onClose={() => setEditTarget(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        message={`Delete "${deleteTarget?.label}" and all its children? This cannot be undone.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
