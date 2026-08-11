"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  getUnderwriters, getProductCatalog, createUnderwriter, updateUnderwriter, deleteUnderwriter,
  createProduct, deleteProduct, createProductCategory,
  type Underwriter, type ProductCategory, type Product,
} from "@/lib/catalog-api";

type Tab = "underwriters" | "products";

export default function CatalogSettings() {
  const [underwriters, setUnderwriters] = useState<Underwriter[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("underwriters");

  const [newUW, setNewUW] = useState("");
  const [addingUW, setAddingUW] = useState(false);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
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

  async function handleAddProduct() {
    if (!newProductName.trim() || !newProductCategory) return;
    await createProduct(newProductName.trim(), newProductCategory);
    setNewProductName("");
    setShowAddProduct(false);
    await fetchAll();
  }

  async function handleDeleteProduct(product: Product) {
    if (!window.confirm(`Remove ${product.name}?`)) return;
    await deleteProduct(product.id);
    await fetchAll();
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    await createProductCategory(newCategoryName.trim());
    setNewCategoryName("");
    setShowAddCategory(false);
    await fetchAll();
  }

  if (loading) return <div className="card h-40 animate-pulse bg-gray-50" />;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">Catalog</p>
        <p className="text-xs text-gray-400 mt-0.5">Underwriters and product catalog used across quotes and policies</p>
      </div>

      <div className="flex gap-1" style={{ borderBottom: "1px solid #E5E7EB" }}>
        {(["underwriters", "products"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize relative transition-colors ${tab === t ? "text-brand-900" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t === "underwriters" ? `Underwriters (${underwriters.filter((u) => u.active).length})` : `Products (${products.length})`}
            {tab === t && <span style={{ position: "absolute", bottom: 0, left: 16, right: 16, height: 2, background: "#1A348C", borderRadius: 2 }} />}
          </button>
        ))}
      </div>

      {tab === "underwriters" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              value={newUW}
              onChange={(e) => setNewUW(e.target.value)}
              placeholder="Add underwriter…"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddUnderwriter(); } }}
            />
            <button className="btn btn-primary" disabled={addingUW || !newUW.trim()} onClick={handleAddUnderwriter}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </button>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Underwriter", "Status", "Added", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {underwriters.map((uw) => (
                  <tr key={uw.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{uw.name}</td>
                    <td className="px-4 py-3">
                      <span className="badge" style={uw.active ? { background: "#EAF3DE", color: "#27500A" } : { background: "#F1F3F5", color: "#6B7280" }}>
                        {uw.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {uw.created_at ? new Date(uw.created_at).toLocaleDateString("en-ZA") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
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

      {tab === "products" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button className="btn btn-secondary text-xs" onClick={() => setShowAddCategory((s) => !s)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add category
            </button>
            <button className="btn btn-primary text-xs" disabled={categories.length === 0} onClick={() => setShowAddProduct((s) => !s)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add product
            </button>
          </div>

          {showAddCategory && (
            <div className="card flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Category name</label>
                <input
                  className="input-field"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g. Life Cover"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                />
              </div>
              <button className="btn btn-primary text-xs" disabled={!newCategoryName.trim()} onClick={handleAddCategory}>Save</button>
              <button className="btn btn-ghost p-2" onClick={() => setShowAddCategory(false)}><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          {showAddProduct && (
            <div className="card flex gap-2 items-end">
              <div style={{ width: 200 }}>
                <label className="text-xs text-gray-500 mb-1 block">Category</label>
                <select className="input-field" value={newProductCategory} onChange={(e) => setNewProductCategory(e.target.value)}>
                  <option value="">Select category…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Product name</label>
                <input
                  className="input-field"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="e.g. Comprehensive Motor"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddProduct(); } }}
                />
              </div>
              <button className="btn btn-primary text-xs" disabled={!newProductName.trim() || !newProductCategory} onClick={handleAddProduct}>Save</button>
              <button className="btn btn-ghost p-2" onClick={() => setShowAddProduct(false)}><X className="w-3.5 h-3.5" /></button>
            </div>
          )}

          {categories.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm text-gray-400">No categories yet — add one to start building the catalog.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((cat) => {
                const catProducts = products.filter((p) => p.category_id === cat.id);
                return (
                  <div key={cat.id} className="card p-0 overflow-hidden">
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: "#F8F9FB", borderBottom: "1px solid #E5E7EB" }}>
                      <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                      <span className="text-xs text-gray-400">{catProducts.length} product{catProducts.length !== 1 ? "s" : ""}</span>
                    </div>
                    {catProducts.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-400">No products in this category yet.</p>
                    ) : (
                      <table className="w-full text-sm border-collapse">
                        <tbody className="divide-y divide-gray-100">
                          {catProducts.map((p) => (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 text-gray-900">{p.name}</td>
                              <td className="px-4 py-2.5 w-10">
                                <div className="flex justify-end">
                                  <button className="btn btn-ghost p-1 text-red-400 hover:text-red-600" onClick={() => handleDeleteProduct(p)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
