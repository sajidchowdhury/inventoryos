"use client";

// /admin/cctv/page.tsx — CC Camera project placeholder.
// Will be built when the CCTV business module is activated.

import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Cctv, Construction, CheckCircle2 } from "lucide-react";

export default function CctvDashboard() {
  return (
    <Card className="border-blue-200 dark:border-blue-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
          <Cctv className="h-5 w-5" />
          CC Camera Inventory
        </CardTitle>
        <CardDescription>Coming Soon — Module under development</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mb-4">
            <Construction className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2">CC Camera Module</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            This module will handle CCTV inventory management including installation tracking,
            maintenance contracts, warranty management, and project-based billing.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Planned Features:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              "Installation tracking",
              "Maintenance contracts",
              "Warranty management",
              "Project-based inventory",
              "Contractor pricing",
              "Monthly service reminders",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                {feature}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
