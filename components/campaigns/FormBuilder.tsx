"use client";

import React, { useState, useEffect } from "react";
import { getForm, getFormFields, upsertFormFields } from "@/lib/campaigns-api";
import { FieldType } from "@/types";
import type { Form, FormField } from "@/types";
import {
  ArrowLeft,
  Plus,
  GripVertical,
  Trash2,
  Save,
  Eye,
  ChevronDown,
  ChevronUp,
  Check,
  Type,
  Mail,
  Phone,
  Hash,
  AlignLeft,
  List,
  CircleDot,
  CheckSquare,
  Calendar,
  CreditCard,
} from "lucide-react";

const FIELD_TYPE_CONFIG: Record<
  FieldType,
  { label: string; icon: React.ReactNode; defaultLabel: string }
> = {
  [FieldType.Text]: { label: "Text", icon: <Type className="w-4 h-4" />, defaultLabel: "Full name" },
  [FieldType.Email]: { label: "Email", icon: <Mail className="w-4 h-4" />, defaultLabel: "Email address" },
  [FieldType.Phone]: { label: "Phone", icon: <Phone className="w-4 h-4" />, defaultLabel: "Phone number" },
  [FieldType.Number]: { label: "Number", icon: <Hash className="w-4 h-4" />, defaultLabel: "Amount" },
  [FieldType.Textarea]: { label: "Long text", icon: <AlignLeft className="w-4 h-4" />, defaultLabel: "Message" },
  [FieldType.Select]: { label: "Dropdown", icon: <List className="w-4 h-4" />, defaultLabel: "Select an option" },
  [FieldType.Radio]: { label: "Radio", icon: <CircleDot className="w-4 h-4" />, defaultLabel: "Choose one" },
  [FieldType.Checkbox]: { label: "Checkbox", icon: <CheckSquare className="w-4 h-4" />, defaultLabel: "I agree" },
  [FieldType.Date]: { label: "Date", icon: <Calendar className="w-4 h-4" />, defaultLabel: "Date" },
  [FieldType.IdNumber]: { label: "ID Number", icon: <CreditCard className="w-4 h-4" />, defaultLabel: "ID number" },
};

interface LocalField {
  _localId: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  placeholder: string;
  is_required: boolean;
  options: string[];
  display_order: number;
}

interface FormBuilderProps {
  formId: string;
  onBack: () => void;
}

