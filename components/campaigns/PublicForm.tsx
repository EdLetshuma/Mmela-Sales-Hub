"use client";

import React, { useState, useEffect } from "react";
import { getFormBySlug, getFormFields, submitPublicLead } from "@/lib/campaigns-api";
import type { Form, FormField } from "@/types";
import { FieldType } from "@/types";
import { CheckCircle, Loader2 } from "lucide-react";

interface PublicFormProps {
  slug: string;
}

export default function PublicForm({ slug }: PublicFormProps) {
  const [form, setForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

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
    } catch (err) {
      console.error("Failed to load form:", err);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const missing = fields
      .filter((f) => f.is_required && !values[f.field_key]?.trim())
      .map((f) => f.label);

    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(", ")}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const nameField = fields.find(
        (f) => f.field_type === FieldType.Text && f.field_key.includes("name")
      );
      const emailField = fields.find((f) => f.field_type === FieldType.Email);
      const phoneField = fields.find((f) => f.field_type === FieldType.Phone);

      const params = new URLSearchParams(window.location.search);

      const campaignData = (form as any).campaigns;
      const businessUnitId = campaignData?.business_unit_id || "";

      await submitPublicLead({
        name: nameField ? values[nameField.field_key] || "Unknown" : "Unknown",
        email: emailField ? values[emailField.field_key] || "" : "",
        phone: phoneField ? values[phoneField.field_key] : undefined,
        form_id: form.id,
        campaign_id: form.campaign_id,
        business_unit_id: businessUnitId,
        source_type: "form",
        captured_data: values,
        utm_source: params.get("utm_source") || undefined,
        utm_medium: params.get("utm_medium") || undefined,
        utm_campaign: params.get("utm_campaign") || undefined,
      });

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

  const campaignName =
    (form as any)?.campaigns?.name || "";
  const businessUnitName =
    (form as any)?.campaigns?.business_units?.name || "";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div style={{ background: "#1A348C" }} className="px-6 py-5">
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

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {fields.map((field) => (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  {field.label}
                  {field.is_required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
                {renderField(field, values[field.field_key] || "", (val) =>
                  handleChange(field.field_key, val)
                )}
              </div>
            ))}

            {fields.length > 0 && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg font-medium text-white text-sm transition-all disabled:opacity-60"
                style={{ background: "#1A348C" }}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  "Submit"
                )}
              </button>
            )}

            {fields.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                This form has no fields configured yet.
              </p>
            )}
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by Mmela
        </p>
      </div>
    </div>
  );
}

function renderField(
  field: FormField,
  value: string,
  onChange: (val: string) => void
) {
  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  switch (field.field_type) {
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
    case FieldType.Select:
      const selectOptions = (field.options as any)?.items || [];
      return (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          required={field.is_required}
        >
          <option value="">{field.placeholder || "Select..."}</option>
          {selectOptions.map((opt: string, i: number) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case FieldType.Radio:
      const radioOptions = (field.options as any)?.items || [];
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
