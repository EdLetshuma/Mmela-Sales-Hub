"use client";

import React from "react";
import { X } from "lucide-react";
import type { SavedQuote } from "@/components/sales/QuoteModal";

interface AcceptQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onEditClient: () => void;
  onEditQuote: () => void;
  leadName: string;
  leadPhone?: string;
  leadEmail?: string;
  leadIdNumber?: string;
  quote: SavedQuote;
}

export default function AcceptQuoteModal({
  isOpen,
  onClose,
  onConfirm,
  onEditClient,
  onEditQuote,
  leadName,
  leadPhone,
  leadEmail,
  leadIdNumber,
  quote,
}: AcceptQuoteModalProps) {
  if (!isOpen) return null;

  const totalPremium =
    (quote.basePremium || 0) +
    quote.vaps.reduce((s, v) => s + (v.premium || 0), 0);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 500 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Confirm acceptance details
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Please verify client and quote information before proceeding.
            </p>
          </div>
          <button className="btn btn-ghost p-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {/* Client section */}
          <div>
            <div className="flex items-center justify-between mb-2 pb-1" style={{ borderBottom: "1px solid #E5E7EB" }}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Client information
              </p>
              <button
                className="text-xs text-brand-700 font-medium hover:underline"
                onClick={onEditClient}
              >
                Edit
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-gray-400">Name</span>
              <span className="text-gray-900 font-medium">{leadName}</span>
              <span className="text-gray-400">ID number</span>
              <span className="text-gray-900 font-mono">
                {leadIdNumber || quote.clientIdNumber || (
                  <span className="text-amber-600 text-xs">Not captured</span>
                )}
              </span>
              <span className="text-gray-400">Phone</span>
              <span className="text-gray-900">{leadPhone || "—"}</span>
              <span className="text-gray-400">Email</span>
              <span className="text-gray-900 text-xs break-all">
                {leadEmail?.includes("@placeholder.com") ? "—" : (leadEmail || "—")}
              </span>
            </div>
          </div>

          {/* Quote section */}
          <div>
            <div className="flex items-center justify-between mb-2 pb-1" style={{ borderBottom: "1px solid #E5E7EB" }}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Quote information
              </p>
              <button
                className="text-xs text-brand-700 font-medium hover:underline"
                onClick={onEditQuote}
              >
                Edit
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <span className="text-gray-400">Reference</span>
              <span className="text-gray-900 font-mono bg-gray-50 px-1.5 py-0.5 rounded text-xs w-fit">
                {quote.quoteNumber || "—"}
              </span>
              <span className="text-gray-400">Underwriter</span>
              <span className="text-gray-900">{quote.underwriter}</span>
              <span className="text-gray-400">Product</span>
              <span className="text-gray-900">
                {quote.productCategory} — {quote.productName}
              </span>
              <span className="text-gray-400">Total premium</span>
              <span className="text-lg font-semibold text-brand-900">
                R{" "}
                {totalPremium.toLocaleString("en-ZA", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            {quote.vaps.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F1F3F5" }}>
                <p className="text-xs text-gray-400 mb-1.5">VAPs included</p>
                <div className="space-y-1">
                  {quote.vaps.map((v) => (
                    <div key={v.id} className="flex justify-between text-xs text-gray-600">
                      <span>
                        {v.name}
                        {v.underwriter && (
                          <span className="text-gray-400 ml-1">({v.underwriter})</span>
                        )}
                      </span>
                      <span>
                        + R{" "}
                        {v.premium.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end gap-2 mt-5 pt-4"
          style={{ borderTop: "1px solid #E5E7EB" }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            style={{ background: "#0F6E56" }}
            onClick={onConfirm}
          >
            Confirm & accept
          </button>
        </div>
      </div>
    </div>
  );
}
