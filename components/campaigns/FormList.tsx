"use client";

import React, { useState, useEffect } from "react";
import {
  getForms,
  getCampaigns,
  createForm,
  updateForm,
  getBusinessUnits,
} from "@/lib/campaigns-api";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Form, Campaign, BusinessUnit } from "@/types";
import {
  Plus,
  Search,
  FileText,
  ExternalLink,
  QrCode,
  Copy,
  Check,
  ToggleLeft,
  ToggleRight,
  Pencil,
  MoreHorizontal,
  X,
  Code2,
} from "lucide-react";
import EmbedSnippetModal from "@/components/campaigns/EmbedSnippetModal";

interface FormListProps {
  onEditForm: (formId: string) => void;
}

export default function FormList({ onEditForm }: FormListProps) {
  const { user } = useAuth();
  const [forms, setForms] = useState<(Form & { campaigns?: { name: string; business_unit_id: string } })[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [embedForm, setEmbedForm] = useState<{ slug: string; name: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [formData, campaignData, unitData] = await Promise.all([
        getForms(),
        getCampaigns(),
        getBusinessUnits(),
      ]);
      setForms(formData as any);
      setCampaigns(campaignData);
      setUnits(unitData);
    } catch (err) {
      console.error("Failed to load forms:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = forms.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const getFormUrl = (slug: string) => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/f/${slug}`;
  };

  const handleCopyLink = async (slug: string) => {
    await navigator.clipboard.writeText(getFormUrl(slug));
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const handleToggleActive = async (form: Form) => {
    try {
      await updateForm(form.id, { is_active: !form.is_active });
      await loadData();
    } catch (err) {
      console.error("Failed to toggle form:", err);
    }
  };

  const getUnitName = (unitId: string) =>
    units.find((u) => u.id === unitId)?.name || "";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Forms</h1>
          <p className="text-sm text-gray-500 mt-1">
            Build forms, generate QR codes, and capture leads
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          New form
        </button>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search forms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-48 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <FileText className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No forms yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            Create a form and attach it to a campaign
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary text-sm"
          >
            <Plus className="w-4 h-4" />
            Create form
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((form) => {
            const campaignName = (form as any).campaigns?.name || "—";
            const unitId = (form as any).campaigns?.business_unit_id;
            const unitName = unitId ? getUnitName(unitId) : "";

            return (
              <div
                key={form.id}
                className="card flex items-center gap-4 group"
                style={{ position: "relative", overflow: "visible" }}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    form.is_active
                      ? "bg-brand-50 text-brand-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <FileText className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {form.name}
                    </h3>
                    <span
                      className={`badge ${
                        form.is_active
                          ? "badge-contacted"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {form.is_active ? "Live" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {campaignName}
                    {unitName ? ` · ${unitName}` : ""}
                    {" · "}
                    <span className="text-gray-500 font-mono text-[11px]">
                      /f/{form.slug}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleCopyLink(form.slug)}
                    className="btn btn-secondary text-xs gap-1.5"
                    title="Copy link"
                  >
                    {copiedSlug === form.slug ? (
                      <><Check className="w-3.5 h-3.5 text-green-600" /> Copied</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> Copy link</>
                    )}
                  </button>
                  <button
                    onClick={() => setShowQr(showQr === form.id ? null : form.id)}
                    className="btn btn-secondary text-xs gap-1.5"
                    title="Show QR code"
                  >
                    <QrCode className="w-3.5 h-3.5" /> QR code
                  </button>
                  <button
                    onClick={() => setEmbedForm({ slug: form.slug, name: form.name })}
                    className="btn btn-secondary text-xs gap-1.5"
                    title="Get embed code"
                  >
                    <Code2 className="w-3.5 h-3.5" /> Embed
                  </button>
                  <button
                    onClick={() => window.open(getFormUrl(form.slug), "_blank")}
                    className="btn btn-secondary text-xs gap-1.5"
                    title="Preview form"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button
                    onClick={() => onEditForm(form.id)}
                    className="btn btn-secondary text-xs gap-1.5"
                    title="Edit fields"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(form)}
                    className={`btn text-xs gap-1.5 ${form.is_active ? "btn-secondary" : "btn-primary"}`}
                    title={form.is_active ? "Deactivate" : "Activate"}
                  >
                    {form.is_active ? (
                      <><ToggleRight className="w-4 h-4 text-green-600" /> Live</>
                    ) : (
                      <><ToggleLeft className="w-4 h-4" /> Inactive</>
                    )}
                  </button>
                </div>

                {/* QR Code popup - outside flex row so it can overflow */}
                {showQr === form.id && (
                  <div
                    style={{
                      position: "absolute", right: 16, top: "100%", marginTop: 8,
                      background: "#fff", borderRadius: 12,
                      border: "1px solid #E5E7EB", boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                      padding: 16, zIndex: 50, minWidth: 232,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-gray-700">QR Code</p>
                      <button
                        className="btn btn-ghost p-1"
                        onClick={() => setShowQr(null)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-center">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getFormUrl(form.slug))}`}
                        alt="QR Code"
                        width={200}
                        height={200}
                        style={{ borderRadius: 8, border: "1px solid #E5E7EB" }}
                      />
                      <p className="text-xs text-gray-400 mt-2 font-mono">/f/{form.slug}</p>
                      <a
                        href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&format=png&data=${encodeURIComponent(getFormUrl(form.slug))}`}
                        download={`qr-${form.slug}.png`}
                        className="btn btn-secondary text-xs mt-2 w-full"
                      >
                        Download PNG
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateFormModal
          campaigns={campaigns}
          userId={user?.id}
          onClose={() => setShowCreateModal(false)}
          onSaved={(formId) => {
            loadData();
            setShowCreateModal(false);
            onEditForm(formId);
          }}
        />
      )}

      {embedForm && (
        <EmbedSnippetModal
          formName={embedForm.name}
          formSlug={embedForm.slug}
          onClose={() => setEmbedForm(null)}
        />
      )}
    </div>
  );
}

function CreateFormModal({
  campaigns,
  userId,
  onClose,
  onSaved,
}: {
  campaigns: Campaign[];
  userId?: string;
  onClose: () => void;
  onSaved: (formId: string) => void;
}) {
  const [name, setName] = useState("");
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id || "");
  const [description, setDescription] = useState("");
  const [thankYou, setThankYou] = useState(
    "Thank you for your submission. We will be in touch shortly."
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSlug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);

  const slug = generateSlug(name);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !campaignId || !slug) return;

    setIsSaving(true);
    setError(null);

    try {
      const form = await createForm({
        name: name.trim(),
        campaign_id: campaignId,
        slug,
        description: description.trim() || undefined,
        thank_you_message: thankYou,
        is_active: true,
        created_by_user_id: userId,
      } as any);

      onSaved(form.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create form");
    } finally {
      setIsSaving(false);
    }
  };

  const activeCampaigns = campaigns.filter((c) => c.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-1">New form</h2>
        <p className="text-sm text-gray-500 mb-5">
          Create a form then add fields in the builder
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {activeCampaigns.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 mb-2">
              You need at least one active campaign first
            </p>
            <button onClick={onClose} className="btn btn-secondary text-sm">
              Go create a campaign
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Form name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="e.g. Winter Drive Sign Up"
                required
              />
              {slug && (
                <p className="text-xs text-gray-400 mt-1">
                  Public URL: /f/<span className="font-mono">{slug}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Campaign
              </label>
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="input-field"
                required
              >
                {activeCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                rows={2}
                placeholder="Shown at the top of the form"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Thank you message
              </label>
              <textarea
                value={thankYou}
                onChange={(e) => setThankYou(e.target.value)}
                className="input-field"
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !name.trim() || !campaignId}
                className="btn btn-primary flex-1 disabled:opacity-50"
              >
                {isSaving ? "Creating..." : "Create & add fields"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
