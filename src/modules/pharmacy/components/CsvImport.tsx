"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Upload, Download, FileText, Check, X,
  AlertCircle, Loader2, FileSpreadsheet, Copy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

export function CsvImport() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [phase, setPhase] = useState<Phase>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [csvText, setCsvText] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
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

    try {
      const res = await fetch(`/api/businesses/${businessId}/products/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      setImportResults(data.results || []);
      setImportSummary(data.summary || { total: 0, success: 0, errors: 0 });
      setPhase("complete");
    } catch (err: unknown) {
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
    setError(null);
    setImportResults([]);
    setImportSummary(null);
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("products")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1">Import Products</h1>
      </div>

      {/* Phase: Upload */}
      {phase === "upload" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <FileSpreadsheet className="h-4 w-4" /> Bulk Import via CSV
              </div>
              <p className="text-xs text-muted-foreground">
                Upload a CSV file to import multiple products at once. Match column headers to your data fields.
              </p>
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleDownloadTemplate}>
                <Download className="h-3.5 w-3.5" /> Download CSV Template
              </Button>
            </CardContent>
          </Card>

          <div
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30",
              error && "border-destructive/50 bg-destructive/5"
            )}
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
            <Upload className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">
              Tap to browse or drag & drop a CSV
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum 5MB · .csv format only
            </p>
          </div>

          {error && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Quick Guide
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

      {/* Phase: Preview */}
      {phase === "preview" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium truncate flex-1">{fileName}</p>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{parsedRows.length} products ready to import</span>
                <Badge variant="secondary">{headers.length} columns</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Preview table - show first 5 rows */}
          <Card>
            <CardContent className="p-0 overflow-hidden">
              <div className="px-4 py-2 bg-muted/50 border-b">
                <p className="text-xs font-semibold">Preview (first 5 rows)</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      {headers.slice(0, 6).map((h, i) => (
                        <th key={i} className="text-left p-2 font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        {headers.slice(0, 6).map((_, i) => (
                          <td key={i} className="p-2 whitespace-nowrap max-w-[120px] truncate">
                            {row[i] || <span className="text-muted-foreground">—</span>}
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
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-3 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </CardContent>
            </Card>
          )}

          <Button
            size="lg"
            className="w-full h-12 gap-2"
            onClick={handleImport}
            disabled={parsedRows.length === 0}
          >
            <Upload className="h-4 w-4" />
            Import {parsedRows.length} Product{parsedRows.length !== 1 ? "s" : ""}
          </Button>
        </>
      )}

      {/* Phase: Importing */}
      {phase === "importing" && (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            <div>
              <p className="font-semibold">Importing products...</p>
              <p className="text-sm text-muted-foreground">Please wait, do not close this page.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Phase: Complete */}
      {phase === "complete" && importSummary && (
        <>
          <Card className={cn(
            "border-l-4",
            importSummary.errors > 0 ? "border-l-orange-500" : "border-l-green-500"
          )}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center",
                  importSummary.errors > 0 ? "bg-orange-50" : "bg-green-50"
                )}>
                  {importSummary.errors > 0 ? (
                    <AlertCircle className="h-6 w-6 text-orange-600" />
                  ) : (
                    <Check className="h-6 w-6 text-green-600" />
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
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold">{importSummary.total}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-600">{importSummary.success}</p>
                  <p className="text-[10px] text-muted-foreground">Success</p>
                </div>
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-red-600">{importSummary.errors}</p>
                  <p className="text-[10px] text-muted-foreground">Errors</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Show error details */}
          {importResults.filter((r) => r.status === "error").length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-2 border-b bg-red-50">
                  <p className="text-xs font-semibold text-red-700">Errors ({importResults.filter((r) => r.status === "error").length})</p>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y">
                  {importResults.filter((r) => r.status === "error").map((r, idx) => (
                    <div key={idx} className="p-3 flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">Row {r.row}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{r.data.name || "(no name)"}</p>
                        <p className="text-[11px] text-destructive">{r.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show successful imports preview */}
          {importResults.filter((r) => r.status === "success").length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-2 border-b bg-green-50">
                  <p className="text-xs font-semibold text-green-700">
                    Imported ({importResults.filter((r) => r.status === "success").length})
                  </p>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y">
                  {importResults.filter((r) => r.status === "success").slice(0, 10).map((r, idx) => (
                    <div key={idx} className="p-3 flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <p className="text-xs font-medium truncate flex-1">{r.data.name}</p>
                      {r.data.manufacturer && (
                        <span className="text-[10px] text-muted-foreground">{r.data.manufacturer}</span>
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

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" onClick={handleReset}>
              <Upload className="h-4 w-4" /> Import More
            </Button>
            <Button className="flex-1 gap-2" onClick={() => setActiveView("products")}>
              <Check className="h-4 w-4" /> View Products
            </Button>
          </div>
        </>
      )}
    </motion.div>
  );
}
