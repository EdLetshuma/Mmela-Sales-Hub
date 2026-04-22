"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, X, Edit2 } from "lucide-react";
import {
  getUnderwriters, getProductCatalog, createUnderwriter, updateUnderwriter, deleteUnderwriter,
  createProduct, deleteProduct, createProductCategory,
  type Underwriter, type ProductCategory, type Product,
} from "@/lib/catalog-api";

export default function SalesSettings() {
  const [underwriters, setUnderwriters] = useState<Underwriter[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"underwriters" | "products">("underwriters");

  // Underwriter form
  const [newUW, setNewUW] = useState("");
  const [addingUW, setAddingUW] = useState(false);

  // Product form
  const [newProductName, setNewProductName] = useState<Record<string, string>>({});
  const [newCategoryName, setNewCategoryName] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [uw, catalog] = await Promise.all([
      getUnderwriters(false),
      getProductCatalog(),
    ]);
    setUnderwriters(uw);
    setCategories(catalog.categories);
    setProducts(catalog.products);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleAddUnderwriter() {
    if (!newUW.trim()) return;
    setAddingUW(true);
    try {
      await createUnderwriter(newUW.trim());
      setNewUW("");
      await fetchAll();
    } finally {
      setAddingUW(false);
    }
  }

  async function handleToggleUnderwriter(uw: Underwriter) {
    await updateUnderwriter(uw.id, { active: !uw.active });
    await fetchAll();
  }

  async function handleDeleteUnderwriter(uw: Underwriter) {
    if (!window.confirm(`Remove ${uw.name}?`)) return;
    await deleteUnderwriter(uw.id);
    await fetchAll();
  }

  async function handleAddProduct(categoryId: string, categoryName: string) {
    const name = (newProductName[categoryId] ?? "").trim();
    if (!name) return;
    await createProduct(name, categoryId);
    setNewProductName(p => ({ ...p, [categoryId]: "" }));
    await fetchAll();
  }

  async function handleDeleteProduct(product: Product) {
    await deleteProduct(product.id);
    await fetchAll();
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    await createProductCategory(newCategoryName.trim());
    setNewCategoryName("");
    await fetchAll();
  }

  if (loading) return <div className="card h-40 animate-pulse bg-gray-50" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Sales settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage underwriters and product catalog</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: "1px solid #E5E7EB" }}>
        {(["underwriters", "products"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize relative transition-colors ${tab === t ? "text-brand-900" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "underwriters" ? `Underwriters (${underwriters.filter(u => u.active).length})` : `Products (${products.length})`}
            {tab === t && <span style={{ position:"absolute",bottom:0,left:16,right:16,height:2,background:"#1A348C",borderRadius:2 }} />}
          </button>
        ))}
      </div>

      {/* Underwriters tab */}
      {tab === "underwriters" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Add underwriter</h2>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                value={newUW}
                onChange={e => setNewUW(e.target.value)}
                placeholder="Underwriter name…"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddUnderwriter(); } }}
              />
              <button className="btn btn-primary" disabled={addingUW || !newUW.trim()} onClick={handleAddUnderwriter}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </button>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Underwriter", "Status", "Added", ""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {underwriters.map(uw => (
                  <tr key={uw.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{uw.name}</td>
                    <td className="px-4 py-3">
                      <span className="badge" style={uw.active ? { background:"#EAF3DE",color:"#27500A" } : { background:"#F1F3F5",color:"#6B7280" }}>
                        {uw.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {uw.created_at ? new Date(uw.created_at).toLocaleDateString("en-ZA") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button
                          className="text-xs font-medium"
                          style={{ color: uw.active ? "#854F0B" : "#0F6E56" }}
                          onClick={() => handleToggleUnderwriter(uw)}
                        >
                          {uw.active ? "Deactivate" : "Activate"}
                        </button>
                        {!uw.active && (
                          <button className="btn btn-ghost p-1 text-red-400 hover:text-red-600" onClick={() => handleDeleteUnderwriter(uw)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Products tab */}
      {tab === "products" && (
        <div className="space-y-4">
          {/* Add category */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Add product category</h2>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Category name…"
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
              />
              <button className="btn btn-primary" disabled={!newCategoryName.trim()} onClick={handleAddCategory}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </button>
            </div>
          </div>

          {/* Category + product list */}
          {categories.map(cat => {
            const catProducts = products.filter(p => p.category_id === cat.id);
            return (
              <div key={cat.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-gray-900">{cat.name}</h2>
                  <span className="text-xs text-gray-400">{catProducts.length} products</span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {catProducts.map(p => (
                    <span key={p.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs" style={{ background:"#EEF4FD",color:"#1A348C" }}>
                      {p.name}
                      <button onClick={() => handleDeleteProduct(p)} className="hover:opacity-60 ml-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {catProducts.length === 0 && (
                    <p className="text-xs text-gray-400">No products yet</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    className="input-field flex-1 text-xs"
                    placeholder={`Add product to ${cat.name}…`}
                    value={newProductName[cat.id] ?? ""}
                    onChange={e => setNewProductName(p => ({ ...p, [cat.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddProduct(cat.id, cat.name); } }}
                  />
                  <button
                    className="btn btn-secondary text-xs"
                    disabled={!(newProductName[cat.id] ?? "").trim()}
                    onClick={() => handleAddProduct(cat.id, cat.name)}
                  >
                    Add
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
