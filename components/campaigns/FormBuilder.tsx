"use client";

import React, { useState, useEffect } from "react";
import { getForm, getFormFields, upsertFormFields, updateForm } from "@/lib/campaigns-api";
import {
  FieldType, FIELD_TYPE_CATEGORIES, FIELD_TYPE_LABELS, CONTAINER_FIELD_TYPES,
} from "@/types";
import type {
  Form, FieldSettings, FieldValidationRules, ConditionalLogic, ConditionalRule, ConditionGroup,
  ConditionOperator, DataSourceConfig, ReferenceListKey, FormSettings as FormSettingsType,
} from "@/types";
import {
  ArrowLeft, GripVertical, Trash2, Save, ChevronDown, ChevronUp,
  Check, Type, Mail, Phone, Hash, AlignLeft, List, CircleDot, CheckSquare,
  Calendar, CreditCard, DollarSign, Percent, Lock, ListChecks, ToggleLeft,
  Clock, CalendarClock, Paperclip, Image as ImageIcon, Camera as CameraIcon,
  PenTool, ChevronRight, LayoutPanelTop, Rows, Columns as ColumnsIcon,
  SquareStack, Minus, Code, Info, CornerDownRight, X, Plus,
} from "lucide-react";

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "equals",
  not_equals: "does not equal",
  contains: "contains",
  greater_than: "is greater than",
  less_than: "is less than",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

const REFERENCE_LIST_LABELS: Record<ReferenceListKey, string> = {
  business_units: "Business units",
  insurers: "Insurers",
  product_catalog: "Product catalog",
  sales_agents: "Sales agents",
  concierge_agents: "Concierge agents",
  credit_health_agents: "Credit Health agents",
  sa_provinces: "SA provinces",
  titles: "Titles",
  marital_status: "Marital status",
  yes_no: "Yes / No",
};

const CALCULABLE_TYPES = [FieldType.Number, FieldType.Currency, FieldType.Percentage];

const FIELD_ICONS: Record<FieldType, React.ReactNode> = {
  [FieldType.Text]: <Type className="w-4 h-4" />,
  [FieldType.Textarea]: <AlignLeft className="w-4 h-4" />,
  [FieldType.Email]: <Mail className="w-4 h-4" />,
  [FieldType.Phone]: <Phone className="w-4 h-4" />,
  [FieldType.Number]: <Hash className="w-4 h-4" />,
  [FieldType.Currency]: <DollarSign className="w-4 h-4" />,
  [FieldType.Percentage]: <Percent className="w-4 h-4" />,
  [FieldType.Password]: <Lock className="w-4 h-4" />,
  [FieldType.Select]: <List className="w-4 h-4" />,
  [FieldType.MultiSelect]: <ListChecks className="w-4 h-4" />,
  [FieldType.Checkbox]: <CheckSquare className="w-4 h-4" />,
  [FieldType.Radio]: <CircleDot className="w-4 h-4" />,
  [FieldType.Toggle]: <ToggleLeft className="w-4 h-4" />,
  [FieldType.Date]: <Calendar className="w-4 h-4" />,
  [FieldType.Time]: <Clock className="w-4 h-4" />,
  [FieldType.DateTime]: <CalendarClock className="w-4 h-4" />,
  [FieldType.File]: <Paperclip className="w-4 h-4" />,
  [FieldType.Image]: <ImageIcon className="w-4 h-4" />,
  [FieldType.Camera]: <CameraIcon className="w-4 h-4" />,
  [FieldType.Signature]: <PenTool className="w-4 h-4" />,
  [FieldType.IdNumber]: <CreditCard className="w-4 h-4" />,
  [FieldType.Section]: <LayoutPanelTop className="w-4 h-4" />,
  [FieldType.Accordion]: <Rows className="w-4 h-4" />,
  [FieldType.Columns]: <ColumnsIcon className="w-4 h-4" />,
  [FieldType.Tabs]: <SquareStack className="w-4 h-4" />,
  [FieldType.Card]: <LayoutPanelTop className="w-4 h-4" />,
  [FieldType.Divider]: <Minus className="w-4 h-4" />,
  [FieldType.HtmlBlock]: <Code className="w-4 h-4" />,
  [FieldType.InfoPanel]: <Info className="w-4 h-4" />,
};

const CHOICE_TYPES = [FieldType.Select, FieldType.Radio, FieldType.MultiSelect];

interface LocalField {
  _localId: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  placeholder: string;
  description: string;
  is_required: boolean;
  options: string[];
  validation: FieldValidationRules;
  settings: FieldSettings;
  conditionalLogic: ConditionalLogic | null;
  calculatedFormula: string;
  dataSource: DataSourceConfig | null;
  display_order: number;
  parent_field_key: string | null;
  column_index: number | null;
  step_index: number;
}

interface FormBuilderProps {
  formId: string;
  onBack: () => void;
}

function flattenAndRenumber(allFields: LocalField[]): LocalField[] {
  const top = allFields.filter((f) => !f.parent_field_key).sort((a, b) => a.display_order - b.display_order);
  const result: LocalField[] = [];
  let order = 0;
  for (const t of top) {
    result.push({ ...t, display_order: order++ });
    const children = allFields
      .filter((f) => f.parent_field_key === t.field_key)
      .sort((a, b) => a.display_order - b.display_order);
    for (const c of children) result.push({ ...c, display_order: order++ });
  }
  return result;
}

