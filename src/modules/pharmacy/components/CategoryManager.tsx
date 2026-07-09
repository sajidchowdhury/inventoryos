"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, Tag, Edit2, Trash2,
  FolderOpen, X, Check, AlertCircle, Package, Upload,
  Hash, Folder, ShoppingCart, Stethoscope, Pill, Baby, Sparkles, type LucideIcon,
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

const iconChoices: { name: string; Icon: LucideIcon }[] = [
  { name: "Tag", Icon: Tag },
  { name: "Pill", Icon: Pill },
  { name: "Stethoscope", Icon: Stethoscope },
  { name: "ShoppingCart", Icon: ShoppingCart },
  { name: "Baby", Icon: Baby },
  { name: "Sparkles", Icon: Sparkles },
  { name: "Package", Icon: Package },
  { name: "Folder", Icon: Folder },
  { name: "Hash", Icon: Hash },
];

const typeIconMap: Record<string, LucideIcon> = {
  medicine: Pill,
  surgical: Stethoscope,
  cosmetic: Sparkles,
  supplement: Package,
  "baby-care": Baby,
  other: Tag,
};

const emptyForm = {
  name: "",
  icon: "Tag",
  color: "#10B981",
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

  const renderCategoryCard = (cat: Category, isChild = false) => {
    const IconComp = typeIconMap[cat.type] || Tag;
    return (
      <Card key={cat.id} className={cn("card-hover shadow-pharmacy overflow-hidden", isChild && "ml-6 border-l-2 border-l-muted/40")}>
        <CardContent className="p-4 flex items-center gap-3">
          {/* Color swatch */}
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{
              background: `linear-gradient(135deg, ${cat.color}, ${cat.color}cc)`,
            }}
          >
            <IconComp className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{cat.name}</p>
              <Badge variant="secondary" className="text-[10px] shrink-0 capitalize">
                {cat.type.replace("-", " ")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Package className="h-3 w-3" />
              {cat._count?.products ?? 0} product{(cat._count?.products ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-600 text-muted-foreground transition-colors"
              onClick={(e) => { e.stopPropagation(); openEditDialog(cat); }}
              aria-label="Edit"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-rose-50 text-muted-foreground hover:text-rose-600 transition-colors"
              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(cat); }}
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardContent>
        {/* Render children */}
        {cat.children && cat.children.length > 0 && (
          <div className="border-t border-dashed border-border/50 px-3 pb-3 pt-2 space-y-2 bg-muted/20">
            {cat.children.map((child) => renderCategoryCard(child, true))}
          </div>
        )}
      </Card>
    );
  };

  const totalProducts = allCategories.reduce((sum, c) => sum + (c._count?.products ?? 0), 0);

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen rounded-xl -mx-1 px-1 py-1">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy rounded-full" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight">Categories</h1>
          <p className="text-[11px] text-muted-foreground">Organize your products into groups</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 shadow-pharmacy hidden sm:inline-flex" onClick={() => setActiveView("import")}>
          <Upload className="h-4 w-4" /> Import
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-pharmacy"
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add</span> Category
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 stagger-in">
        <Card className="card-hover shadow-pharmacy">
          <CardContent className="p-3 text-center">
            <div className="h-7 w-7 mx-auto rounded-lg bg-emerald-100 flex items-center justify-center mb-1">
              <Folder className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <p className="text-xl font-bold text-emerald-700 leading-tight">{allCategories.length}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="card-hover shadow-pharmacy">
          <CardContent className="p-3 text-center">
            <div className="h-7 w-7 mx-auto rounded-lg bg-blue-100 flex items-center justify-center mb-1">
              <FolderOpen className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <p className="text-xl font-bold text-blue-700 leading-tight">{categories.length}</p>
            <p className="text-[10px] text-muted-foreground">Top-Level</p>
          </CardContent>
        </Card>
        <Card className="card-hover shadow-pharmacy">
          <CardContent className="p-3 text-center">
            <div className="h-7 w-7 mx-auto rounded-lg bg-purple-100 flex items-center justify-center mb-1">
              <Package className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <p className="text-xl font-bold text-purple-700 leading-tight">{totalProducts}</p>
            <p className="text-[10px] text-muted-foreground">Products</p>
          </CardContent>
        </Card>
      </div>

      {/* Category List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="shadow-pharmacy">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 skeleton rounded" />
                  <div className="h-2.5 w-16 skeleton rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <Card className="card-hover shadow-pharmacy stagger-in">
          <CardContent className="p-10 text-center space-y-3">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center ring-1 ring-emerald-100">
              <FolderOpen className="h-8 w-8 text-emerald-500/70" />
            </div>
            <div>
              <p className="font-semibold">No categories yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Create categories to organize your products, or import them via CSV.
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-pharmacy"
              onClick={openCreateDialog}
            >
              <Plus className="h-3.5 w-3.5" /> Create Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {categories.map((cat) => (
            <div key={cat.id} className="stagger-in">
              {renderCategoryCard(cat)}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                {editingId ? <Edit2 className="h-3.5 w-3.5 text-white" /> : <Plus className="h-3.5 w-3.5 text-white" />}
              </div>
              {editingId ? "Edit Category" : "Add Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {error && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
              </div>
            )}

            {/* Live preview */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-dashed">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-colors"
                style={{ background: `linear-gradient(135deg, ${form.color}, ${form.color}cc)` }}
              >
                {(() => {
                  const Icon = iconChoices.find((i) => i.name === form.icon)?.Icon || Tag;
                  return <Icon className="h-5 w-5 text-white" />;
                })()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{form.name || "Category name"}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{form.type.replace("-", " ")}</p>
              </div>
            </div>

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
              <Label className="text-xs font-medium">Icon</Label>
              <div className="grid grid-cols-9 gap-1.5">
                {iconChoices.map(({ name, Icon }) => (
                  <button
                    key={name}
                    type="button"
                    className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center border-2 transition-all",
                      form.icon === name
                        ? "border-emerald-500 bg-emerald-50 scale-105"
                        : "border-transparent bg-muted/60 hover:bg-muted"
                    )}
                    onClick={() => setForm((p) => ({ ...p, icon: name }))}
                    aria-label={name}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Color</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-all",
                      form.color === color ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm((p) => ({ ...p, color }))}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
            </div>

            <Button
              className="w-full h-10 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-pharmacy"
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
            <DialogTitle className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-rose-100 flex items-center justify-center">
                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              </div>
              Delete Category
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {error && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
              </div>
            )}
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center shadow-sm"
                style={{ background: `linear-gradient(135deg, ${deleteConfirm?.color || "#6b7280"}, ${deleteConfirm?.color || "#6b7280"}cc)` }}
              >
                <Trash2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium">Delete &ldquo;{deleteConfirm?.name}&rdquo;?</p>
                <p className="text-xs text-muted-foreground">
                  {deleteConfirm?._count?.products ?? 0} product(s) · {deleteConfirm?.children?.length ?? 0} subcategory(s)
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg">
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
