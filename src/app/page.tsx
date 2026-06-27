"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Database,
  Palette,
  FolderTree,
  Layout,
  Cpu,
  Pill,
  ShoppingCart,
  UtensilsCrossed,
  Camera,
  Smartphone,
  Zap,
  Cake,
  ArrowRight,
  Box,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getAllModules } from "@/lib/modules";

interface SystemCheck {
  name: string;
  description: string;
  status: "checking" | "ready" | "error";
  icon: React.ReactNode;
}

const iconMap: Record<string, React.ReactNode> = {
  Pill: <Pill className="h-6 w-6" />,
  ShoppingCart: <ShoppingCart className="h-6 w-6" />,
  UtensilsCrossed: <UtensilsCrossed className="h-6 w-6" />,
  Camera: <Camera className="h-6 w-6" />,
  Smartphone: <Smartphone className="h-6 w-6" />,
  Zap: <Zap className="h-6 w-6" />,
  Cake: <Cake className="h-6 w-6" />,
};

export default function PhaseZeroPage() {
  const [checks, setChecks] = useState<SystemCheck[]>([
    {
      name: "Next.js 16",
      description: "App Router with React 19",
      status: "checking",
      icon: <Cpu className="h-5 w-5" />,
    },
    {
      name: "TypeScript 5",
      description: "Full type safety across the project",
      status: "checking",
      icon: <Box className="h-5 w-5" />,
    },
    {
      name: "Tailwind CSS 4",
      description: "Utility-first styling with InventoryOS theme",
      status: "checking",
      icon: <Palette className="h-5 w-5" />,
    },
    {
      name: "shadcn/ui",
      description: "50+ accessible UI components loaded",
      status: "checking",
      icon: <Layout className="h-5 w-5" />,
    },
    {
      name: "Prisma ORM",
      description: "10 tables in SQLite (ready for PostgreSQL migration)",
      status: "checking",
      icon: <Database className="h-5 w-5" />,
    },
    {
      name: "Module Architecture",
      description: "7 business module slots with pharmacy active",
      status: "checking",
      icon: <FolderTree className="h-5 w-5" />,
    },
  ]);

  const modules = getAllModules();

  // Simulate system checks
  useEffect(() => {
    const delays = [300, 500, 700, 900, 1100, 1400];
    delays.forEach((delay, index) => {
      setTimeout(() => {
        setChecks((prev) =>
          prev.map((check, i) =>
            i === index ? { ...check, status: "ready" } : check
          )
        );
      }, delay);
    });
  }, []);

  const readyCount = checks.filter((c) => c.status === "ready").length;
  const progress = (readyCount / checks.length) * 100;
  const allReady = readyCount === checks.length;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Box className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">InventoryOS</h1>
            <p className="text-xs text-muted-foreground">
              A Collection of Inventory Systems
            </p>
          </div>
          <Badge variant="secondary" className="ml-auto">
            Phase 0
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Title Section */}
        <div className="text-center space-y-3">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Environment Setup
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Setting up everything you need to start building. Once all systems
            are green, we are ready for Phase 1 — the landing page.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">System Check</span>
            <span className="font-medium">
              {readyCount}/{checks.length} Ready
            </span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* System Checks Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {checks.map((check) => (
            <Card
              key={check.name}
              className={`transition-all duration-500 ${
                check.status === "ready"
                  ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
                  : check.status === "error"
                  ? "border-destructive/50 bg-red-50/50 dark:bg-red-950/20"
                  : "border-muted animate-pulse"
              }`}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div
                  className={`mt-0.5 ${
                    check.status === "ready"
                      ? "text-green-600"
                      : check.status === "error"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {check.status === "ready" ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    check.icon
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm">{check.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {check.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Business Modules */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold">Business Modules</h3>
            <Badge variant="outline" className="text-xs">
              1 Active / 7 Total
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Each business type is a self-contained module. Only Pharmacy is
            active now — others will be enabled as we build them.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {modules.map((mod) => (
              <Card
                key={mod.slug}
                className={`relative overflow-hidden transition-all hover:shadow-md ${
                  mod.isActive
                    ? "border-2"
                    : "border-dashed opacity-60 hover:opacity-80"
                }`}
                style={
                  mod.isActive
                    ? { borderColor: mod.color }
                    : undefined
                }
              >
                <CardContent className="p-4 text-center space-y-2">
                  <div
                    className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: mod.color }}
                  >
                    {iconMap[mod.icon] || (
                      <Box className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{mod.name}</p>
                    {!mod.isActive && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] mt-1"
                      >
                        Coming Soon
                      </Badge>
                    )}
                    {mod.isActive && (
                      <Badge
                        className="text-[10px] mt-1 text-white"
                        style={{ backgroundColor: mod.color }}
                      >
                        Active
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* Database Schema Summary */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Database Schema</h3>
          <p className="text-sm text-muted-foreground">
            10 tables created in SQLite. Ready for PostgreSQL migration when
            deploying to BDIX VPS.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {[
              "BusinessType",
              "User",
              "Business",
              "BusinessUser",
              "Category",
              "Product",
              "Inventory",
              "Transaction",
              "OtpVerification",
              "Session",
            ].map((table) => (
              <div
                key={table}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border"
              >
                <Database className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs font-mono font-medium truncate">
                  {table}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Project Structure */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Project Structure</h3>
          <Card>
            <CardContent className="p-4">
              <pre className="text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed">
                {`src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (InventoryOS theme)
│   ├── page.tsx            # Home page (this page)
│   ├── globals.css         # Tailwind + InventoryOS theme vars
│   └── api/                # API route handlers
├── components/
│   ├── ui/                 # 50+ shadcn/ui components
│   ├── shared/             # Shared business components
│   └── layout/             # Layout components (header, footer)
├── modules/                # Business-type modules (plugin architecture)
│   ├── pharmacy/           # ✅ Active module
│   │   ├── routes/         # Pharmacy API routes
│   │   ├── components/     # Pharmacy-specific UI
│   │   ├── services/       # Pharmacy business logic
│   │   ├── types/          # Pharmacy type definitions
│   │   └── schema/         # Pharmacy DB extensions
│   ├── grocery/            # 🔒 Coming soon
│   ├── restaurant/         # 🔒 Coming soon
│   ├── cctv/               # 🔒 Coming soon
│   ├── mobile/             # 🔒 Coming soon
│   ├── electric/           # 🔒 Coming soon
│   └── bakery/             # 🔒 Coming soon
├── lib/
│   ├── db.ts               # Prisma client instance
│   ├── auth.ts             # Password hashing, OTP, session utils
│   ├── modules.ts          # Business module registry
│   └── utils.ts            # cn(), formatTaka(), formatDate()
├── types/
│   ├── business-module.ts  # Module interface & shared types
│   └── index.ts            # Type barrel export
└── prisma/
    └── schema.prisma       # 10-table database schema`}
              </pre>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Next Phase CTA */}
        <div
          className={`text-center space-y-4 py-8 transition-all duration-700 ${
            allReady ? "opacity-100" : "opacity-40"
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm">
            {allReady ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Phase 0 Complete — All Systems Operational
              </>
            ) : (
              <>
                <Cpu className="h-4 w-4 animate-spin" />
                Setting up environment...
              </>
            )}
          </div>
          {allReady && (
            <div className="space-y-3">
              <h3 className="text-2xl font-bold">
                Ready for Phase 1: Landing Page
              </h3>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Next.js, TypeScript, Tailwind, shadcn/ui, Prisma — everything
                is loaded and configured. Time to build the landing page that
                introduces InventoryOS to the world.
              </p>
              <Button size="lg" className="gap-2 mt-4">
                Start Phase 1
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card/50 mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          InventoryOS — A Collection of Inventory Systems • Phase 0 Setup
        </div>
      </footer>
    </div>
  );
}