export default function FormBuilder({ formId, onBack }: FormBuilderProps) {
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<LocalField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState<"editor" | "preview" | "settings">("editor");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [propertyTab, setPropertyTab] = useState<"general" | "validation" | "appearance" | "logic">("general");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
    () => Object.fromEntries(FIELD_TYPE_CATEGORIES.map((c) => [c.label, true]))
  );
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [targetParentKey, setTargetParentKey] = useState<string | null>(null);

  useEffect(() => {
    loadForm();
  }, [formId]);

  const loadForm = async () => {
    setIsLoading(true);
    try {
      const [formData, fieldData] = await Promise.all([
        getForm(formId),
        getFormFields(formId),
      ]);
      setForm(formData);
      setFields(
        fieldData.map((f) => ({
          _localId: f.id,
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          placeholder: f.placeholder || "",
          description: f.description || "",
          is_required: f.is_required,
          options: f.options ? (f.options as { items?: string[] }).items || [] : [],
          validation: f.validation_rules || {},
          settings: f.settings || {},
          conditionalLogic: f.conditional_logic ?? null,
          calculatedFormula: f.calculated_formula ?? "",
          dataSource: f.data_source ?? null,
          display_order: f.display_order,
          parent_field_key: f.parent_field_key ?? null,
          column_index: f.column_index ?? null,
          step_index: f.step_index ?? 0,
        }))
      );
    } catch (err) {
      console.error("Failed to load form:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addField = (type: FieldType) => {
    const key = `${type}_${Date.now()}`;
    const parent = targetParentKey ? fields.find((f) => f.field_key === targetParentKey) : null;
    const newField: LocalField = {
      _localId: key,
      field_key: key,
      label: FIELD_TYPE_LABELS[type],
      field_type: type,
      placeholder: "",
      description: "",
      is_required: false,
      options: CHOICE_TYPES.includes(type) ? ["Option 1", "Option 2"] : [],
      validation: {},
      settings: {},
      conditionalLogic: null,
      calculatedFormula: "",
      dataSource: null,
      display_order: fields.length,
      parent_field_key: parent && !CONTAINER_FIELD_TYPES.includes(type) ? parent.field_key : null,
      column_index: parent?.field_type === FieldType.Columns ? 0 : null,
      step_index: 0,
    };
    setFields(flattenAndRenumber([...fields, newField]));
    setSelectedFieldId(key);
    setPropertyTab("general");
  };

  const removeField = (localId: string) => {
    const removed = fields.find((f) => f._localId === localId);
    if (!removed) return;
    // Removing a container also removes its children — otherwise they'd be
    // orphaned (parent_field_key pointing at nothing).
    setFields(flattenAndRenumber(fields.filter((f) => f._localId !== localId && f.parent_field_key !== removed.field_key)));
    if (selectedFieldId === localId) setSelectedFieldId(null);
    if (targetParentKey === removed.field_key) setTargetParentKey(null);
  };

  const updateField = (localId: string, updates: Partial<LocalField>) => {
    setFields(fields.map((f) => (f._localId === localId ? { ...f, ...updates } : f)));
  };

  const moveField = (fieldKey: string, direction: "up" | "down") => {
    const field = fields.find((f) => f.field_key === fieldKey);
    if (!field) return;
    const siblings = fields
      .filter((f) => f.parent_field_key === field.parent_field_key)
      .sort((a, b) => a.display_order - b.display_order);
    const idx = siblings.findIndex((f) => f.field_key === fieldKey);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx];
    const b = siblings[swapIdx];
    const updated = fields.map((f) => {
      if (f.field_key === a.field_key) return { ...f, display_order: b.display_order };
      if (f.field_key === b.field_key) return { ...f, display_order: a.display_order };
      return f;
    });
    setFields(flattenAndRenumber(updated));
  };

  function handleDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) { setDragKey(null); return; }
    const dragged = fields.find((f) => f.field_key === dragKey);
    const target = fields.find((f) => f.field_key === targetKey);
    if (!dragged || !target) { setDragKey(null); return; }

    const draggedIsContainer = CONTAINER_FIELD_TYPES.includes(dragged.field_type);
    const targetIsContainer = CONTAINER_FIELD_TYPES.includes(target.field_type);

    // Containers only ever live at the top level — dropping one reorders
    // among other top-level items regardless of what it's dropped on.
    // Dropping a leaf field directly onto a container nests it inside as
    // that container's last child; dropping it on any other field makes
    // it a sibling of that field (which may move it into, or out of, a
    // container — including a different one than it started in).
    const newParentKey = draggedIsContainer ? null : (targetIsContainer ? target.field_key : target.parent_field_key);
    const newParent = newParentKey ? fields.find((f) => f.field_key === newParentKey) : null;

    const siblings = fields
      .filter((f) => f.field_key !== dragKey && f.parent_field_key === newParentKey)
      .sort((a, b) => a.display_order - b.display_order);

    const insertAt = targetIsContainer && !draggedIsContainer
      ? siblings.length
      : Math.max(0, siblings.findIndex((f) => f.field_key === targetKey));

    const movedField: LocalField = {
      ...dragged,
      parent_field_key: newParentKey,
      column_index: newParent?.field_type === FieldType.Columns ? (dragged.column_index ?? 0) : null,
    };

    siblings.splice(insertAt, 0, movedField);
    const reordered = siblings.map((f, i) => ({ ...f, display_order: i }));
    const others = fields.filter((f) => f.field_key !== dragKey && f.parent_field_key !== newParentKey);
    setFields(flattenAndRenumber([...others, ...reordered]));
    setDragKey(null);
  }

  const handleSave = async () => {
    if (!formId) return;
    setIsSaving(true);
    setSaved(false);

    try {
      const payload = fields.map((f) => ({
        form_id: formId,
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type,
        placeholder: f.placeholder || undefined,
        description: f.description || undefined,
        is_required: f.is_required,
        options: f.options.length > 0 ? { items: f.options } : undefined,
        validation_rules: Object.keys(f.validation).length > 0 ? f.validation : undefined,
        settings: f.settings,
        conditional_logic: f.conditionalLogic ?? undefined,
        calculated_formula: f.calculatedFormula || undefined,
        data_source: f.dataSource ?? undefined,
        display_order: f.display_order,
        parent_field_key: f.parent_field_key,
        column_index: f.column_index,
        step_index: f.step_index,
      }));

      await upsertFormFields(formId, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save fields:", err);
    } finally {
      setIsSaving(false);
    }
  };

  async function toggleMultiStep() {
    if (!form) return;
    const next = !form.is_multi_step;
    setForm({ ...form, is_multi_step: next });
    try {
      await updateForm(form.id, { is_multi_step: next });
    } catch (err) {
      console.error("Failed to update multi-step setting:", err);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="card animate-pulse h-64" />
      </div>
    );
  }

  const selectedField = fields.find((f) => f._localId === selectedFieldId) ?? null;
  const topLevelFields = fields.filter((f) => !f.parent_field_key).sort((a, b) => a.display_order - b.display_order);
  const containerFields = fields.filter((f) => CONTAINER_FIELD_TYPES.includes(f.field_type));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="btn btn-ghost px-2">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{form?.name || "Form builder"}</h1>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">/f/{form?.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
            <input type="checkbox" checked={!!form?.is_multi_step} onChange={toggleMultiStep} className="rounded border-gray-300" />
            Multi-step wizard
          </label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(["editor", "preview", "settings"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className="px-3 py-1.5 text-xs font-medium capitalize"
                style={{ background: viewMode === mode ? "#1A348C" : "#fff", color: viewMode === mode ? "#fff" : "#6B7280" }}
              >
                {mode}
              </button>
            ))}
          </div>
          <button onClick={handleSave} disabled={isSaving} className="btn btn-primary">
            {saved ? <><Check className="w-4 h-4" />Saved</> : isSaving ? "Saving..." : <><Save className="w-4 h-4" />Save fields</>}
          </button>
        </div>
      </div>

      {viewMode === "settings" ? (
        <FormSettingsPanel form={form} onFormChange={setForm} />
      ) : viewMode === "preview" ? (
        <FormPreview form={form} fields={fields} />
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: "260px 1fr 320px" }}>
          {/* Left panel — field toolbox */}
          <div>
            <div className="card sticky top-28 space-y-1">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Field toolbox</h3>
              {targetParentKey && (
                <div className="flex items-center justify-between px-2 py-1.5 rounded-lg mb-2 text-[11px]" style={{ background: "#EEF4FD", color: "#1A348C" }}>
                  <span>Adding into: {fields.find((f) => f.field_key === targetParentKey)?.label}</span>
                  <button onClick={() => setTargetParentKey(null)}><X className="w-3 h-3" /></button>
                </div>
              )}
              {FIELD_TYPE_CATEGORIES.map((cat) => (
                <div key={cat.label} className="border-b border-gray-100 last:border-0 pb-2 mb-2 last:pb-0 last:mb-0">
                  <button
                    className="w-full flex items-center justify-between py-1 text-left"
                    onClick={() => setOpenCategories((prev) => ({ ...prev, [cat.label]: !prev[cat.label] }))}
                  >
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{cat.label}</span>
                    {openCategories[cat.label] ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                  </button>
                  {openCategories[cat.label] && (
                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                      {cat.types.map((type) => (
                        <button
                          key={type}
                          onClick={() => addField(type)}
                          className="flex items-center gap-1.5 px-2 py-2 rounded-lg border border-gray-200 text-left hover:bg-gray-50 hover:border-gray-300 transition-all"
                        >
                          <span className="text-gray-400">{FIELD_ICONS[type]}</span>
                          <span className="text-[11px] font-medium text-gray-700 leading-tight">{FIELD_TYPE_LABELS[type]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Middle panel — canvas */}
          <div className="space-y-2">
            {fields.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <Type className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No fields yet</p>
                <p className="text-xs text-gray-400 mt-1">Click a field type on the left to add it</p>
              </div>
            ) : (
              topLevelFields.map((field) => {
                const children = fields.filter((f) => f.parent_field_key === field.field_key).sort((a, b) => a.display_order - b.display_order);
                return (
                  <div key={field._localId} className="space-y-1.5">
                    <CanvasRow
                      field={field}
                      isSelected={selectedFieldId === field._localId}
                      isMultiStep={!!form?.is_multi_step}
                      onSelect={() => { setSelectedFieldId(selectedFieldId === field._localId ? null : field._localId); setPropertyTab("general"); }}
                      onRemove={() => removeField(field._localId)}
                      onMoveUp={() => moveField(field.field_key, "up")}
                      onMoveDown={() => moveField(field.field_key, "down")}
                      onDragStart={() => setDragKey(field.field_key)}
                      onDrop={() => handleDrop(field.field_key)}
                      onAddInside={CONTAINER_FIELD_TYPES.includes(field.field_type) ? () => setTargetParentKey(field.field_key) : undefined}
                    />
                    {children.map((child) => (
                      <div key={child._localId} className="pl-6 flex items-start gap-1.5">
                        <CornerDownRight className="w-3.5 h-3.5 text-gray-300 mt-3 flex-shrink-0" />
                        <div className="flex-1">
                          <CanvasRow
                            field={child}
                            isSelected={selectedFieldId === child._localId}
                            isMultiStep={false}
                            badge={
                              field.field_type === FieldType.Columns
                                ? `Column ${(child.column_index ?? 0) + 1}`
                                : field.field_type === FieldType.Tabs
                                  ? `Tab ${(child.settings.tabIndex ?? 0) + 1}`
                                  : undefined
                            }
                            onSelect={() => { setSelectedFieldId(selectedFieldId === child._localId ? null : child._localId); setPropertyTab("general"); }}
                            onRemove={() => removeField(child._localId)}
                            onMoveUp={() => moveField(child.field_key, "up")}
                            onMoveDown={() => moveField(child.field_key, "down")}
                            onDragStart={() => setDragKey(child.field_key)}
                            onDrop={() => handleDrop(child.field_key)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* Right panel — field properties */}
          <div>
            <div className="card sticky top-28">
              {!selectedField ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400">Select a field to edit its properties.</p>
                </div>
              ) : (
                <FieldPropertiesPanel
                  field={selectedField}
                  tab={propertyTab}
                  onTabChange={setPropertyTab}
                  onChange={(updates) => updateField(selectedField._localId, updates)}
                  isMultiStep={!!form?.is_multi_step}
                  containerFields={containerFields.filter((f) => f.field_key !== selectedField.field_key)}
                  allFields={fields}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Form Settings — theme, branding, submit/cancel behaviour,
// redirect, custom CSS/JS, language & timezone
// ============================================================

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "af", label: "Afrikaans" },
  { code: "zu", label: "isiZulu" },
  { code: "xh", label: "isiXhosa" },
];

const TIMEZONES = ["Africa/Johannesburg", "UTC", "Europe/London", "America/New_York"];

function FormSettingsPanel({ form, onFormChange }: { form: Form | null; onFormChange: (form: Form) => void }) {
  const [draft, setDraft] = useState<FormSettingsType>(form?.settings ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(form?.settings ?? {}); }, [form?.id]);

  function set(patch: Partial<FormSettingsType>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const updated = await updateForm(form.id, { settings: draft });
      onFormChange(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save form settings:", err);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return null;

  return (
    <div className="grid grid-cols-2 gap-5 max-w-4xl">
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Branding</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Theme</label>
          <select className="input-field" value={draft.theme ?? "light"} onChange={(e) => set({ theme: e.target.value as "light" | "dark" })}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Primary colour</label>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.primaryColor ?? "#1A348C"} onChange={(e) => set({ primaryColor: e.target.value })} style={{ width: 40, height: 36, padding: 2, border: "1px solid #E5E7EB", borderRadius: 8 }} />
            <input className="input-field" value={draft.primaryColor ?? "#1A348C"} onChange={(e) => set({ primaryColor: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL</label>
          <input className="input-field" value={draft.logoUrl ?? ""} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="https://…" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Header image URL</label>
          <input className="input-field" value={draft.headerImageUrl ?? ""} onChange={(e) => set({ headerImageUrl: e.target.value })} placeholder="https://…" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Footer text</label>
          <input className="input-field" value={draft.footerText ?? ""} onChange={(e) => set({ footerText: e.target.value })} placeholder="Powered by Mmela" />
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Buttons &amp; behaviour</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Submit button text</label>
          <input className="input-field" value={draft.submitButtonText ?? ""} onChange={(e) => set({ submitButtonText: e.target.value })} placeholder="Submit" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!draft.showCancelButton} onChange={(e) => set({ showCancelButton: e.target.checked })} className="rounded border-gray-300" />
          <span className="text-sm text-gray-700">Show a cancel button</span>
        </label>
        {draft.showCancelButton && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cancel button text</label>
              <input className="input-field" value={draft.cancelButtonText ?? ""} onChange={(e) => set({ cancelButtonText: e.target.value })} placeholder="Cancel" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cancel goes to</label>
              <input className="input-field" value={draft.cancelUrl ?? ""} onChange={(e) => set({ cancelUrl: e.target.value })} placeholder="https://mmela.co.za" />
            </div>
          </>
        )}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Redirect URL after submit</label>
          <input className="input-field" value={draft.redirectUrl ?? ""} onChange={(e) => set({ redirectUrl: e.target.value })} placeholder="Leave blank to show the thank-you message" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Language</label>
            <select className="input-field" value={draft.language ?? "en"} onChange={(e) => set({ language: e.target.value })}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
            <select className="input-field" value={draft.timezone ?? "Africa/Johannesburg"} onChange={(e) => set({ timezone: e.target.value })}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card space-y-4 col-span-2">
        <h3 className="text-sm font-semibold text-gray-900">Advanced</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Custom CSS</label>
          <textarea className="input-field font-mono" rows={4} value={draft.customCss ?? ""} onChange={(e) => set({ customCss: e.target.value })} placeholder=".mmela-form { }" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Custom JavaScript</label>
          <textarea className="input-field font-mono" rows={4} value={draft.customJs ?? ""} onChange={(e) => set({ customJs: e.target.value })} placeholder="// runs on the public form page" />
          <p className="text-[11px] text-amber-600 mt-1">
            Only add code you trust — it runs directly on your public form for every visitor.
          </p>
        </div>
      </div>

      <div className="col-span-2 flex justify-end">
        <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
          {saved ? <><Check className="w-4 h-4" />Saved</> : saving ? "Saving…" : <><Save className="w-4 h-4" />Save settings</>}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// A single row in the canvas (top-level or child)
// ============================================================

function CanvasRow({
  field, isSelected, isMultiStep, badge, onSelect, onRemove, onMoveUp, onMoveDown, onDragStart, onDrop, onAddInside,
}: {
  field: LocalField;
  isSelected: boolean;
  isMultiStep: boolean;
  badge?: string;
  onSelect: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onAddInside?: () => void;
}) {
  return (
    <div
      className="card"
      style={{ border: isSelected ? "1px solid #235DCB" : undefined, background: isSelected ? "#F5F8FE" : undefined }}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-3">
        <span className="text-gray-300 cursor-grab" title="Drag to reorder">
          <GripVertical className="w-4 h-4" />
        </span>
        <div className="flex flex-col gap-0.5">
          <button onClick={onMoveUp} className="text-gray-300 hover:text-gray-500">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button onClick={onMoveDown} className="text-gray-300 hover:text-gray-500">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-8 h-8 rounded-md bg-gray-50 flex items-center justify-center text-gray-400">
          {FIELD_ICONS[field.field_type]}
        </div>

        <div className="flex-1 cursor-pointer" onClick={onSelect}>
          <p className="text-sm font-medium text-gray-900">
            {field.label}
            {field.is_required && <span className="text-red-500 ml-1">*</span>}
          </p>
          <p className="text-xs text-gray-400">
            {FIELD_TYPE_LABELS[field.field_type]}
            {isMultiStep && !field.parent_field_key && ` · Step ${field.step_index + 1}`}
            {badge && ` · ${badge}`}
          </p>
        </div>

        {onAddInside && (
          <button onClick={onAddInside} className="text-[11px] text-brand-700 hover:text-brand-900 whitespace-nowrap">
            + Add inside
          </button>
        )}

        <button onClick={onRemove} className="text-gray-300 hover:text-red-500 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Recursive condition group editor — supports nested AND/OR groups
// and a NOT toggle per rule
// ============================================================

function ConditionGroupEditor({
  group, onChange, otherLeafFields, depth,
}: {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  otherLeafFields: LocalField[];
  depth: number;
}) {
  function updateRule(i: number, patch: Partial<ConditionalRule>) {
    onChange({ ...group, rules: group.rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  }
  function removeRule(i: number) {
    onChange({ ...group, rules: group.rules.filter((_, idx) => idx !== i) });
  }
  function addRule() {
    onChange({ ...group, rules: [...group.rules, { fieldKey: otherLeafFields[0]?.field_key ?? "", operator: "equals" as const }] });
  }
  function updateSubgroup(i: number, sub: ConditionGroup) {
    onChange({ ...group, groups: group.groups.map((g, idx) => (idx === i ? sub : g)) });
  }
  function removeSubgroup(i: number) {
    onChange({ ...group, groups: group.groups.filter((_, idx) => idx !== i) });
  }
  function addSubgroup() {
    onChange({ ...group, groups: [...group.groups, { logic: "all", rules: [], groups: [] }] });
  }

  return (
    <div style={depth > 0 ? { paddingLeft: 10, borderLeft: "2px solid #E5E7EB" } : undefined} className="space-y-2">
      <div className="flex items-center gap-2">
        <select className="input-field" style={{ width: 70 }} value={group.logic} onChange={(e) => onChange({ ...group, logic: e.target.value as "all" | "any" })}>
          <option value="all">ALL</option>
          <option value="any">ANY</option>
        </select>
        <span className="text-xs text-gray-500">of the following match:</span>
      </div>

      {group.rules.map((rule, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <label className="flex items-center gap-1 text-[10px] text-gray-500 flex-shrink-0" title="Negate this condition">
            <input type="checkbox" checked={!!rule.negate} onChange={(e) => updateRule(i, { negate: e.target.checked })} className="rounded border-gray-300" />
            NOT
          </label>
          <select className="input-field" value={rule.fieldKey} onChange={(e) => updateRule(i, { fieldKey: e.target.value })}>
            {otherLeafFields.map((f) => <option key={f.field_key} value={f.field_key}>{f.label}</option>)}
          </select>
          <select className="input-field" value={rule.operator} onChange={(e) => updateRule(i, { operator: e.target.value as ConditionOperator })} style={{ width: 128 }}>
            {Object.entries(OPERATOR_LABELS).map(([op, label]) => <option key={op} value={op}>{label}</option>)}
          </select>
          {rule.operator !== "is_empty" && rule.operator !== "is_not_empty" && (
            <input className="input-field" value={rule.value ?? ""} onChange={(e) => updateRule(i, { value: e.target.value })} placeholder="Value" style={{ width: 80 }} />
          )}
          <button type="button" onClick={() => removeRule(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}

      {group.groups.map((sub, i) => (
        <div key={i}>
          <ConditionGroupEditor group={sub} onChange={(g) => updateSubgroup(i, g)} otherLeafFields={otherLeafFields} depth={depth + 1} />
          <button type="button" onClick={() => removeSubgroup(i)} className="text-[11px] text-red-500 mt-1" style={{ marginLeft: depth > 0 ? 10 : 0 }}>
            Remove nested group
          </button>
        </div>
      ))}

      <div className="flex gap-3">
        <button type="button" onClick={addRule} className="text-xs font-medium flex items-center gap-1" style={{ color: "#1A348C" }}>
          <Plus className="w-3.5 h-3.5" /> Add condition
        </button>
        {depth < 2 && (
          <button type="button" onClick={addSubgroup} className="text-xs font-medium flex items-center gap-1" style={{ color: "#6B7280" }}>
            <Plus className="w-3.5 h-3.5" /> Add nested group
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Right panel — field properties (General / Validation / Appearance)
// ============================================================

function FieldPropertiesPanel({
  field, tab, onTabChange, onChange, isMultiStep, containerFields, allFields,
}: {
  field: LocalField;
  tab: "general" | "validation" | "appearance" | "logic";
  onTabChange: (tab: "general" | "validation" | "appearance" | "logic") => void;
  onChange: (updates: Partial<LocalField>) => void;
  isMultiStep: boolean;
  containerFields: LocalField[];
  allFields: LocalField[];
}) {
  const settings = field.settings;
  const validation = field.validation;
  const isContainer = CONTAINER_FIELD_TYPES.includes(field.field_type);
  const parent = field.parent_field_key ? containerFields.find((f) => f.field_key === field.parent_field_key) : null;
  const otherLeafFields = allFields.filter((f) => f.field_key !== field.field_key && !CONTAINER_FIELD_TYPES.includes(f.field_type));
  const isCalculable = CALCULABLE_TYPES.includes(field.field_type);

  function setSettings(patch: Partial<FieldSettings>) {
    onChange({ settings: { ...settings, ...patch } });
  }
  function setValidation(patch: Partial<FieldValidationRules>) {
    onChange({ validation: { ...validation, ...patch } });
  }
  function setDataSource(patch: Partial<DataSourceConfig>) {
    onChange({ dataSource: { type: "manual", ...field.dataSource, ...patch } });
  }
  function setConditionalAction(action: "show" | "hide") {
    const current: ConditionalLogic = field.conditionalLogic ?? { action: "show", root: { logic: "all", rules: [], groups: [] } };
    onChange({ conditionalLogic: { ...current, action } });
  }
  function setRootGroup(root: ConditionGroup) {
    const current: ConditionalLogic = field.conditionalLogic ?? { action: "show", root: { logic: "all", rules: [], groups: [] } };
    onChange({ conditionalLogic: { ...current, root } });
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{FIELD_TYPE_LABELS[field.field_type]}</h3>
      <div className="flex gap-1 mb-4 border-b border-gray-100">
        {(["general", "validation", "appearance", "logic"] as const).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className="px-2.5 py-1.5 text-xs font-medium capitalize"
            style={{ color: tab === t ? "#1A348C" : "#9CA3AF", borderBottom: tab === t ? "2px solid #1A348C" : "2px solid transparent" }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
            <input className="input-field" value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Internal name</label>
            <input className="input-field" value={settings.internalName ?? ""} onChange={(e) => setSettings({ internalName: e.target.value })} placeholder={field.field_key} />
          </div>

          {!isContainer && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Placeholder</label>
                <input className="input-field" value={field.placeholder} onChange={(e) => onChange({ placeholder: e.target.value })} placeholder="Hint text..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Default value</label>
                <input className="input-field" value={settings.defaultValue ?? ""} onChange={(e) => setSettings({ defaultValue: e.target.value })} />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea className="input-field" rows={2} value={field.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Shown under the label" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tooltip</label>
            <input className="input-field" value={settings.tooltip ?? ""} onChange={(e) => setSettings({ tooltip: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Help text</label>
            <input className="input-field" value={settings.helpText ?? ""} onChange={(e) => setSettings({ helpText: e.target.value })} />
          </div>

          {CHOICE_TYPES.includes(field.field_type) && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data source</label>
                <select
                  className="input-field"
                  value={field.dataSource?.type ?? "manual"}
                  onChange={(e) => setDataSource({ type: e.target.value as DataSourceConfig["type"], referenceKey: undefined })}
                >
                  <option value="manual">Manual values</option>
                  <option value="reference">Reference data</option>
                </select>
              </div>
              {field.dataSource?.type === "reference" ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Reference list</label>
                  <select
                    className="input-field"
                    value={field.dataSource?.referenceKey ?? ""}
                    onChange={(e) => setDataSource({ referenceKey: e.target.value as ReferenceListKey })}
                  >
                    <option value="">— Select —</option>
                    {Object.entries(REFERENCE_LIST_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">A safe, read-only lookup — not a free-form table or SQL query.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Options (one per line)</label>
                  <textarea
                    className="input-field"
                    rows={4}
                    value={field.options.join("\n")}
                    onChange={(e) => onChange({ options: e.target.value.split("\n") })}
                    placeholder={"Option 1\nOption 2\nOption 3"}
                  />
                </div>
              )}
            </div>
          )}

          {field.field_type === FieldType.HtmlBlock && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">HTML content</label>
              <textarea className="input-field font-mono" rows={5} value={settings.htmlContent ?? ""} onChange={(e) => setSettings({ htmlContent: e.target.value })} placeholder="<p>Custom HTML…</p>" />
            </div>
          )}

          {field.field_type === FieldType.Columns && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Number of columns</label>
              <select className="input-field" value={settings.columnCount ?? 2} onChange={(e) => setSettings({ columnCount: Number(e.target.value) as 2 | 3 })}>
                <option value={2}>2 columns</option>
                <option value={3}>3 columns</option>
              </select>
            </div>
          )}

          {field.field_type === FieldType.Tabs && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tab labels (one per line)</label>
              <textarea
                className="input-field"
                rows={3}
                value={(settings.tabs ?? ["Tab 1", "Tab 2"]).join("\n")}
                onChange={(e) => setSettings({ tabs: e.target.value.split("\n") })}
              />
            </div>
          )}

          {(field.field_type === FieldType.Section || field.field_type === FieldType.Accordion || field.field_type === FieldType.Card) && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!settings.collapsible} onChange={(e) => setSettings({ collapsible: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-sm text-gray-700">Collapsible</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!settings.repeatable} onChange={(e) => setSettings({ repeatable: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-sm text-gray-700">Repeatable group</span>
              </label>
              {settings.repeatable && (
                <input className="input-field" value={settings.repeatableLabel ?? ""} onChange={(e) => setSettings({ repeatableLabel: e.target.value })} placeholder={`e.g. "Add another ${field.label}"`} />
              )}
            </div>
          )}

          {/* Parent / column / tab assignment for child fields */}
          {containerFields.length > 0 && !isContainer && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Parent container</label>
              <select
                className="input-field"
                value={field.parent_field_key ?? ""}
                onChange={(e) => onChange({ parent_field_key: e.target.value || null, column_index: null })}
              >
                <option value="">— None (top level) —</option>
                {containerFields.map((c) => <option key={c.field_key} value={c.field_key}>{c.label}</option>)}
              </select>
            </div>
          )}
          {parent?.field_type === FieldType.Columns && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Column</label>
              <select className="input-field" value={field.column_index ?? 0} onChange={(e) => onChange({ column_index: Number(e.target.value) })}>
                {Array.from({ length: parent.settings.columnCount ?? 2 }).map((_, i) => (
                  <option key={i} value={i}>Column {i + 1}</option>
                ))}
              </select>
            </div>
          )}
          {parent?.field_type === FieldType.Tabs && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tab</label>
              <select className="input-field" value={settings.tabIndex ?? 0} onChange={(e) => setSettings({ tabIndex: Number(e.target.value) })}>
                {(parent.settings.tabs ?? ["Tab 1", "Tab 2"]).map((label, i) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {isMultiStep && !field.parent_field_key && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Step</label>
              <input type="number" min={0} className="input-field" value={field.step_index} onChange={(e) => onChange({ step_index: Number(e.target.value) || 0 })} />
            </div>
          )}

          {!isContainer && field.field_type !== FieldType.Divider && field.field_type !== FieldType.InfoPanel && (
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={field.is_required} onChange={(e) => onChange({ is_required: e.target.checked })} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700">Required field</span>
            </label>
          )}
        </div>
      )}

      {tab === "validation" && (
        <div className="space-y-3">
          {(field.field_type === FieldType.Text || field.field_type === FieldType.Textarea) && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min length</label>
                <input type="number" className="input-field" value={validation.minLength ?? ""} onChange={(e) => setValidation({ minLength: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max length</label>
                <input type="number" className="input-field" value={validation.maxLength ?? ""} onChange={(e) => setValidation({ maxLength: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>
          )}
          {(field.field_type === FieldType.Number || field.field_type === FieldType.Currency || field.field_type === FieldType.Percentage) && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Min value</label>
                <input type="number" className="input-field" value={validation.min ?? ""} onChange={(e) => setValidation({ min: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max value</label>
                <input type="number" className="input-field" value={validation.max ?? ""} onChange={(e) => setValidation({ max: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Regex pattern</label>
            <input className="input-field" value={validation.regex ?? ""} onChange={(e) => setValidation({ regex: e.target.value || undefined })} placeholder="e.g. ^[0-9]{13}$" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!validation.uniqueValue} onChange={(e) => setValidation({ uniqueValue: e.target.checked })} className="rounded border-gray-300" />
            <span className="text-sm text-gray-700">Must be unique</span>
          </label>
        </div>
      )}

      {tab === "appearance" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Width</label>
            <select className="input-field" value={settings.width ?? "full"} onChange={(e) => setSettings({ width: e.target.value as FieldSettings["width"] })}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="full">Full width</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Icon</label>
            <input className="input-field" value={settings.icon ?? ""} onChange={(e) => setSettings({ icon: e.target.value })} placeholder="Optional icon name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">CSS class</label>
            <input className="input-field" value={settings.cssClass ?? ""} onChange={(e) => setSettings({ cssClass: e.target.value })} />
          </div>
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!settings.readOnly} onChange={(e) => setSettings({ readOnly: e.target.checked })} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700">Read only</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!settings.disabled} onChange={(e) => setSettings({ disabled: e.target.checked })} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700">Disabled</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!settings.hidden} onChange={(e) => setSettings({ hidden: e.target.checked })} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700">Hidden</span>
            </label>
          </div>
        </div>
      )}

      {tab === "logic" && (
        <div className="space-y-4">
          {isCalculable && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Calculated formula</label>
              <textarea
                className="input-field font-mono"
                rows={3}
                value={field.calculatedFormula}
                onChange={(e) => onChange({ calculatedFormula: e.target.value })}
                placeholder="e.g. {premium} * {vat_rate}"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Reference other fields as <code>{"{field_key}"}</code>. Supports +, -, *, /, and AGE({"{dob_field}"}) for
                age-style calculations. Field becomes read-only and auto-computed.
              </p>
              {otherLeafFields.length > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Available: {otherLeafFields.map((f) => f.field_key).join(", ")}
                </p>
              )}
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Conditional visibility</p>
            {otherLeafFields.length === 0 ? (
              <p className="text-xs text-gray-400">Add other fields to this form to set up conditions.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    className="input-field"
                    style={{ width: 90 }}
                    value={field.conditionalLogic?.action ?? "show"}
                    onChange={(e) => setConditionalAction(e.target.value as "show" | "hide")}
                  >
                    <option value="show">Show</option>
                    <option value="hide">Hide</option>
                  </select>
                  <span className="text-xs text-gray-500">this field when:</span>
                </div>

                <ConditionGroupEditor
                  group={field.conditionalLogic?.root ?? { logic: "all", rules: [], groups: [] }}
                  onChange={setRootGroup}
                  otherLeafFields={otherLeafFields}
                  depth={0}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Live preview (flat — full structural rendering happens on the
// actual public form; this is a quick content check)
// ============================================================

function FormPreview({ form, fields }: { form: Form | null; fields: LocalField[] }) {
  const visible = fields.filter((f) => !f.settings.hidden);
  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-brand-900 px-6 py-5">
          <h2 className="text-lg font-semibold text-white">{form?.name || "Form preview"}</h2>
          {form?.description && <p className="text-sm text-brand-300 mt-1">{form.description}</p>}
        </div>
        <div className="p-6 space-y-4">
          {visible.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Add fields to see the preview</p>
          ) : (
            visible.map((field) => {
              if (field.field_type === FieldType.Divider) return <hr key={field._localId} className="border-gray-200" />;
              if (CONTAINER_FIELD_TYPES.includes(field.field_type)) {
                return (
                  <div key={field._localId} className="pt-2 pb-1 border-t border-gray-100 first:border-0 first:pt-0">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{field.label}</p>
                  </div>
                );
              }
              return (
                <div key={field._localId} className={field.parent_field_key ? "pl-4" : ""}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {field.label}
                    {field.is_required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.description && <p className="text-xs text-gray-400 mb-1.5">{field.description}</p>}
                  {field.field_type !== FieldType.HtmlBlock && field.field_type !== FieldType.InfoPanel && renderPreviewField(field)}
                  {field.field_type === FieldType.InfoPanel && (
                    <div className="p-3 rounded-lg text-xs text-gray-600" style={{ background: "#EEF4FD" }}>{field.description || field.label}</div>
                  )}
                  {field.settings.helpText && <p className="text-[11px] text-gray-400 mt-1">{field.settings.helpText}</p>}
                </div>
              );
            })
          )}
          {visible.length > 0 && <button className="btn btn-primary w-full h-10 mt-2">Submit</button>}
        </div>
      </div>
    </div>
  );
}

function renderPreviewField(field: LocalField) {
  const disabled = true;
  switch (field.field_type) {
    case FieldType.Textarea:
      return <textarea className="input-field" placeholder={field.placeholder} rows={3} disabled={disabled} />;
    case FieldType.Select:
      return (
        <select className="input-field" disabled={disabled}>
          <option>{field.placeholder || "Select..."}</option>
          {field.options.map((opt, i) => <option key={i}>{opt}</option>)}
        </select>
      );
    case FieldType.MultiSelect:
      return (
        <div className="space-y-1.5">
          {field.options.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" disabled className="rounded border-gray-300" />
              {opt}
            </label>
          ))}
        </div>
      );
    case FieldType.Radio:
      return (
        <div className="space-y-2">
          {field.options.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" name={field._localId} disabled className="border-gray-300" />
              {opt}
            </label>
          ))}
        </div>
      );
    case FieldType.Checkbox:
      return (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" disabled className="rounded border-gray-300" />
          {field.placeholder || field.label}
        </label>
      );
    case FieldType.Toggle:
      return (
        <div style={{ width: 40, height: 22, borderRadius: 11, background: "#E5E7EB", position: "relative" }}>
          <div style={{ position: "absolute", top: 2, left: 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
        </div>
      );
    case FieldType.Date:
      return <input type="date" className="input-field" disabled={disabled} />;
    case FieldType.Time:
      return <input type="time" className="input-field" disabled={disabled} />;
    case FieldType.DateTime:
      return <input type="datetime-local" className="input-field" disabled={disabled} />;
    case FieldType.Currency:
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
          <input type="number" className="input-field pl-7" placeholder={field.placeholder} disabled={disabled} />
        </div>
      );
    case FieldType.Percentage:
      return (
        <div className="relative">
          <input type="number" className="input-field pr-7" placeholder={field.placeholder} disabled={disabled} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
        </div>
      );
    case FieldType.Password:
      return <input type="password" className="input-field" placeholder={field.placeholder} disabled={disabled} />;
    case FieldType.File:
    case FieldType.Image:
    case FieldType.Camera:
      return <input type="file" className="input-field" disabled={disabled} />;
    case FieldType.Signature:
      return <div className="input-field flex items-center justify-center text-xs text-gray-400" style={{ height: 80, background: "#FAFBFC" }}>Signature pad</div>;
    default:
      return (
        <input
          type={field.field_type === FieldType.Email ? "email" : field.field_type === FieldType.Phone ? "tel" : field.field_type === FieldType.Number ? "number" : "text"}
          className="input-field"
          placeholder={field.placeholder}
          disabled={disabled}
        />
      );
  }
}
