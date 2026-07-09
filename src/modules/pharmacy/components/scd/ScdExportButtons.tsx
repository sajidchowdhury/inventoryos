"use client";

// ScdExportButtons — P4 feature
// PDF + Excel export buttons for SCD count sheet + variance report.
// PDF opens a print-friendly HTML page in a new tab (browser prints to PDF).
// Excel downloads a .xlsx file directly.

import { useState } from "react";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScdExportButtonsProps {
  businessId: string;
  scdId: string;
  /** Compact mode for smaller spaces (default: false) */
  compact?: boolean;
  /** Visual variant */
  variant?: "default" | "outline";
  className?: string;
}

export function ScdExportButtons({
  businessId, scdId, compact = false, variant = "outline", className,
}: ScdExportButtonsProps) {
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const handlePdf = () => {
    setExporting("pdf");
    // PDF = print-friendly HTML, opens in new tab — browser handles the actual PDF save
    const url = `/api/businesses/${businessId}/stock-count-day/${scdId}/export?format=pdf`;
    window.open(url, "_blank");
    // Reset state after a short delay (the new tab opens immediately)
    setTimeout(() => setExporting(null), 500);
  };

  const handleExcel = async () => {
    setExporting("excel");
    try {
      const url = `/api/businesses/${businessId}/stock-count-day/${scdId}/export?format=excel`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");
      // Get the filename from Content-Disposition header
      const disp = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disp.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `scd_export_${Date.now()}.xlsx`;

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Excel export error:", e);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Button
        type="button"
        variant={variant}
        size={compact ? "sm" : "default"}
        className="gap-1.5"
        onClick={handlePdf}
        disabled={exporting !== null}
      >
        {exporting === "pdf" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        {compact ? "PDF" : "Export PDF"}
      </Button>
      <Button
        type="button"
        variant={variant}
        size={compact ? "sm" : "default"}
        className="gap-1.5"
        onClick={handleExcel}
        disabled={exporting !== null}
      >
        {exporting === "excel" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-3.5 w-3.5" />
        )}
        {compact ? "Excel" : "Export Excel"}
      </Button>
    </div>
  );
}
