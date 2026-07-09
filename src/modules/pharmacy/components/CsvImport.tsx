"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Upload, Download, FileText, Check, X,
  AlertCircle, Loader2, FileSpreadsheet, CheckCircle2, ArrowRight,
  UploadCloud, ListChecks, Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

interface ImportResult {
  row: number;
  data: { name: string; manufacturer?: string };
  status: "success" | "error";
  message: string;
}

type Phase = "upload" | "preview" | "importing" | "complete";

// Known target fields the import API understands
const TARGET_FIELDS: { value: string; label: string }[] = [
  { value: "name", label: "Product Name" },
  { value: "sku", label: "SKU" },
  { value: "barcode", label: "Barcode" },
  { value: "manufacturer", label: "Manufacturer" },
  { value: "category", label: "Category" },
  { value: "genericName", label: "Generic Name" },
  { value: "dosageForm", label: "Dosage Form" },
  { value: "strength", label: "Strength" },
  { value: "unit", label: "Unit" },
  { value: "purchasePrice", label: "Purchase Price (৳)" },
  { value: "salePrice", label: "Sale Price (৳)" },
  { value: "stockQuantity", label: "Stock Quantity" },
  { value: "reorderLevel", label: "Reorder Level" },
  { value: "expiryDate", label: "Expiry Date" },
  { value: "batchNumber", label: "Batch Number" },
  { value: "isPrescription", label: "Prescription (Yes/No)" },
  { value: "description", label: "Description" },
  { value: "__skip__", label: "Skip column" },
];

// Suggest a target field based on a CSV header
function suggestTarget(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  const map: Record<string, string> = {
    name: "name", productname: "name", product: "name", itemname: "name",
    sku: "sku", code: "sku", itemcode: "sku",
    barcode: "barcode", upc: "barcode",
    manufacturer: "manufacturer", brand: "manufacturer", company: "manufacturer",
    category: "category", cat: "category",
    genericname: "genericName", generic: "genericName",
    dosageform: "dosageForm", form: "dosageForm",
    strength: "strength", potency: "strength",
    unit: "unit", units: "unit",
    purchaseprice: "purchasePrice", cost: "purchasePrice", costprice: "purchasePrice",
    saleprice: "salePrice", price: "salePrice", mrp: "salePrice", sellingprice: "salePrice",
    stock: "stockQuantity", quantity: "stockQuantity", stockquantity: "stockQuantity", qty: "stockQuantity",
    reorderlevel: "reorderLevel", reorder: "reorderLevel",
    expirydate: "expiryDate", expiry: "expiryDate", expiration: "expiryDate",
    batch: "batchNumber", batchnumber: "batchNumber", lot: "batchNumber",
    prescription: "isPrescription", rx: "isPrescription",
    description: "description", desc: "description",
  };
  return map[h] || "__skip__";
}

