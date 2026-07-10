"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search, Plus, Pill, X, ChevronRight,
  Package, Edit2, Trash2, ArrowLeft, Upload, Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  slug: string;
  _count?: { products: number };
}

interface Product {
  id: string;
  name: string;
  genericName: string | null;
  sku: string | null;
  manufacturer: string | null;
  strength: string | null;
  dosageForm: string | null;
  scheduleType: string | null;
  mrp: number | null;
  isPrescription: boolean;
  rackNo: string | null;
  unit: string;
  category: { id: string; name: string; color: string; icon: string } | null;
  inventory: { quantity: number } | null;
  batches: { id: string; batchNo: string; expiryDate: string; quantity: number }[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const scheduleColors: Record<string, string> = {
  OTC: "bg-green-100 text-green-700",
  Schedule_H: "bg-blue-100 text-blue-700",
  Schedule_H1: "bg-orange-100 text-orange-700",
  Schedule_X: "bg-red-100 text-red-700",
  Narcotic: "bg-purple-100 text-purple-700",
};

export function ProductList() {
  const session = useAuthStore((s) => s.session);
  const { setActiveView, setEditingProductId, setActiveProductId } = useNavStore();
  const businessId = session?.business?.id;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedCategory) params.set("category", selectedCategory);
      params.set("page", page.toString());
      params.set("limit", "20");

      const res = await fetch(`/api/businesses/${businessId}/products?${params}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products);
        setTotalPages(data.pagination?.totalPages ?? 1);
      }
    } catch (err) {
      console.error("Fetch products error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId, search, selectedCategory, page]);

  const fetchCategories = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await fetch(`/api/businesses/${businessId}/categories`);
      const data = await res.json();
      if (data.success) {
        setCategories(data.allCategories || []);
      }
    } catch (err) {
      console.error("Fetch categories error:", err);
    }
  }, [businessId]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleDelete = async (productId: string) => {
    if (!businessId) return;
    if (!confirm("Are you sure you want to delete this product?")) return;
    setDeleting(productId);
    try {
      const res = await fetch(`/api/businesses/${businessId}/products/${productId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
      }
    } catch (err) {
      console.error("Delete error:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handleView = (productId: string) => {
    setActiveProductId(productId);
    setActiveView("product-detail");
  };

  const handleEdit = (productId: string) => {
    setEditingProductId(productId);
    setActiveView("edit-product");
  };

  const stockLevel = (qty: number, min: number) => {
    if (qty <= 0) return "out";
    if (qty <= min) return "low";
    return "ok";
  };

  const iconGradient = (color?: string | null) => ({
    background: color
      ? `linear-gradient(135deg, ${color}, rgba(0,0,0,0.20))`
      : "linear-gradient(135deg, #94a3b8, #475569)",
  });

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg">
      {/* Header */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          onClick={() => setActiveView("dashboard")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight flex-1">Products</h1>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shadow-pharmacy bg-white"
          onClick={() => setActiveView("import")}
        >
          <Upload className="h-4 w-4" /> Import
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-pharmacy border-0"
          onClick={() => setActiveView("add-product")}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
        <Input
          placeholder="Search by name, generic, manufacturer..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-10 pr-10 h-12 rounded-2xl shadow-pharmacy border-0 bg-white focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500"
        />
        {(search || selectedCategory) && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
            onClick={() => { setSearch(""); setSelectedCategory(null); setPage(1); }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        <button
          className={cn(
            "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0",
            !selectedCategory
              ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-pharmacy"
              : "bg-white text-gray-600 shadow-pharmacy hover:shadow-pharmacy-lg"
          )}
          onClick={() => { setSelectedCategory(null); setPage(1); }}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shrink-0",
              selectedCategory === cat.id
                ? "text-white shadow-pharmacy"
                : "bg-white text-gray-600 shadow-pharmacy hover:shadow-pharmacy-lg"
            )}
            style={selectedCategory === cat.id ? { backgroundColor: cat.color } : undefined}
            onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400 px-1">
        {loading ? "Searching..." : `${products.length} product${products.length !== 1 ? "s" : ""} found`}
      </p>

      {/* Product Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-pharmacy">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-2xl skeleton" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded skeleton" />
                    <div className="h-3 w-1/2 rounded skeleton" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded-full skeleton" />
                  <div className="h-5 w-20 rounded-full skeleton" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card className="shadow-pharmacy">
          <CardContent className="p-10 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center mx-auto">
              <Package className="h-8 w-8 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-base">No products found</p>
              <p className="text-sm text-gray-400">
                {search || selectedCategory
                  ? "Try adjusting your search or filters"
                  : "Add your first product to get started"}
              </p>
            </div>
            {!search && !selectedCategory && (
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-pharmacy border-0"
                onClick={() => setActiveView("add-product")}
              >
                <Plus className="h-4 w-4" /> Add your first product
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {products.map((product) => {
            const qty = product.inventory?.quantity ?? 0;
            const level = stockLevel(qty, 5);

            return (
              <Card key={product.id} className="card-hover stagger-in overflow-hidden shadow-pharmacy">
                <CardContent className="p-0">
                  {/* Main content - clickable */}
                  <div
                    className="p-3.5 flex items-center gap-3 cursor-pointer"
                    onClick={() => handleView(product.id)}
                  >
                    {/* Gradient icon */}
                    <div
                      className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                      style={iconGradient(product.category?.color)}
                    >
                      <Pill className="h-5 w-5 text-white" />
                    </div>

                    {/* Product details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{product.name}</p>
                          {product.genericName && (
                            <p className="text-xs text-gray-400 truncate mt-0.5">
                              {product.genericName}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 shrink-0 mt-1" />
                      </div>

                      {/* Badges row */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {product.category && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${product.category.color}20`,
                              color: product.category.color,
                            }}
                          >
                            {product.category.name}
                          </span>
                        )}
                        {product.strength && (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                            {product.strength}
                          </span>
                        )}
                        {product.dosageForm && (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                            {product.dosageForm}
                          </span>
                        )}
                        {product.scheduleType && (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", scheduleColors[product.scheduleType] || "bg-gray-100 text-gray-700")}>
                            {product.scheduleType.replace("_", " ")}
                          </span>
                        )}
                        {product.isPrescription && (
                          <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-medium">
                            Rx
                          </span>
                        )}

                        {/* Stock badge */}
                        {level === "ok" && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                            {qty} in stock
                          </span>
                        )}
                        {level === "low" && (
                          <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                            {qty} left
                          </span>
                        )}
                        {level === "out" && (
                          <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-semibold">
                            Out of stock
                          </span>
                        )}
                      </div>

                      {/* Manufacturer + price */}
                      <div className="flex items-center justify-between mt-1.5">
                        {product.manufacturer && (
                          <span className="text-[10px] text-gray-400">{product.manufacturer}</span>
                        )}
                        {product.mrp && (
                          <span className="text-xs font-semibold text-gray-700">৳{product.mrp}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="border-t border-gray-100 flex divide-x divide-gray-100 bg-gray-50/40">
                    <button
                      className="flex-1 py-2.5 text-xs font-medium text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-colors flex items-center justify-center gap-1"
                      onClick={() => handleView(product.id)}
                    >
                      <Eye className="h-3 w-3" /> View
                    </button>
                    <button
                      className="flex-1 py-2.5 text-xs font-medium text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-colors flex items-center justify-center gap-1"
                      onClick={() => handleEdit(product.id)}
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      className="flex-1 py-2.5 text-xs font-medium text-gray-500 hover:text-rose-600 hover:bg-rose-50/50 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                      onClick={() => handleDelete(product.id)}
                      disabled={deleting === product.id}
                    >
                      <Trash2 className="h-3 w-3" /> {deleting === product.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="shadow-pharmacy bg-white"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-gray-500 font-medium">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="shadow-pharmacy bg-white"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </motion.div>
  );
}
