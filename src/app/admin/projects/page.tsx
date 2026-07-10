"use client";

// /admin/projects/page.tsx — Overview of all upcoming project modules.

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingBag, UtensilsCrossed, Smartphone, Zap, Cake, Construction,
} from "lucide-react";

const UPCOMING_PROJECTS = [
  { name: "Grocery", icon: ShoppingBag, color: "from-orange-500 to-amber-500", features: ["Perishable tracking", "Barcode-heavy", "Low margins", "No expiry regulations"] },
  { name: "Restaurant", icon: UtensilsCrossed, color: "from-red-500 to-rose-500", features: ["Recipe costing", "Ingredient tracking", "Menu engineering", "No batches"] },
  { name: "Mobile Shop", icon: Smartphone, color: "from-purple-500 to-violet-500", features: ["IMEI tracking", "Warranty", "Trade-in", "High-value low-volume"] },
  { name: "Electrical", icon: Zap, color: "from-yellow-500 to-amber-500", features: ["Project-based inventory", "BOM management", "Contractor pricing", "Bulk orders"] },
  { name: "Bakery", icon: Cake, color: "from-pink-500 to-rose-500", features: ["Daily production", "24-48hr perishable", "Recipe costing", "No batches"] },
];

export default function ProjectsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Construction className="h-5 w-5 text-purple-600" />
          Upcoming Projects
        </CardTitle>
        <CardDescription>
          These business modules are registered in the system but not yet implemented.
          Each will get its own dashboard with project-specific metrics.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {UPCOMING_PROJECTS.map((project) => {
          const Icon = project.icon;
          return (
            <div key={project.name} className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${project.color} flex items-center justify-center shrink-0`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{project.name}</span>
                  <Badge variant="secondary" className="text-xs">Planned</Badge>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {project.features.map((f) => (
                    <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