export function CsvImport() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [phase, setPhase] = useState<Phase>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [csvText, setCsvText] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importSummary, setImportSummary] = useState<{ total: number; success: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCsvLocal = (text: string): { headers: string[]; rows: string[][] } => {
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else { current += char; }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(parseLine);
    return { headers, rows };
  };

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setError("Please upload a .csv file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("File too large. Maximum 5MB.");
      return;
    }

    setError(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      const { headers, rows } = parseCsvLocal(text);

      if (headers.length === 0) {
        setError("CSV file appears to be empty");
        return;
      }

      if (!headers.some((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "").includes("name"))) {
        setError("CSV must contain a 'name' column");
        return;
      }

      setHeaders(headers);
      setParsedRows(rows);
      // Auto-suggest mappings
      const suggested: Record<number, string> = {};
      headers.forEach((h, i) => { suggested[i] = suggestTarget(h); });
      setMappings(suggested);
      setPhase("preview");
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDownloadTemplate = () => {
    if (!businessId) return;
    window.open(`/api/businesses/${businessId}/products/template`, "_blank");
  };

  const handleImport = async () => {
    if (!businessId) return;
    setPhase("importing");
    setError(null);
    setImportProgress(0);

    // Animate progress bar for UX
    const progressInterval = setInterval(() => {
      setImportProgress((p) => (p < 90 ? p + Math.random() * 8 : p));
    }, 250);

    try {
      const res = await fetch(`/api/businesses/${businessId}/products/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      clearInterval(progressInterval);
      setImportProgress(100);
      setImportResults(data.results || []);
      setImportSummary(data.summary || { total: 0, success: 0, errors: 0 });
      setTimeout(() => setPhase("complete"), 400);
    } catch (err: unknown) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : "Import failed");
      setPhase("preview");
    }
  };

  const handleReset = () => {
    setPhase("upload");
    setFileName("");
    setCsvText("");
    setParsedRows([]);
    setHeaders([]);
    setMappings({});
    setError(null);
    setImportResults([]);
    setImportSummary(null);
    setImportProgress(0);
  };

  // Step indicator helpers
  const stepNumber = phase === "upload" ? 1
    : phase === "preview" ? 2
    : phase === "importing" ? 3
    : 3;

  const steps = [
    { num: 1, label: "Upload", icon: UploadCloud },
    { num: 2, label: "Map", icon: ListChecks },
    { num: 3, label: "Review", icon: Eye },
  ];

  const skippedCount = Object.values(mappings).filter((v) => v === "__skip__").length;
  const mappedCount = headers.length - skippedCount;

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 pharmacy-bg min-h-screen rounded-xl -mx-1 px-1 py-1">
      {/* Header */}
      <div className="flex items-center gap-2 stagger-in">
        <Button variant="ghost" size="icon" className="shrink-0 shadow-pharmacy rounded-full" onClick={() => setActiveView("products")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight">Import Products</h1>
          <p className="text-[11px] text-muted-foreground">Bulk upload inventory via CSV</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="stagger-in">
        <div className="flex items-center gap-1 sm:gap-2">
          {steps.map((step, idx) => {
            const isCompleted = step.num < stepNumber;
            const isActive = step.num === stepNumber;
            const Icon = step.icon;
            return (
              <div key={step.num} className="flex items-center flex-1 last:flex-none">
                <div className={cn(
                  "flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all",
                  isCompleted && "bg-emerald-50 border-emerald-200 text-emerald-700",
                  isActive && "bg-gradient-to-r from-emerald-500 to-teal-600 border-transparent text-white shadow-pharmacy",
                  !isCompleted && !isActive && "bg-muted/40 border-border/50 text-muted-foreground"
                )}>
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold",
                    isCompleted && "bg-emerald-500 text-white",
                    isActive && "bg-white/20 text-white",
                    !isCompleted && !isActive && "bg-muted-foreground/15"
                  )}>
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span className="text-xs font-semibold hidden sm:inline">{step.label}</span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 mx-1 rounded-full transition-colors",
                    isCompleted ? "bg-emerald-400" : "bg-border/50"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Phase: Upload */}
      {phase === "upload" && (
        <>
          <Card className="card-hover shadow-pharmacy stagger-in">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <FileSpreadsheet className="h-4 w-4" /> Bulk Import via CSV
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a CSV file to import multiple products at once. Match column headers to your data fields.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-3.5 w-3.5" /> Download CSV Template
              </Button>
            </CardContent>
          </Card>

          <Card className={cn(
            "card-hover shadow-pharmacy stagger-in border-2 border-dashed",
            dragActive ? "border-emerald-400 bg-emerald-50/40" : "border-border/60",
            error && "border-rose-300 bg-rose-50/30"
          )}>
            <CardContent className="p-0">
              <div
                className="p-8 text-center cursor-pointer transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
                <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-pharmacy-lg mb-3 animate-float">
                  <UploadCloud className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-semibold mb-1">
                  Tap to browse or drag &amp; drop a CSV
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Maximum 5MB · .csv format only
                </p>
                <Button
                  size="sm"
                  className="mt-3 gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-pharmacy"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  <Upload className="h-3.5 w-3.5" /> Browse Files
                </Button>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Card className="border-rose-200 bg-rose-50/80 shadow-pharmacy stagger-in">
              <CardContent className="p-3 flex items-center gap-2 text-sm text-rose-700">
                <div className="h-7 w-7 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4" />
                </div>
                {error}
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/30 shadow-pharmacy stagger-in">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-emerald-600" /> Quick Guide
              </p>
              <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
                <li>The <strong>name</strong> column is required</li>
                <li>Use the template to see all supported fields</li>
                <li>Category names must match existing categories in your pharmacy</li>
                <li>For Yes/No fields (like isPrescription), use &ldquo;Yes&rdquo; or &ldquo;No&rdquo;</li>
                <li>Blank fields will use default values</li>
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      {/* Phase: Preview (Map + Review) */}
      {phase === "preview" && (
        <>
          <Card className="card-hover shadow-pharmacy stagger-in">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                </div>
                <p className="text-sm font-medium truncate flex-1">{fileName}</p>
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground hover:text-rose-600">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{parsedRows.length} products ready to import</span>
                <Badge variant="secondary" className="font-mono">{headers.length} columns</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Column mapping */}
          <Card className="card-hover shadow-pharmacy stagger-in">
            <CardContent className="p-0 overflow-hidden">
              <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50/50 border-b flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ListChecks className="h-3.5 w-3.5 text-emerald-700" />
                  <p className="text-xs font-semibold">Column Mapping</p>
                </div>
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
                  {mappedCount} mapped · {skippedCount} skipped
                </Badge>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-muted/40 backdrop-blur-sm z-10">
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Source Column</th>
                      <th className="text-center p-2 w-8"></th>
                      <th className="text-left p-2 font-medium text-muted-foreground uppercase tracking-wider text-[10px]">Target Field</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((h, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-2 font-mono text-foreground/80">{h}</td>
                        <td className="text-center text-muted-foreground">
                          <ArrowRight className="h-3 w-3 inline" />
                        </td>
                        <td className="p-1.5">
                          <Select
                            value={mappings[i] || "__skip__"}
                            onValueChange={(v) => setMappings((p) => ({ ...p, [i]: v }))}
                          >
                            <SelectTrigger className="h-8 text-[11px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TARGET_FIELDS.map((f) => (
                                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Preview table */}
          <Card className="card-hover shadow-pharmacy stagger-in">
            <CardContent className="p-0 overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/40 border-b flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-emerald-700" />
                <p className="text-xs font-semibold">Preview (first 5 rows)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      {headers.slice(0, 6).map((h, i) => (
                        <th key={i} className="text-left p-2 font-medium whitespace-nowrap text-muted-foreground">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className={cn("border-b last:border-0", idx % 2 === 1 && "bg-muted/20")}>
                        {headers.slice(0, 6).map((_, i) => (
                          <td key={i} className="p-2 whitespace-nowrap max-w-[120px] truncate">
                            {row[i] || <span className="text-muted-foreground/50">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 5 && (
                <div className="px-4 py-2 bg-muted/30 text-center text-[11px] text-muted-foreground">
                  + {parsedRows.length - 5} more rows
                </div>
              )}
            </CardContent>
          </Card>

          {error && (
            <Card className="border-rose-200 bg-rose-50/80 shadow-pharmacy stagger-in">
              <CardContent className="p-3 flex items-center gap-2 text-sm text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </CardContent>
            </Card>
          )}

          <div className="stagger-in">
            <Button
              size="lg"
              className="w-full h-12 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-pharmacy-lg"
              onClick={handleImport}
              disabled={parsedRows.length === 0}
            >
              <Upload className="h-4 w-4" />
              Import {parsedRows.length} Product{parsedRows.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </>
      )}

      {/* Phase: Importing */}
      {phase === "importing" && (
        <Card className="card-hover shadow-pharmacy stagger-in">
          <CardContent className="p-8 text-center space-y-4">
            <div className="relative h-16 w-16 mx-auto">
              <div className="absolute inset-0 rounded-full bg-emerald-100 animate-pulse-soft" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
              </div>
            </div>
            <div>
              <p className="font-semibold">Importing products...</p>
              <p className="text-sm text-muted-foreground">Please wait, do not close this page.</p>
            </div>
            {/* Progress bar */}
            <div className="space-y-1.5 max-w-xs mx-auto">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300 ease-out"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">{Math.round(importProgress)}%</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase: Complete */}
      {phase === "complete" && importSummary && (
        <>
          <Card className={cn(
            "shadow-pharmacy stagger-in border-l-4",
            importSummary.errors > 0 ? "border-l-amber-500" : "border-l-emerald-500"
          )}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-14 w-14 rounded-2xl flex items-center justify-center shadow-pharmacy",
                  importSummary.errors > 0 ? "bg-amber-100" : "bg-emerald-100"
                )}>
                  {importSummary.errors > 0 ? (
                    <AlertCircle className="h-7 w-7 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-lg">
                    {importSummary.success} of {importSummary.total} imported
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {importSummary.errors > 0
                      ? `${importSummary.errors} row(s) had errors`
                      : "All products imported successfully!"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="bg-muted/40 rounded-xl p-2.5 text-center border border-border/50">
                  <p className="text-xl font-bold text-foreground leading-tight">{importSummary.total}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-2.5 text-center border border-emerald-100">
                  <p className="text-xl font-bold text-emerald-700 leading-tight">{importSummary.success}</p>
                  <p className="text-[10px] text-emerald-600/80 mt-0.5">Success</p>
                </div>
                <div className="bg-rose-50 rounded-xl p-2.5 text-center border border-rose-100">
                  <p className="text-xl font-bold text-rose-700 leading-tight">{importSummary.errors}</p>
                  <p className="text-[10px] text-rose-600/80 mt-0.5">Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Show error details */}
          {importResults.filter((r) => r.status === "error").length > 0 && (
            <Card className="shadow-pharmacy stagger-in">
              <CardContent className="p-0">
                <div className="px-4 py-2.5 border-b bg-rose-50/60 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                  <p className="text-xs font-semibold text-rose-700">
                    Errors ({importResults.filter((r) => r.status === "error").length})
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
                  {importResults.filter((r) => r.status === "error").map((r, idx) => (
                    <div key={idx} className="p-3 flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0 font-mono">Row {r.row}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{r.data.name || "(no name)"}</p>
                        <p className="text-[11px] text-rose-600">{r.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show successful imports preview */}
          {importResults.filter((r) => r.status === "success").length > 0 && (
            <Card className="shadow-pharmacy stagger-in">
              <CardContent className="p-0">
                <div className="px-4 py-2.5 border-b bg-emerald-50/60 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <p className="text-xs font-semibold text-emerald-700">
                    Imported ({importResults.filter((r) => r.status === "success").length})
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
                  {importResults.filter((r) => r.status === "success").slice(0, 10).map((r, idx) => (
                    <div key={idx} className="p-3 flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <p className="text-xs font-medium truncate flex-1">{r.data.name}</p>
                      {r.data.manufacturer && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{r.data.manufacturer}</span>
                      )}
                    </div>
                  ))}
                  {importResults.filter((r) => r.status === "success").length > 10 && (
                    <div className="p-2 text-center text-[11px] text-muted-foreground">
                      + {importResults.filter((r) => r.status === "success").length - 10} more
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 stagger-in">
            <Button variant="outline" className="flex-1 gap-2 shadow-pharmacy" onClick={handleReset}>
              <Upload className="h-4 w-4" /> Import More
            </Button>
            <Button
              className="flex-1 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-0 shadow-pharmacy"
              onClick={() => setActiveView("products")}
            >
              <Check className="h-4 w-4" /> View Products
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}
