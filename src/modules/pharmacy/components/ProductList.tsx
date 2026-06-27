"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search, Plus, Pill, Filter, X, ChevronDown,
  Package, Edit2, Trash2, ArrowLeft, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  const { setActiveView, setEditingProductId } = useNavStore();
  const businessId = session?.business?.id;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
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

  const handleEdit = (productId: string) => {
    setEditingProductId(productId);
    setActiveView("edit-product");
  };

  const stockLevel = (qty: number, min: number) => {
    if (qty <= 0) return "out";
    if (qty <= min) return "low";
    return "ok";
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Products</h1>
        <Button size="sm" className="gap-1.5" onClick={() => setActiveView("add-product")}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, generic, manufacturer..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-9 pr-10 h-11"
        />
        {(search || selectedCategory) && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => { setSearch(""); setSelectedCategory(null); setPage(1); }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
            !selectedCategory
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
          onClick={() => { setSelectedCategory(null); setPage(1); }}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
              selectedCategory === cat.id
                ? "text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            style={selectedCategory === cat.id ? { backgroundColor: cat.color } : undefined}
            onClick={() => { setSelectedCategory(cat.id); setPage(1); }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {loading ? "Searching..." : `${products.length} product${products.length !== 1 ? "s" : ""} found`}
      </p>

      {/* Product Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No products found</p>
            <p className="text-sm text-muted-foreground">
              {search || selectedCategory
                ? "Try adjusting your search or filters"
                : "Add your first product to get started"}
            </p>
            {!search && !selectedCategory && (
              <Button size="sm" className="gap-1.5" onClick={() => setActiveView("add-product")}>
                <Plus className="h-3.5 w-3.5" /> Add Product
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {products.map((product) => {
            const qty = product.inventory?.quantity ?? 0;
            const level = stockLevel(qty, 5);

            return (
              <Card key={product.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div
                    className="p-3 flex items-start gap-3 cursor-pointer"
                    onClick={() => handleEdit(product.id)}
                  >
                    {/* Category Color Indicator */}
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: product.category?.color ? `${product.category.color}20` : "#f3f4f6" }}
                    >
                      <Pill
                        className="h-5 w-5"
                        style={{ color: product.category?.color || "#6b7280" }}
                      />
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{product.name}</p>
                          {product.genericName && (
                            <p className="text-xs text-muted-foreground truncate">{product.genericName}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {product.strength && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
                            {product.strength}
                          </span>
                        )}
                        {product.dosageForm && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-medium">
                            {product.dosageForm}
                          </span>
                        )}
                        {product.scheduleType && (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", scheduleColors[product.scheduleType] || "bg-gray-100 text-gray-700")}>
                            {product.scheduleType.replace("_", " ")}
                          </span>
                        )}
                        {product.isPrescription && (
                          <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                            Rx
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-semibold",
                            level === "out" && "text-red-600",
                            level === "low" && "text-orange-600",
                            level === "ok" && "text-green-600"
                          )}>
                            {qty} {product.unit}{qty !== 1 ? "s" : ""}
                          </span>
                          {product.manufacturer && (
                            <span className="text-[10px] text-muted-foreground">{product.manufacturer}</span>
                          )}
                        </div>
                        {product.mrp && (
                          <span className="text-xs font-semibold">৳{product.mrp}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="border-t flex divide-x">
                    <button
                      className="flex-1 py-2 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors flex items-center justify-center gap-1"
                      onClick={() => handleEdit(product.id)}
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                    <button
                      className="flex-1 py-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
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
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
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
