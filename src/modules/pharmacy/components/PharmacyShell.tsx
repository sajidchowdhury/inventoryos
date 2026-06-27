"use client";

import { useNavStore } from "@/lib/nav-store";
import { PharmacyDashboard } from "./PharmacyDashboard";
import { ProductList } from "./ProductList";
import { ProductDetail } from "./ProductDetail";
import { ProductForm } from "./ProductForm";
import { BatchList } from "./BatchList";
import { BatchForm } from "./BatchForm";
import { CategoryManager } from "./CategoryManager";
import { CsvImport } from "./CsvImport";
import { ProfileView } from "./ProfileView";
import { BottomNav } from "./BottomNav";

export function PharmacyShell() {
  const activeView = useNavStore((s) => s.activeView);

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return <PharmacyDashboard />;
      case "products":
        return <ProductList />;
      case "product-detail":
        return <ProductDetail />;
      case "add-product":
        return <ProductForm mode="add" />;
      case "edit-product":
        return <ProductForm mode="edit" />;
      case "batches":
        return <BatchList />;
      case "add-batch":
        return <BatchForm mode="add" />;
      case "edit-batch":
        return <BatchForm mode="edit" />;
      case "categories":
        return <CategoryManager />;
      case "import":
        return <CsvImport />;
      case "profile":
        return <ProfileView />;
      default:
        return <PharmacyDashboard />;
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {/* Main content area with bottom padding for nav */}
      <div className="flex-1 pb-16">
        {renderView()}
      </div>
      {/* Fixed bottom navigation */}
      <BottomNav />
    </div>
  );
}
