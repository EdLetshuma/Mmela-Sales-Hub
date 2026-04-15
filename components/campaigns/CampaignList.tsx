"use client";

import React, { useState, useEffect } from "react";
import {
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getBusinessUnits,
} from "@/lib/campaigns-api";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Campaign, BusinessUnit } from "@/types";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Megaphone,
  Calendar,
} from "lucide-react";

export default function CampaignList() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [units, setUnits] = useState<BusinessUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [campaignData, unitData] = await Promise.all([
        getCampaigns(),
        getBusinessUnits(),
      ]);
      setCampaigns(campaignData);
      setUnits(unitData);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = campaigns.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchUnit = !filterUnit || c.business_unit_id === filterUnit;
    return matchSearch && matchUnit;
  });

  const handleToggleActive = async (campaign: Campaign) => {
    try {
      await updateCampaign(campaign.id, { is_active: !campaign.is_active });
      await loadData();
    } catch (err) {
      console.error("Failed to toggle campaign:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign? This will also delete all its forms.")) return;
    try {
      await deleteCampaign(id);
      await loadData();
    } catch (err) {
      console.error("Failed to delete campaign:", err);
    }
  };

  const getUnitName = (unitId: string) => {
    return units.find((u) => u.id === unitId)?.name || "Unknown";
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage campaigns across business units
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          New campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={filterUnit}
          onChange={(e) => setFilterUnit(e.target.value)}
          className="input-field w-auto"
        >
          <option value="">All business units</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Campaign grid */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
              <div className="h-8 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Megaphone className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No campaigns yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            Create your first campaign to start capturing leads
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary text-sm"
          >
            <Plus className="w-4 h-4" />
            Create campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign) => (
            <div key={campaign.id} className="card group relative">
              {/* Menu button */}
              <div className="absolute top-3 right-3">
                <button
                  onClick={() =>
                    setActiveMenu(activeMenu === campaign.id ? null : campaign.id)
                  }
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {activeMenu === campaign.id && (
                  <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg border border-gray-200 shadow-lg py-1 z-20">
                    <button
                      onClick={() => {
                        setEditingCampaign(campaign);
                        setShowCreateModal(true);
                        setActiveMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        handleToggleActive(campaign);
                        setActiveMenu(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {campaign.is_active ? (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <ToggleRight className="w-3.5 h-3.5" />
                          Activate
                        </>
                      )}
                    </button>
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => {
                          handleDelete(campaign.id);
                          setActiveMenu(null);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Campaign info */}
              <div className="flex items-start gap-3 mb-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    campaign.is_active
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 truncate pr-8">
                    {campaign.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {getUnitName(campaign.business_unit_id)}
                  </p>
                </div>
              </div>

              {campaign.description && (
                <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                  {campaign.description}
                </p>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {new Date(campaign.created_at).toLocaleDateString("en-ZA")}
                </div>
                <span
                  className={`badge ${
                    campaign.is_active ? "badge-contacted" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {campaign.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CampaignModal
          campaign={editingCampaign}
          units={units}
          userId={user?.id}
          onClose={() => {
            setShowCreateModal(false);
            setEditingCampaign(null);
          }}
          onSaved={loadData}
        />
      )}
    </div>
  );
}

// ============================================================
// Campaign Create/Edit Modal
// ============================================================

function CampaignModal({
  campaign,
  units,
  userId,
  onClose,
  onSaved,
}: {
  campaign: Campaign | null;
  units: BusinessUnit[];
  userId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEditing = !!campaign;
  const [name, setName] = useState(campaign?.name || "");
  const [description, setDescription] = useState(campaign?.description || "");
  const [unitId, setUnitId] = useState(campaign?.business_unit_id || units[0]?.id || "");
  const [startsAt, setStartsAt] = useState(campaign?.starts_at?.slice(0, 10) || "");
  const [endsAt, setEndsAt] = useState(campaign?.ends_at?.slice(0, 10) || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !unitId) return;

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        business_unit_id: unitId,
        starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
        ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
        is_active: true,
        created_by_user_id: userId,
      };

      if (isEditing) {
        await updateCampaign(campaign.id, payload);
      } else {
        await createCampaign(payload as any);
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save campaign");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {isEditing ? "Edit campaign" : "New campaign"}
        </h2>
        <p className="text-sm text-gray-500 mb-5">
          {isEditing
            ? "Update campaign details"
            : "Create a new campaign to start capturing leads"}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Campaign name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder="e.g. Winter Drive 2026"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Business unit
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="input-field"
              required
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
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
              rows={3}
              placeholder="What's this campaign about?"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                End date
              </label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="btn btn-primary flex-1 disabled:opacity-50"
            >
              {isSaving
                ? "Saving..."
                : isEditing
                ? "Update campaign"
                : "Create campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
