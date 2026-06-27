"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Tag, Edit2, Trash2, ChevronRight,
  FolderOpen, X, Check, AlertCircle, Package, Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  type: string;
  sortOrder: number;
  parentId: string | null;
  _count?: { products: number };
  children?: Category[];
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const categoryTypes = ["medicine", "surgical", "cosmetic", "supplement", "baby-care", "other"];
const colorOptions = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#06B6D4",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6366F1", "#14B8A6",
  "#84CC16", "#F43F5E", "#0EA5E9", "#A855F7", "#10B981",
];

const emptyForm = {
  name: "",
  icon: "Tag",
  color: "#3B82F6",
  type: "medicine",
  parentId: "",
  sortOrder: "0",
};

export function CategoryManager() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState(emptyForm);

  const fetchCategories = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/categories`);
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
        setAllCategories(data.allCategories || []);
      }
    } catch (err) {
      console.error("Fetch categories error:", err);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openCreateDialog = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = async (cat: Category) => {
    setForm({
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      type: cat.type,
      parentId: cat.parentId || "",
      sortOrder: cat.sortOrder.toString(),
    });
    setEditingId(cat.id);
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!businessId || !form.name.trim()) {
      setError("Category name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        icon: form.icon,
        color: form.color,
        type: form.type,
        parentId: form.parentId && form.parentId !== "__none__" ? form.parentId : null,
        sortOrder: parseInt(form.sortOrder) || 0,
      };

      let res;
      if (editingId) {
        res = await fetch(`/api/businesses/${businessId}/categories/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/businesses/${businessId}/categories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save category");

      setDialogOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!businessId || !deleteConfirm) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/businesses/${businessId}/categories/${deleteConfirm.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete category");

      setDeleteConfirm(null);
      fetchCategories();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setDeleting(false);
    }
  };

  const renderCategoryCard = (cat: Category, isChild = false) => (
    <Card key={cat.id} className={cn("overflow-hidden", isChild && "ml-6 border-l-2")}>
      <CardContent className="p-3 flex items-center gap-3">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${cat.color}20` }}
        >
          <Tag className="h-4 w-4" style={{ color: cat.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">{cat.name}</p>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {cat.type.replace("-", " ")}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {cat._count?.products ?? 0} product{(cat._count?.products ?? 0) !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            onClick={(e) => { e.stopPropagation(); openEditDialog(cat); }}
            aria-label="Edit"
          >
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(cat); }}
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
          <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: cat.color }} />
        </div>
      </CardContent>
      {/* Render children */}
      {cat.children && cat.children.length > 0 && (
        <div className="border-t px-3 pb-2 pt-2 space-y-2">
          {cat.children.map((child) => renderCategoryCard(child, true))}
        </div>
      )}
    </Card>
  );

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Categories</h1>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setActiveView("import")}>
          <Upload className="h-4 w-4" /> Import
        </Button>
        <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <Card className="flex-1">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-primary">{allCategories.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-primary">{categories.length}</p>
            <p className="text-[10px] text-muted-foreground">Top-Level</p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-primary">
              {allCategories.reduce((sum, c) => sum + (c._count?.products ?? 0), 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">Products</p>
          </CardContent>
        </Card>
      </div>

      {/* Category List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="font-medium">No categories yet</p>
            <p className="text-sm text-muted-foreground">
              Create categories to organize your products, or import them via CSV
            </p>
            <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
              <Plus className="h-3.5 w-3.5" /> Create Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => renderCategoryCard(cat))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Category Name *</Label>
              <Input
                placeholder="e.g., Antibiotics, Vitamins"
                value={form.name}
                onChange={(e) => { setForm((p) => ({ ...p, name: e.target.value })); setError(null); }}
                className="h-10"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryTypes.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t.replace("-", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Sort Order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
                  className="h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Parent Category</Label>
              <Select
                value={form.parentId || "__none__"}
                onValueChange={(v) => setForm((p) => ({ ...p, parentId: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (top-level)</SelectItem>
                  {allCategories
                    .filter((c) => c.id !== editingId) // Prevent self-parenting
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Color</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition-transform",
                      form.color === color ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm((p) => ({ ...p, color }))}
                  />
                ))}
              </div>
            </div>

            <Button
              className="w-full h-10 gap-2"
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
            >
              {editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? "Saving..." : editingId ? "Update Category" : "Create Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {error}
              </p>
            )}
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${deleteConfirm?.color || "#6b7280"}20` }}
              >
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium">Delete &ldquo;{deleteConfirm?.name}&rdquo;?</p>
                <p className="text-xs text-muted-foreground">
                  {deleteConfirm?._count?.products ?? 0} product(s) · {deleteConfirm?.children?.length ?? 0} subcategory(s)
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This will permanently hide the category. Products assigned to it will keep their data but lose their category link.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-1.5"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
