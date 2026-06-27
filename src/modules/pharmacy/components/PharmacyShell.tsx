"use client";

import { useNavStore } from "@/lib/nav-store";
import { PharmacyDashboard } from "./PharmacyDashboard";
import { ProductList } from "./ProductList";
import { ProductForm } from "./ProductForm";
import { CategoryManager } from "./CategoryManager";
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
      case "add-product":
        return <ProductForm mode="add" />;
      case "edit-product":
        return <ProductForm mode="edit" />;
      case "categories":
        return <CategoryManager />;
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
