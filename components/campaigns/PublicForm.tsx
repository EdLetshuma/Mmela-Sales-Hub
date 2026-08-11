"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  getFormBySlug, getFormFields, submitPublicLead, uploadFormFile, getReferenceListOptions,
  saveFormDraftRemote, getFormDraftRemote,
} from "@/lib/campaigns-api";
import type { Form, FormField, ConditionalRule, ConditionGroup, ReferenceListKey } from "@/types";
import { FieldType, CONTAINER_FIELD_TYPES } from "@/types";
import { evaluateFormula } from "@/lib/form-formula";
import { CheckCircle, Loader2, X, Plus } from "lucide-react";

function draftKey(slug: string) {
  return `mmela_form_draft_${slug}`;
}

interface PublicFormProps {
  slug: string;
}

export default function PublicForm({ slug }: PublicFormProps) {
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [multiValues, setMultiValues] = useState<Record<string, string[]>>({});
  const [uploadingKeys, setUploadingKeys] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [repeatCounts, setRepeatCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<Record<string, number>>({});
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  const [draftLink, setDraftLink] = useState<string | null>(null);
  const [remoteDraftPending, setRemoteDraftPending] = useState<Record<string, unknown> | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [referenceOptions, setReferenceOptions] = useState<Partial<Record<ReferenceListKey, string[]>>>({});

  useEffect(() => {
    loadForm();
  }, [slug]);

  const loadForm = async () => {
    try {
      const formData = await getFormBySlug(slug);
      if (!formData) {
        setNotFound(true);
        return;
      }
      setForm(formData);
      const fieldData = await getFormFields(formData.id);
      setFields(fieldData);

      const defaults: Record<string, string> = {};
      fieldData.forEach((f) => {
        defaults[f.field_key] = "";
      });
      setValues(defaults);

      const collapseDefaults: Record<string, boolean> = {};
      fieldData.forEach((f) => {
        if (f.settings?.collapsible || f.field_type === FieldType.Accordion) {
          collapseDefaults[f.field_key] = f.settings?.collapsedByDefault ?? f.field_type === FieldType.Accordion;
        }
      });
      setCollapsedSections(collapseDefaults);

      const referenceKeys = Array.from(new Set(
        fieldData
          .filter((f) => f.data_source?.type === "reference" && f.data_source.referenceKey)
          .map((f) => f.data_source!.referenceKey!)
      ));
      if (referenceKeys.length > 0) {
        const lists = await Promise.all(referenceKeys.map((key) => getReferenceListOptions(key)));
        setReferenceOptions(Object.fromEntries(referenceKeys.map((key, i) => [key, lists[i]])));
      }

      if (formData.is_multi_step && typeof window !== "undefined") {
        const urlToken = new URLSearchParams(window.location.search).get("draft");
        if (urlToken) {
          try {
            const remote = await getFormDraftRemote(urlToken);
            if (remote) {
              setDraftToken(urlToken);
              setRemoteDraftPending(remote);
              setDraftAvailable(true);
            }
          } catch (err) {
            console.error("Failed to load remote draft:", err);
          }
        } else {
          const saved = window.localStorage.getItem(draftKey(slug));
          if (saved) setDraftAvailable(true);
        }
      }
    } catch (err) {
      console.error("Failed to load form:", err);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Recompute calculated fields whenever any value changes — including
  // once per instance of a repeatable group, resolving each formula's
  // field references against that same instance's siblings.
  useEffect(() => {
    const calcFields = fields.filter((f) => f.calculated_formula);
    if (calcFields.length === 0) return;
    setValues((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const f of calcFields) {
        const parentKey = f.parent_field_key;
        const parent = parentKey ? fields.find((p) => p.field_key === parentKey) : null;
        const count = parent?.settings?.repeatable ? (repeatCounts[parentKey!] ?? 1) : 1;
        for (let i = 0; i < count; i++) {
          const vKey = valueKey(f, i);
          const result = evaluateFormula(f.calculated_formula!, (refKey) => {
            const refField = fields.find((rf) => rf.field_key === refKey);
            const refVKey = refField && refField.parent_field_key === parentKey ? valueKey(refField, i) : refKey;
            return next[refVKey];
          });
          const str = result != null ? String(Math.round(result * 100) / 100) : "";
          if (next[vKey] !== str) { next[vKey] = str; changed = true; }
        }
      }
      return changed ? next : prev;
    });
  }, [values, fields, repeatCounts]);

  function evaluateRule(rule: ConditionalRule): boolean {
    const raw = multiValues[rule.fieldKey]?.length ? multiValues[rule.fieldKey].join(",") : (values[rule.fieldKey] ?? "");
    let result: boolean;
    switch (rule.operator) {
      case "equals": result = raw === (rule.value ?? ""); break;
      case "not_equals": result = raw !== (rule.value ?? ""); break;
      case "contains": result = raw.includes(rule.value ?? ""); break;
      case "greater_than": result = Number(raw) > Number(rule.value ?? 0); break;
      case "less_than": result = Number(raw) < Number(rule.value ?? 0); break;
      case "is_empty": result = !raw.trim(); break;
      case "is_not_empty": result = !!raw.trim(); break;
      default: result = true;
    }
    return rule.negate ? !result : result;
  }

  function evaluateGroup(group: ConditionGroup): boolean {
    const ruleResults = group.rules.map(evaluateRule);
    const groupResults = group.groups.map(evaluateGroup);
    const results = [...ruleResults, ...groupResults];
    if (results.length === 0) return true;
    return group.logic === "all" ? results.every(Boolean) : results.some(Boolean);
  }

  function isFieldVisible(field: FormField): boolean {
    if (field.settings?.hidden) return false;
    const logic = field.conditional_logic;
    if (!logic || (logic.root.rules.length === 0 && logic.root.groups.length === 0)) return true;
    const matched = evaluateGroup(logic.root);
    return logic.action === "show" ? matched : !matched;
  }

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleMultiToggle = (key: string, option: string, checked: boolean) => {
    setMultiValues((prev) => {
      const current = prev[key] ?? [];
      return { ...prev, [key]: checked ? [...current, option] : current.filter((o) => o !== option) };
    });
  };

  const handleFileUpload = async (field: FormField, file: File | null) => {
    if (!file || !form) return;
    setUploadingKeys((prev) => new Set(prev).add(field.field_key));
    try {
      const url = await uploadFormFile(form.id, file);
      handleChange(field.field_key, url);
    } catch (err) {
      console.error("Upload failed:", err);
      setError(`Failed to upload ${field.label.toLowerCase()}.`);
    } finally {
      setUploadingKeys((prev) => { const next = new Set(prev); next.delete(field.field_key); return next; });
    }
  };

  async function handleSaveDraft() {
    const payload = { values, multiValues, stepIndex, repeatCounts };
    window.localStorage.setItem(draftKey(slug), JSON.stringify(payload));

    if (form) {
      const token = draftToken ?? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      try {
        await saveFormDraftRemote(token, form.id, payload);
        setDraftToken(token);
        const link = `${window.location.origin}${window.location.pathname}?draft=${token}`;
        setDraftLink(link);
      } catch (err) {
        console.error("Failed to save remote draft:", err);
      }
    }

    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2000);
  }

  function applyDraftPayload(payload: Record<string, unknown>) {
    setValues((payload.values as Record<string, string>) ?? {});
    setMultiValues((payload.multiValues as Record<string, string[]>) ?? {});
    setStepIndex((payload.stepIndex as number) ?? 0);
    setRepeatCounts((payload.repeatCounts as Record<string, number>) ?? {});
  }

  function handleResumeDraft() {
    if (remoteDraftPending) {
      applyDraftPayload(remoteDraftPending);
      setRemoteDraftPending(null);
      setDraftAvailable(false);
      return;
    }
    const saved = window.localStorage.getItem(draftKey(slug));
    if (saved) {
      try { applyDraftPayload(JSON.parse(saved)); } catch { /* corrupt draft — ignore */ }
    }
    setDraftAvailable(false);
  }

  function handleDiscardDraft() {
    window.localStorage.removeItem(draftKey(slug));
    setRemoteDraftPending(null);
    setDraftAvailable(false);
  }

  function buildCapturedData(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const repeatableContainers = fields.filter((f) => CONTAINER_FIELD_TYPES.includes(f.field_type) && f.settings?.repeatable);
    const repeatableChildKeys = new Set(repeatableContainers.flatMap((c) => childrenOf(c.field_key).map((ch) => ch.field_key)));
    const skipTypes = [...CONTAINER_FIELD_TYPES, FieldType.Divider, FieldType.HtmlBlock, FieldType.InfoPanel];

    for (const f of fields) {
      if (skipTypes.includes(f.field_type)) continue;
      if (repeatableChildKeys.has(f.field_key)) continue;
      result[f.field_key] = f.field_type === FieldType.MultiSelect ? (multiValues[f.field_key] ?? []) : (values[f.field_key] ?? "");
    }

    for (const container of repeatableContainers) {
      const count = repeatCounts[container.field_key] ?? 1;
      const children = childrenOf(container.field_key);
      const instances: Record<string, unknown>[] = [];
      for (let i = 0; i < count; i++) {
        const inst: Record<string, unknown> = {};
        for (const child of children) {
          const vKey = valueKey(child, i);
          inst[child.field_key] = child.field_type === FieldType.MultiSelect ? (multiValues[vKey] ?? []) : (values[vKey] ?? "");
        }
        instances.push(inst);
      }
      result[container.field_key] = instances;
    }

    return result;
  }

  function instanceCountFor(f: FormField): number {
    const parent = f.parent_field_key ? fields.find((p) => p.field_key === f.parent_field_key) : null;
    return parent?.settings?.repeatable ? (repeatCounts[f.parent_field_key!] ?? 1) : 1;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const missing: string[] = [];
    for (const f of fields) {
      if (!f.is_required || !isFieldVisible(f)) continue;
      const count = instanceCountFor(f);
      for (let i = 0; i < count; i++) {
        const vKey = valueKey(f, i);
        const empty = f.field_type === FieldType.MultiSelect ? (multiValues[vKey] ?? []).length === 0 : !values[vKey]?.trim();
        if (empty) missing.push(count > 1 ? `${f.label} (#${i + 1})` : f.label);
      }
    }

    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    const invalid: string[] = [];
    for (const f of fields) {
      const rules = f.validation_rules;
      if (!rules || !isFieldVisible(f)) continue;
      const count = instanceCountFor(f);
      for (let i = 0; i < count; i++) {
        const vKey = valueKey(f, i);
        const raw = values[vKey];
        if (!raw) continue;
        const suffix = count > 1 ? ` (#${i + 1})` : "";
        if (rules.minLength != null && raw.length < rules.minLength) invalid.push(`${f.label}${suffix} must be at least ${rules.minLength} characters`);
        if (rules.maxLength != null && raw.length > rules.maxLength) invalid.push(`${f.label}${suffix} must be at most ${rules.maxLength} characters`);
        if (rules.min != null && Number(raw) < rules.min) invalid.push(`${f.label}${suffix} must be at least ${rules.min}`);
        if (rules.max != null && Number(raw) > rules.max) invalid.push(`${f.label}${suffix} must be at most ${rules.max}`);
        if (rules.regex) {
          try {
            if (!new RegExp(rules.regex).test(raw)) invalid.push(`${f.label}${suffix} is not in the correct format`);
          } catch { /* invalid regex configured — skip */ }
        }
      }
    }
    if (invalid.length > 0) {
      setError(invalid.join(". "));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Match name field by: field_key contains "name", OR label contains "name"
      // Covers: text_1776262190027 with label "Full name", "First name", "Name", etc.
      const nameField = fields.find((f) =>
        f.field_type === FieldType.Text && (
          f.field_key.toLowerCase().includes("name") ||
          f.label.toLowerCase().includes("name") ||
          f.label.toLowerCase().includes("full name") ||
          f.label.toLowerCase().includes("first name") ||
          f.label.toLowerCase().includes("surname")
        )
      );

      // Also try first_name + last_name combination
      const firstNameField = fields.find((f) =>
        f.field_type === FieldType.Text && (
          f.field_key.toLowerCase().includes("first") ||
          f.label.toLowerCase().includes("first name")
        )
      );
      const lastNameField = fields.find((f) =>
        f.field_type === FieldType.Text && (
          f.field_key.toLowerCase().includes("last") ||
          f.label.toLowerCase().includes("last name") ||
          f.label.toLowerCase().includes("surname")
        )
      );

      const emailField = fields.find((f) => f.field_type === FieldType.Email);
      const phoneField = fields.find((f) => f.field_type === FieldType.Phone);

      // Build the name — prefer dedicated name field, fall back to first+last, then first text field
      let resolvedName = "Unknown";
      if (nameField && values[nameField.field_key]?.trim()) {
        resolvedName = values[nameField.field_key].trim();
      } else if (firstNameField && values[firstNameField.field_key]?.trim()) {
        const first = values[firstNameField.field_key].trim();
        const last = lastNameField ? values[lastNameField.field_key]?.trim() ?? "" : "";
        resolvedName = [first, last].filter(Boolean).join(" ");
      } else {
        // Last resort: first non-empty text field
        const anyTextField = fields.find(
          (f) => f.field_type === FieldType.Text && values[f.field_key]?.trim()
        );
        if (anyTextField) resolvedName = values[anyTextField.field_key].trim();
      }

      const params = new URLSearchParams(window.location.search);

      const campaignData = (form as Form & { campaigns?: { business_unit_id?: string } }).campaigns;
      const businessUnitId = campaignData?.business_unit_id || "";

      await submitPublicLead({
        name: resolvedName,
        email: emailField ? values[emailField.field_key] || "" : "",
        phone: phoneField ? values[phoneField.field_key] : undefined,
        form_id: form.id,
        campaign_id: form.campaign_id,
        business_unit_id: businessUnitId,
        source_type: "form",
        captured_data: buildCapturedData(),
        utm_source: params.get("utm_source") || undefined,
        utm_medium: params.get("utm_medium") || undefined,
        utm_campaign: params.get("utm_campaign") || undefined,
      });

      window.localStorage.removeItem(draftKey(slug));
      if (form.settings?.redirectUrl) {
        window.location.href = form.settings.redirectUrl;
        return;
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Form not found
          </h1>
          <p className="text-sm text-gray-500">
            This form may have been deactivated or the link is incorrect.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Thank you!
          </h1>
          <p className="text-sm text-gray-500">
            {form?.thank_you_message ||
              "Your submission has been received. We will be in touch shortly."}
          </p>
        </div>
      </div>
    );
  }

  const formWithCampaign = form as (Form & { campaigns?: { name?: string; business_units?: { name?: string } } }) | null;
  const campaignName = formWithCampaign?.campaigns?.name || "";
  const businessUnitName = formWithCampaign?.campaigns?.business_units?.name || "";
  const formSettings = form?.settings ?? {};
  const accentColor = formSettings.primaryColor || "#1A348C";
  const isDark = formSettings.theme === "dark";

  const topLevel = fields.filter((f) => !f.parent_field_key).sort((a, b) => a.display_order - b.display_order);
  const steps = form?.is_multi_step
    ? Array.from(new Set(topLevel.map((f) => f.step_index ?? 0))).sort((a, b) => a - b)
    : [0];
  const isLastStep = stepIndex >= steps.length - 1;
  const currentStepFields = form?.is_multi_step
    ? topLevel.filter((f) => (f.step_index ?? 0) === steps[stepIndex])
    : topLevel;
  const stepLabel = (idx: number) => {
    const first = topLevel.find((f) => (f.step_index ?? 0) === steps[idx]);
    return first?.label || `Step ${idx + 1}`;
  };

  function childrenOf(parentKey: string) {
    return fields.filter((f) => f.parent_field_key === parentKey).sort((a, b) => a.display_order - b.display_order);
  }

  function valueKey(field: FormField, instance: number) {
    return instance > 0 ? `${field.field_key}__${instance}` : field.field_key;
  }

  function fieldsForCurrentStepValid(): string[] {
    const stepLeaves = currentStepFields.flatMap((f) => (CONTAINER_FIELD_TYPES.includes(f.field_type) ? childrenOf(f.field_key) : [f]));
    const missing: string[] = [];
    for (const f of stepLeaves) {
      if (!f.is_required || !isFieldVisible(f)) continue;
      const count = instanceCountFor(f);
      for (let i = 0; i < count; i++) {
        const vKey = valueKey(f, i);
        const empty = f.field_type === FieldType.MultiSelect ? (multiValues[vKey] ?? []).length === 0 : !values[vKey]?.trim();
        if (empty) missing.push(count > 1 ? `${f.label} (#${i + 1})` : f.label);
      }
    }
    return missing;
  }

  function handleNextStep() {
    const missing = fieldsForCurrentStepValid();
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}`);
      return;
    }
    setError(null);
    setStepIndex((s) => Math.min(s + 1, steps.length - 1));
  }

  function renderLeafField(field: FormField, instance: number) {
    if (!isFieldVisible(field)) return null;
    const vKey = valueKey(field, instance);
    const isCalculated = !!field.calculated_formula;
    const resolvedOptions = field.data_source?.type === "reference" && field.data_source.referenceKey
      ? referenceOptions[field.data_source.referenceKey] ?? []
      : (field.options as { items?: string[] } | undefined)?.items ?? [];

    return (
      <div key={vKey}>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {field.label}
          {field.is_required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.description && <p className="text-xs text-gray-400 mb-1.5">{field.description}</p>}
        {field.field_type === FieldType.InfoPanel ? (
          <div className="p-3 rounded-lg text-xs text-gray-600" style={{ background: "#EEF4FD" }}>{field.description || field.label}</div>
        ) : field.field_type === FieldType.HtmlBlock ? (
          <div className="text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: field.settings?.htmlContent ?? "" }} />
        ) : (
          renderField(
            { ...field, settings: { ...field.settings, disabled: field.settings?.disabled || isCalculated, readOnly: field.settings?.readOnly || isCalculated } },
            values[vKey] || "",
            (val) => handleChange(vKey, val),
            multiValues[vKey] ?? [],
            (opt, checked) => handleMultiToggle(vKey, opt, checked),
            (file) => handleFileUpload({ ...field, field_key: vKey }, file),
            uploadingKeys.has(vKey),
            resolvedOptions
          )
        )}
        {field.settings?.helpText && <p className="text-[11px] text-gray-400 mt-1">{field.settings.helpText}</p>}
      </div>
    );
  }

  function renderContainerInstance(container: FormField, instance: number) {
    const children = childrenOf(container.field_key);
    if (container.field_type === FieldType.Columns) {
      const colCount = container.settings?.columnCount ?? 2;
      return (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
          {children.map((child) => (
            <div key={valueKey(child, instance)}>{renderLeafField(child, instance)}</div>
          ))}
        </div>
      );
    }
    if (container.field_type === FieldType.Tabs) {
      const tabLabels = container.settings?.tabs ?? ["Tab 1", "Tab 2"];
      const active = activeTab[container.field_key] ?? 0;
      return (
        <div>
          <div className="flex gap-1 border-b border-gray-200 mb-3">
            {tabLabels.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveTab((prev) => ({ ...prev, [container.field_key]: i }))}
                className="px-3 py-1.5 text-xs font-medium"
                style={{ color: active === i ? "#1A348C" : "#9CA3AF", borderBottom: active === i ? "2px solid #1A348C" : "2px solid transparent" }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-4">
            {children.filter((c) => (c.settings?.tabIndex ?? 0) === active).map((child) => renderLeafField(child, instance))}
          </div>
        </div>
      );
    }
    return <div className="space-y-4">{children.map((child) => renderLeafField(child, instance))}</div>;
  }

  function renderTopLevelField(field: FormField) {
    if (!isFieldVisible(field)) return null;

    if (field.field_type === FieldType.Divider) return <hr key={field.id} className="border-gray-200" />;

    if (!CONTAINER_FIELD_TYPES.includes(field.field_type)) {
      return renderLeafField(field, 0);
    }

    const repeatable = !!field.settings?.repeatable;
    const count = repeatable ? (repeatCounts[field.field_key] ?? 1) : 1;
    const isCollapsible = field.field_key in collapsedSections;
    const isCollapsed = isCollapsible && collapsedSections[field.field_key];

    return (
      <div key={field.id} className="space-y-3">
        {(field.field_type === FieldType.Section || field.field_type === FieldType.Accordion || field.field_type === FieldType.Card) && (
          <div
            className={`pt-2 border-t border-gray-100 first:border-0 first:pt-0 ${isCollapsible ? "cursor-pointer flex items-center justify-between" : ""}`}
            onClick={isCollapsible ? () => setCollapsedSections((prev) => ({ ...prev, [field.field_key]: !prev[field.field_key] })) : undefined}
          >
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{field.label}</p>
              {field.description && <p className="text-xs text-gray-400 mt-0.5">{field.description}</p>}
            </div>
            {isCollapsible && <span className="text-gray-400 text-xs">{isCollapsed ? "Show" : "Hide"}</span>}
          </div>
        )}
        {isCollapsed ? null : Array.from({ length: count }).map((_, instance) => (
          <div key={instance} className={instance > 0 ? "pt-3 border-t border-dashed border-gray-200 relative" : ""}>
            {instance > 0 && (
              <button
                type="button"
                onClick={() => setRepeatCounts((prev) => ({ ...prev, [field.field_key]: Math.max(1, (prev[field.field_key] ?? 1) - 1) }))}
                className="absolute right-0 top-2 text-gray-300 hover:text-red-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {renderContainerInstance(field, instance)}
          </div>
        ))}
        {repeatable && (
          <button
            type="button"
            onClick={() => setRepeatCounts((prev) => ({ ...prev, [field.field_key]: (prev[field.field_key] ?? 1) + 1 }))}
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: "#1A348C" }}
          >
            <Plus className="w-3.5 h-3.5" />
            {field.settings?.repeatableLabel || `Add another ${field.label}`}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" lang={formSettings.language || "en"}>
      {formSettings.customCss && <style dangerouslySetInnerHTML={{ __html: formSettings.customCss }} />}
      {formSettings.customJs && <CustomScript code={formSettings.customJs} />}
      <div className="w-full max-w-lg">
        <div className={`rounded-xl border overflow-hidden shadow-sm ${isDark ? "border-gray-700" : "border-gray-200"}`} style={{ background: isDark ? "#1F2430" : "#fff" }}>
          <div style={{ background: accentColor }} className="px-6 py-5">
            {formSettings.headerImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={formSettings.headerImageUrl} alt="" className="w-full rounded-lg mb-4 object-cover" style={{ maxHeight: 140 }} />
            )}
            {formSettings.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={formSettings.logoUrl} alt="" className="h-8 mb-3 object-contain" />
            )}
            <h1 className="text-lg font-semibold text-white">
              {form?.name}
            </h1>
            {form?.description && (
              <p className="text-sm mt-1" style={{ color: "#8BB9EF" }}>
                {form.description}
              </p>
            )}
            {businessUnitName && (
              <p className="text-xs mt-2" style={{ color: "#528DDE" }}>
                {businessUnitName}
                {campaignName ? ` · ${campaignName}` : ""}
              </p>
            )}
          </div>

          {form?.is_multi_step && steps.length > 1 && (
            <div className="px-6 pt-4">
              <div className={`flex items-center justify-between text-[11px] mb-1.5 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                <span>{stepLabel(stepIndex)}</span>
                <span>Step {stepIndex + 1} of {steps.length}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%`, background: accentColor }} />
              </div>
            </div>
          )}

          {draftAvailable && (
            <div className="mx-6 mt-4 p-3 rounded-lg text-xs flex items-center justify-between" style={{ background: "#FFFBF5", border: "1px solid #FAEEDA" }}>
              <span className="text-amber-800">You have a saved draft for this form.</span>
              <div className="flex gap-2">
                <button type="button" onClick={handleResumeDraft} className="font-medium text-amber-800 underline">Resume</button>
                <button type="button" onClick={handleDiscardDraft} className="text-gray-400">Discard</button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {currentStepFields.map((field) => renderTopLevelField(field))}

            {fields.length > 0 && (
              <div className="flex items-center gap-2 pt-2">
                {formSettings.showCancelButton && (
                  <a
                    href={formSettings.cancelUrl || "#"}
                    className="py-2.5 px-4 rounded-lg font-medium text-sm border border-gray-300 text-gray-700"
                  >
                    {formSettings.cancelButtonText || "Cancel"}
                  </a>
                )}
                {form?.is_multi_step && stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
                    className="py-2.5 px-4 rounded-lg font-medium text-sm border border-gray-300 text-gray-700"
                  >
                    Back
                  </button>
                )}
                {form?.is_multi_step && (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="py-2.5 px-4 rounded-lg font-medium text-sm border border-gray-300 text-gray-700"
                  >
                    {draftSaved ? "Saved ✓" : "Save draft"}
                  </button>
                )}
                {form?.is_multi_step && draftLink && (
                  <div className="text-[11px] text-gray-400">
                    Resume link:{" "}
                    <button
                      type="button"
                      className="text-brand-700 underline"
                      onClick={() => navigator.clipboard?.writeText(draftLink)}
                    >
                      Copy
                    </button>
                  </div>
                )}
                {form?.is_multi_step && !isLastStep ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="flex-1 py-2.5 px-4 rounded-lg font-medium text-white text-sm transition-all"
                    style={{ background: accentColor }}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 px-4 rounded-lg font-medium text-white text-sm transition-all disabled:opacity-60"
                    style={{ background: accentColor }}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </span>
                    ) : (
                      formSettings.submitButtonText || "Submit"
                    )}
                  </button>
                )}
              </div>
            )}

            {fields.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                This form has no fields configured yet.
              </p>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          {formSettings.footerText || "Powered by Mmela"}
        </p>
      </div>
    </div>
  );
}

function renderField(
  field: FormField,
  value: string,
  onChange: (val: string) => void,
  multiValue: string[],
  onMultiToggle: (option: string, checked: boolean) => void,
  onFileUpload: (file: File | null) => void,
  uploading: boolean,
  resolvedOptions?: string[]
) {
  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";
  const disabled = field.settings?.disabled;
  const readOnly = field.settings?.readOnly;

  switch (field.field_type) {
    case FieldType.MultiSelect: {
      const options = resolvedOptions ?? (field.options as { items?: string[] } | undefined)?.items ?? [];
      return (
        <div className="space-y-2">
          {options.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={multiValue.includes(opt)}
                onChange={(e) => onMultiToggle(opt, e.target.checked)}
                className="rounded border-gray-300"
                disabled={disabled}
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    case FieldType.Toggle:
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === "true" ? "" : "true")}
          style={{
            width: 40, height: 22, borderRadius: 11,
            background: value === "true" ? "#1A348C" : "#E5E7EB", position: "relative", transition: "background 0.15s",
          }}
        >
          <div style={{
            position: "absolute", top: 2, left: value === "true" ? 20 : 2, width: 18, height: 18,
            borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.15)", transition: "left 0.15s",
          }} />
        </button>
      );
    case FieldType.Currency:
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R</span>
          <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} pl-7`} placeholder={field.placeholder || ""} required={field.is_required} disabled={disabled} readOnly={readOnly} />
        </div>
      );
    case FieldType.Percentage:
      return (
        <div className="relative">
          <input type="number" value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} pr-7`} placeholder={field.placeholder || ""} required={field.is_required} disabled={disabled} readOnly={readOnly} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
        </div>
      );
    case FieldType.Password:
      return (
        <input type="password" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} placeholder={field.placeholder || ""} required={field.is_required} disabled={disabled} readOnly={readOnly} />
      );
    case FieldType.Time:
      return <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} required={field.is_required} disabled={disabled} />;
    case FieldType.DateTime:
      return <input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} required={field.is_required} disabled={disabled} />;
    case FieldType.File:
    case FieldType.Image:
    case FieldType.Camera:
      return (
        <div>
          <input
            type="file"
            accept={field.field_type === FieldType.File ? undefined : "image/*"}
            capture={field.field_type === FieldType.Camera ? "environment" : undefined}
            onChange={(e) => onFileUpload(e.target.files?.[0] ?? null)}
            className={inputClass}
            disabled={disabled || uploading}
          />
          {uploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
          {!uploading && value && <p className="text-xs text-emerald-600 mt-1">Uploaded ✓</p>}
        </div>
      );
    case FieldType.Signature:
      return <SignaturePad value={value} onChange={onChange} />;
    case FieldType.Textarea:
      return (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={field.placeholder || ""}
          rows={3}
          required={field.is_required}
        />
      );
    case FieldType.Select: {
      const selectOptions = resolvedOptions ?? (field.options as { items?: string[] } | undefined)?.items ?? [];
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          required={field.is_required}
          disabled={disabled}
        >
          <option value="">{field.placeholder || "Select..."}</option>
          {selectOptions.map((opt: string, i: number) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    case FieldType.Radio: {
      const radioOptions = resolvedOptions ?? (field.options as { items?: string[] } | undefined)?.items ?? [];
      return (
        <div className="space-y-2">
          {radioOptions.map((opt: string, i: number) => (
            <label
              key={i}
              className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
            >
              <input
                type="radio"
                name={field.field_key}
                value={opt}
                checked={value === opt}
                onChange={(e) => onChange(e.target.value)}
                className="border-gray-300"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    }
    case FieldType.Checkbox:
      return (
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={value === "true"}
            onChange={(e) => onChange(e.target.checked ? "true" : "")}
            className="rounded border-gray-300"
          />
          {field.placeholder || field.label}
        </label>
      );
    case FieldType.Date:
      return (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          required={field.is_required}
        />
      );
    case FieldType.Email:
      return (
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={field.placeholder || "email@example.com"}
          required={field.is_required}
        />
      );
    case FieldType.Phone:
      return (
        <input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={field.placeholder || "+27..."}
          required={field.is_required}
        />
      );
    case FieldType.Number:
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={field.placeholder || ""}
          required={field.is_required}
        />
      );
    default:
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          placeholder={field.placeholder || ""}
          required={field.is_required}
        />
      );
  }
}

// Runs a form builder's custom JS once on mount. Only reachable via a
// form's own settings, authored by whoever has access to the Form Builder —
// the same trust boundary as any site builder's "custom code" feature.
function CustomScript({ code }: { code: string }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.textContent = code;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, [code]);
  return null;
}

function SignaturePad({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function getCtx() {
    const canvas = canvasRef.current;
    return canvas?.getContext("2d") ?? null;
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1A348C";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={120}
        className="w-full border border-gray-300 rounded-lg touch-none"
        style={{ background: "#FAFBFC" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="flex items-center justify-between mt-1">
        <p className="text-[11px] text-gray-400">Sign above</p>
        {value && (
          <button type="button" onClick={handleClear} className="text-[11px] text-gray-400 hover:text-red-500 flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}