export default function FormBuilder({ formId, onBack }: FormBuilderProps) {
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<LocalField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedField, setExpandedField] = useState<string | null>(null);

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
          is_required: f.is_required,
          options: f.options ? (f.options as any).items || [] : [],
          display_order: f.display_order,
        }))
      );
    } catch (err) {
      console.error("Failed to load form:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addField = (type: FieldType) => {
    const config = FIELD_TYPE_CONFIG[type];
    const key = `${type}_${Date.now()}`;
    const newField: LocalField = {
      _localId: key,
      field_key: key,
      label: config.defaultLabel,
      field_type: type,
      placeholder: "",
      is_required: false,
      options: type === FieldType.Select || type === FieldType.Radio ? ["Option 1", "Option 2"] : [],
      display_order: fields.length,
    };
    setFields([...fields, newField]);
    setExpandedField(key);
  };

  const removeField = (localId: string) => {
    setFields(fields.filter((f) => f._localId !== localId));
  };

  const updateField = (localId: string, updates: Partial<LocalField>) => {
    setFields(
      fields.map((f) =>
        f._localId === localId ? { ...f, ...updates } : f
      )
    );
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newFields = [...fields];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newFields.length) return;
    [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
    setFields(newFields.map((f, i) => ({ ...f, display_order: i })));
  };

  const handleSave = async () => {
    if (!formId) return;
    setIsSaving(true);
    setSaved(false);

    try {
      const payload = fields.map((f, i) => ({
        form_id: formId,
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type,
        placeholder: f.placeholder || null,
        is_required: f.is_required,
        options:
          f.options.length > 0 ? { items: f.options } : null,
        validation_rules: null,
        display_order: i,
      }));

      await upsertFormFields(formId, payload as any);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save fields:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="card animate-pulse h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="btn btn-ghost px-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {form?.name || "Form builder"}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 font-mono">
              /f/{form?.slug}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="btn btn-secondary"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Editor" : "Preview"}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : isSaving ? (
              "Saving..."
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save fields
              </>
            )}
          </button>
        </div>
      </div>

      {showPreview ? (
        <FormPreview form={form} fields={fields} />
      ) : (
        <div className="grid grid-cols-3 gap-5">
          {/* Field palette */}
          <div className="col-span-1">
            <div className="card sticky top-28">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Add fields
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(FIELD_TYPE_CONFIG).map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => addField(type as FieldType)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-left hover:bg-gray-50 hover:border-gray-300 transition-all"
                  >
                    <span className="text-gray-400">{config.icon}</span>
                    <span className="text-xs font-medium text-gray-700">
                      {config.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Fields editor */}
          <div className="col-span-2 space-y-3">
            {fields.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <Type className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No fields yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Click a field type on the left to add it
                </p>
              </div>
            ) : (
              fields.map((field, index) => {
                const config = FIELD_TYPE_CONFIG[field.field_type];
                const isExpanded = expandedField === field._localId;

                return (
                  <div
                    key={field._localId}
                    className="card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveField(index, "up")}
                          disabled={index === 0}
                          className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => moveField(index, "down")}
                          disabled={index === fields.length - 1}
                          className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="w-8 h-8 rounded-md bg-gray-50 flex items-center justify-center text-gray-400">
                        {config.icon}
                      </div>

                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() =>
                          setExpandedField(isExpanded ? null : field._localId)
                        }
                      >
                        <p className="text-sm font-medium text-gray-900">
                          {field.label}
                          {field.is_required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400">{config.label}</p>
                      </div>

                      <button
                        onClick={() => removeField(field._localId)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Label
                            </label>
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) =>
                                updateField(field._localId, {
                                  label: e.target.value,
                                })
                              }
                              className="input-field"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Placeholder
                            </label>
                            <input
                              type="text"
                              value={field.placeholder}
                              onChange={(e) =>
                                updateField(field._localId, {
                                  placeholder: e.target.value,
                                })
                              }
                              className="input-field"
                              placeholder="Hint text..."
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.is_required}
                            onChange={(e) =>
                              updateField(field._localId, {
                                is_required: e.target.checked,
                              })
                            }
                            className="rounded border-gray-300"
                          />
                          <span className="text-sm text-gray-700">
                            Required field
                          </span>
                        </label>

                        {(field.field_type === FieldType.Select ||
                          field.field_type === FieldType.Radio) && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Options (one per line)
                            </label>
                            <textarea
                              value={field.options.join("\n")}
                              onChange={(e) =>
                                updateField(field._localId, {
                                  options: e.target.value.split("\n"),
                                })
                              }
                              className="input-field"
                              rows={3}
                              placeholder={"Option 1\nOption 2\nOption 3"}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Live preview
// ============================================================

function FormPreview({
  form,
  fields,
}: {
  form: Form | null;
  fields: LocalField[];
}) {
  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-brand-900 px-6 py-5">
          <h2 className="text-lg font-semibold text-white">
            {form?.name || "Form preview"}
          </h2>
          {form?.description && (
            <p className="text-sm text-brand-300 mt-1">{form.description}</p>
          )}
        </div>
        <div className="p-6 space-y-4">
          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Add fields to see the preview
            </p>
          ) : (
            fields.map((field) => (
              <div key={field._localId}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {field.label}
                  {field.is_required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                {renderPreviewField(field)}
              </div>
            ))
          )}
          {fields.length > 0 && (
            <button className="btn btn-primary w-full h-10 mt-2">
              Submit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function renderPreviewField(field: LocalField) {
  switch (field.field_type) {
    case FieldType.Textarea:
      return (
        <textarea
          className="input-field"
          placeholder={field.placeholder}
          rows={3}
          disabled
        />
      );
    case FieldType.Select:
      return (
        <select className="input-field" disabled>
          <option>{field.placeholder || "Select..."}</option>
          {field.options.map((opt, i) => (
            <option key={i}>{opt}</option>
          ))}
        </select>
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
    case FieldType.Date:
      return <input type="date" className="input-field" disabled />;
    default:
      return (
        <input
          type={field.field_type === FieldType.Email ? "email" : field.field_type === FieldType.Phone ? "tel" : field.field_type === FieldType.Number ? "number" : "text"}
          className="input-field"
          placeholder={field.placeholder}
          disabled
        />
      );
  }
}
