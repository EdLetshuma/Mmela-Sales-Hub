"use client";

import React, { useState } from "react";
import { X, Copy, Check, Code2, Globe, Smartphone } from "lucide-react";

interface EmbedSnippetModalProps {
  formName: string;
  formSlug: string;
  onClose: () => void;
}

type EmbedType = "iframe" | "link" | "popup";

export default function EmbedSnippetModal({
  formName,
  formSlug,
  onClose,
}: EmbedSnippetModalProps) {
  const [embedType, setEmbedType] = useState<EmbedType>("iframe");
  const [copied, setCopied] = useState(false);

  // Use window.location.origin at runtime so it works on any domain
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://mmela-sales-hub-edletshumas-projects.vercel.app";

  const formUrl = `${origin}/f/${formSlug}`;

  const snippets: Record<EmbedType, { code: string; label: string; description: string }> = {
    iframe: {
      label: "Inline iframe",
      description: "Embeds the form directly inside your webpage. Best for dedicated landing pages or contact sections.",
      code: `<!-- Mmela Hub Form — ${formName} -->
<iframe
  src="${formUrl}"
  width="100%"
  height="600"
  frameborder="0"
  style="border:none;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);"
  title="${formName}"
  loading="lazy"
></iframe>`,
    },
    link: {
      label: "Button / link",
      description: "A styled button that opens the form in a new tab. Drop it anywhere in your HTML.",
      code: `<!-- Mmela Hub Form Button — ${formName} -->
<a
  href="${formUrl}"
  target="_blank"
  rel="noopener noreferrer"
  style="
    display:inline-block;
    background:#1A348C;
    color:#ffffff;
    font-family:Arial,sans-serif;
    font-size:15px;
    font-weight:600;
    padding:12px 28px;
    border-radius:8px;
    text-decoration:none;
    letter-spacing:0.2px;
  "
>
  Submit your details
</a>`,
    },
    popup: {
      label: "Pop-up on button click",
      description: "Opens the form in a modal overlay when a button is clicked. No page navigation required.",
      code: `<!-- Mmela Hub Popup Form — ${formName} -->
<button
  id="mmela-form-btn"
  onclick="document.getElementById('mmela-modal').style.display='flex'"
  style="
    background:#1A348C;color:#fff;border:none;cursor:pointer;
    font-family:Arial,sans-serif;font-size:15px;font-weight:600;
    padding:12px 28px;border-radius:8px;
  "
>
  Submit your details
</button>

<div
  id="mmela-modal"
  style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);
         z-index:9999;align-items:center;justify-content:center;padding:16px;"
  onclick="if(event.target===this)this.style.display='none'"
>
  <div style="background:#fff;border-radius:16px;width:100%;max-width:540px;
              max-height:90vh;overflow:hidden;position:relative;">
    <button
      onclick="document.getElementById('mmela-modal').style.display='none'"
      style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,0.1);
             border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;
             font-size:16px;line-height:28px;text-align:center;"
    >×</button>
    <iframe
      src="${formUrl}"
      width="100%"
      height="560"
      frameborder="0"
      style="border:none;border-radius:16px;"
      title="${formName}"
    ></iframe>
  </div>
</div>`,
    },
  };

  const current = snippets[embedType];

  async function handleCopy() {
    await navigator.clipboard.writeText(current.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 60, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Embed form</h2>
            <p className="text-xs text-gray-400 mt-0.5">{formName}</p>
          </div>
          <button className="btn btn-ghost p-1" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form URL */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg mb-4"
          style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}
        >
          <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-600 font-mono truncate flex-1">{formUrl}</span>
          <button
            className="text-xs font-medium text-brand-700 hover:text-brand-900 flex-shrink-0"
            onClick={() => window.open(formUrl, "_blank")}
          >
            Open ↗
          </button>
        </div>

        {/* Embed type selector */}
        <div className="flex gap-2 mb-4">
          {(["iframe", "link", "popup"] as EmbedType[]).map((t) => (
            <button
              key={t}
              onClick={() => setEmbedType(t)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                embedType === t
                  ? "bg-brand-50 border-brand-200 text-brand-900"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t === "iframe" && <Code2 className="w-3.5 h-3.5" />}
              {t === "link"   && <Globe className="w-3.5 h-3.5" />}
              {t === "popup"  && <Smartphone className="w-3.5 h-3.5" />}
              {snippets[t].label}
            </button>
          ))}
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 mb-3">{current.description}</p>

        {/* Code block */}
        <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
          <pre
            style={{
              background: "#0F1B4A",
              color: "#E2E8F7",
              borderRadius: 10,
              padding: "16px",
              fontSize: 12,
              lineHeight: 1.7,
              overflowY: "auto",
              overflowX: "auto",
              maxHeight: 320,
              fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
              whiteSpace: "pre",
              margin: 0,
            }}
          >
            {current.code}
          </pre>
          <button
            onClick={handleCopy}
            style={{
              position: "absolute", top: 10, right: 10,
              background: copied ? "#0F6E56" : "rgba(255,255,255,0.12)",
              border: "none", borderRadius: 6, cursor: "pointer",
              padding: "5px 10px", display: "flex", alignItems: "center", gap: 5,
              color: "#fff", fontSize: 11, fontWeight: 600, transition: "background 0.2s",
            }}
          >
            {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* Instructions */}
        <div
          className="mt-4 p-3 rounded-lg text-xs text-gray-600 space-y-1"
          style={{ background: "#F8F9FB", border: "1px solid #E5E7EB" }}
        >
          <p className="font-semibold text-gray-700">How to use</p>
          {embedType === "iframe" && (
            <p>Paste this code into the HTML of any webpage where you want the form to appear. Works with WordPress, Wix, Webflow, or plain HTML.</p>
          )}
          {embedType === "link" && (
            <p>Drop this HTML snippet anywhere in your page. The button opens the form in a new browser tab so visitors don't leave your site.</p>
          )}
          {embedType === "popup" && (
            <p>Paste both the button and the modal div into your page HTML. Clicking the button opens the form as an overlay without any page navigation.</p>
          )}
          <p className="text-gray-400 mt-1">All submissions are captured directly in Mmela Hub under Campaigns → Leads.</p>
        </div>
      </div>
    </div>
  );
}
