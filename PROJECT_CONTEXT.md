# InventoryOS — Project Context Document

> **Last Updated:** July 2025
> **Version:** 0.9.0 (Active Development)
> **Repo:** https://github.com/sajidchowdhury/inventoryos.git

---

## 1. What is InventoryOS?

InventoryOS is a **multi-tenant, mobile-first inventory management SaaS platform** built for Bangladeshi SMBs. It runs on a single-page Next.js app with a module-based architecture — each business type (CCTV Shop, Pharmacy) gets its own tailored module with a shared auth, subscription, and admin layer.

**Tagline:** *One app. Every shop. Smart inventory.*

**Target Market:** Bangladesh retail businesses — CCTV/security shops, pharmacies, and future verticals (electronics, grocery, etc.)

**Key Differentiators:**
- Serial-item tracking (unique per-unit identification for high-value goods)
- Bangladesh NBR/VAT compliance (Mushak 6.3 invoices, Mushak 9.1 monthly returns)
- Bengali Taka (BDT/৳) native currency throughout
- Offline-first resilience (IndexedDB cache + mutation queue)
- Mobile-first 480px-max shell design
- Multi-branch inventory with inter-branch transfers

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 (strict) |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York) |
| **State** | Zustand (client) + URL-based navigation |
| **Database** | SQLite via Prisma 6 ORM |
| **Auth** | Phone OTP + session tokens (NextAuth-style, custom) |
| **Animation** | Framer Motion |
| **Icons** | Lucide React |
| **Offline** | idb (IndexedDB wrapper), localStorage fallback |
| **Deployment** | Caddy reverse proxy, single-port gateway |

---

## 3. Architecture

### 3.1 Module System
```
src/app/page.tsx → Auth Flow → ModuleShellRenderer
  ├─ CCTV Shop (slug: cctv-shop) → CCTVShell → 40+ views
  ├─ Pharmacy (slug: pharmacy) → PharmacyShell → 30+ views
  └─ Future modules...
```

### 3.2 Navigation
- **CCTV Module:** `useCCTVNavStore` (Zustand) — single-page app with view switching
- Views: `dashboard`, `products`, `sell`, `serial-items`, `stock-in`, `sales-history`, etc.
- `contextId` passed for detail views (e.g., product ID, sale ID)

### 3.3 API Pattern
```
src/app/api/businesses/[id]/cctv/{resource}/route.ts
```
- Dynamic route param: `{ params }: { params: Promise<{ id: string }> }`
- `const { id: businessId } = await params;`
- All APIs return JSON with `{ success: true, ... }` pattern

### 3.4 Database
- Prisma schema: 60+ models across shared + CCTV + Pharmacy
- SQLite file at `prisma/dev.db`
- `import { db } from '@/lib/db'` for all database access

---

## 4. CCTV Shop Module — Feature Map

### Phase 1: Inventory Foundation ✅
| Feature | Status | Description |
|---------|--------|-------------|
| Product Management | ✅ Working | CRUD with categories, brands, SKU, HSN codes |
| Serial Item Tracking | ✅ Working | Unique serial/IMEI per unit, 11 status lifecycle |
| Stock-In (Scanner) | ✅ Working | Barcode/serial scanning wizard, bulk commit |
| Kit/Bundle Builder | ✅ Working | Virtual product bundles with components |
| Multi-Branch | ✅ Working | Branch CRUD, inter-branch transfers |
| Inventory Hub | ⚠️ Hardcoded | Dashboard shows mock data, not real API |

### Phase 2: Operations ✅
| Feature | Status | Description |
|---------|--------|-------------|
| Sales (POS) | ✅ Working | Cart → payment → complete, 5 payment methods |
| Sales History | ✅ Working | List + detail view with payment collection |
| Job Cards | ✅ Working | Repair/service job tracking with parts |
| Technicians | ✅ Working | Tech profiles, performance, commissions |
| EMI Plans | ✅ Working | Installment tracking with collection |
| AMC Contracts | ✅ Working | Annual maintenance contracts, visit logs |

### Phase 3: Customer & Financial ⚠️
| Feature | Status | Description |
|---------|--------|-------------|
| Customer Management | ✅ Working | CRUD, search, tier filtering |
| Loyalty Program | ✅ Working | Points, tiers (Bronze→Platinum), redemption |
| Warranty Tracking | ✅ Working | Claims, expiry alerts, status lifecycle |
| Sales Returns | ❌ Missing | No return flow for CCTV sales |
| Customer Due Book | ❌ Missing | No due collection dashboard |
| Supplier Management | ❌ Missing | Shared API exists, no CCTV UI |
| Purchase Orders | ❌ Missing | No purchase creation flow |
| Ledger Report | ❌ Missing | No financial ledger |
| Other Costing/Expenses | ❌ Missing | No expense tracking |

### Phase 4: Projects & Installation ✅
| Feature | Status | Description |
|---------|--------|-------------|
| Project Management | ✅ Working | Site surveys, camera positions, cable routes |
| Installation Tasks | ✅ Working | Task CRUD with checklists |
| Storage Calculator | ✅ Working | HDD/NVR storage estimation |
| Commission System | ✅ Working | Rules, records, reports |

### Phase 5: Tax Compliance ✅
| Feature | Status | Description |
|---------|--------|-------------|
| NBR/BIN Setup | ✅ Working | Tax configuration, HS code mapping |
| Mushak 6.3 Invoice | ✅ Working | VAT tax invoice generation |
| Mushak Registers 6.1/6.2 | ✅ Working | Purchase & sales registers |
| Mushak 9.1 VAT Return | ✅ Working | Monthly return with auto-calculation |

### Phase 7: Resilience & Insights
| Feature | Status | Description |
|---------|--------|-------------|
| Offline-First | ✅ Working | IndexedDB cache, mutation queue, auto-sync |
| Cloud Dashboard | ✅ Working | Read-only stats overview |
| Thermal Printing | ⚠️ Stub | Component exists, not fully wired |

---

## 5. Design System

### 5.1 CCTV Module Theme
- **Container:** `.cctv-shell-wrap` — max-width 480px, centered, white background
- **Cards:** `bg-white rounded-2xl border border-gray-100 p-4 shadow-sm`
- **Primary CTA:** `bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20`
- **Animation:** `fadeUp` pattern with Framer Motion (opacity 0→1, y 16→0, 0.35s easeOut)
- **Typography:** Inter font, gray-900 headings, gray-600 body
- **Currency:** BDT (৳) with `Number.toLocaleString('en-IN')`

### 5.2 Component Patterns
- All components: `'use client'` + named exports
- Forms: local `useState` for field management, fetch API for submit
- Lists: search + filter + pagination pattern
- Detail views: back button → header → content sections
- Loading: shadcn `Skeleton` components
- Toast: `useToast()` hook for notifications

---

## 6. Business Model

- **Freemium SaaS** with subscription tiers: Free → Pro → Pro AI
- **Per-business** multi-tenancy (one owner, multiple staff)
- **Auth:** Phone OTP login → business selection → module shell
- **Billing:** SSL Commerz integration (Bangladeshi payment gateway)
- **AI Features:** Chat assistant, insights, purchase scanning (token-budgeted)

---

## 7. Database Schema Highlights

### CCTV-Specific Models (Prisma)
| Model | Purpose |
|-------|---------|
| `CCTVProduct` | Product catalog (name, brand, category, pricing) |
| `CCTVSerialItem` | Individual unit tracking (serial, IMEI, status, warranty) |
| `CCTVSerialItemHistory` | Append-only audit log for serial status changes |
| `CCTVCategory` | Product categories with color/icon |
| `CCTVSale` | Sales invoices with customer denormalization |
| `CCTVSaleItem` | Sale line items (product + serial linkage) |
| `CCTVPayment` | Individual payments per sale (split payment support) |
| `CCTVEmiPlan` | Installment plans |
| `CCTVAmcContract` | Annual maintenance contracts |
| `CCTVJobCard` | Repair/service job tracking |
| `CCTVTechnician` | Technician profiles |
| `CCTVProject` | Installation projects with surveys |
| `CCTVBranch` | Multi-branch inventory |
| `CCTVTransfer` | Inter-branch stock transfers |
| `CCTVNbrConfig` | Tax/VAT configuration |
| `CCTVMushakInvoice` | Mushak 6.3 tax invoices |
| `CCTVVatReturn` | Mushak 9.1 monthly VAT returns |
| `CCTVLoyaltyConfig` | Loyalty program settings |
| `CCTVKitDefinition` | Product bundle definitions |

### Shared Models
| Model | Purpose |
|-------|---------|
| `Business` | Tenant with subscription, AI config |
| `User` | Phone-based user accounts |
| `BusinessUser` | Staff accounts with roles |
| `Customer` | Customer master (shared with pharmacy) |
| `Supplier` | Supplier master |
| `Category` | Pharmacy categories |
| `Product` | Pharmacy products |
| `Sale` / `SaleItem` / `Payment` | Pharmacy sales |
| `Purchase` / `PurchaseItem` | Pharmacy purchases |
| `Batch` | Pharmacy batch/expiry tracking |

---

## 8. File Structure

```
src/
├── app/
│   ├── page.tsx                    # Auth flow + module renderer
│   ├── layout.tsx                  # Root layout with fonts
│   └── api/businesses/[id]/
│       ├── cctv/                   # All CCTV API routes (40+ endpoints)
│       │   ├── sales/              # Sales CRUD + payments
│       │   ├── products/           # Product CRUD + serials
│       │   ├── customers/          # Customer CRUD + loyalty
│       │   ├── stock-in/           # Stock-in wizard API
│       │   ├── serial-items/       # Serial item management
│       │   ├── job-cards/          # Job card operations
│       │   ├── projects/           # Project + survey CRUD
│       │   ├── branches/           # Branch + transfer APIs
│       │   ├── kits/               # Kit bundle APIs
│       │   ├── technicians/        # Technician + commission APIs
│       │   ├── emi-plans/          # EMI plan APIs
│       │   ├── amc-contracts/      # AMC contract APIs
│       │   ├── warranties/         # Warranty tracking APIs
│       │   ├── nbr-config/         # Tax config APIs
│       │   ├── mushak-invoices/    # Mushak 6.3 APIs
│       │   ├── mushak-registers/   # Register 6.1/6.2 APIs
│       │   ├── vat-returns/        # Mushak 9.1 APIs
│       │   └── cloud-dashboard/    # Dashboard stats API
│       ├── suppliers/              # Shared supplier APIs
│       ├── customers/              # Shared customer APIs
│       ├── purchases/              # Shared purchase APIs
│       └── sales/                  # Shared pharmacy sales APIs
├── modules/
│   ├── cctv-shop/
│   │   ├── components/             # 50+ React components
│   │   ├── hooks/                  # Custom hooks (useCctvBusinessId)
│   │   └── types/index.ts          # All TypeScript interfaces
│   └── pharmacy/
│       └── components/             # 40+ pharmacy components
├── stores/
│   ├── auth-store.ts               # Auth session state
│   ├── cctv-nav-store.ts           # CCTV navigation state
│   └── offline-store.ts            # Offline status tracking
├── lib/
│   ├── db.ts                       # Prisma client singleton
│   ├── offline-store.ts            # IndexedDB cache + queue
│   ├── offline-sync.ts             # Mutation replay engine
│   ├── use-offline-fetch.ts        # Offline-aware fetch hook
│   ├── modules.ts                  # Module registry
│   ├── module-loader.tsx           # Dynamic shell loader
│   └── utils.ts                    # Utility functions
├── components/ui/                  # shadcn/ui components (30+)
└── hooks/                          # Shared React hooks

prisma/
├── schema.prisma                   # Full database schema (3100+ lines)
└── dev.db                          # SQLite database file
```

---

## 9. Social Media Content Helper

### Elevator Pitch
> "InventoryOS transforms how Bangladeshi shop owners manage their business — from tracking every serial-numbered CCTV camera to generating government VAT returns, all from their phone."

### Key Value Propositions
1. **Serial-Item Intelligence** — Track every individual product by serial number, IMEI, and warranty status
2. **Bangladesh Tax Ready** — Auto-generate Mushak 6.3 invoices and Mushak 9.1 VAT returns compliant with NBR rules
3. **Offline-First** — Keep selling even when the internet drops; syncs automatically when back online
4. **Mobile-Native UX** — Designed for shop owners who work from their phone, not a desktop
5. **Multi-Branch** — Manage stock across multiple locations with instant transfers

### Target Audience Personas
- **Rahim, CCTV Shop Owner** — Runs a 3-branch security shop in Dhaka. Needs serial tracking for warranty claims and VAT compliance for audits.
- **Fatema, Pharmacy Manager** — Manages a busy pharmacy with 2,000+ products. Needs expiry tracking, batch management, and daily sales reports.

### Social Media Post Templates

**Twitter/X:**
> 🇧🇩 Building the future of retail inventory management in Bangladesh.
>
> InventoryOS tracks every serial-numbered product, generates NBR-compliant VAT returns, and works offline.
>
> Built with Next.js, Prisma, and a lot of chai ☕
>
> #BuildInPublic #BangladeshTech #SaaS

**LinkedIn:**
> Proud to share InventoryOS — a multi-tenant inventory management platform designed specifically for Bangladeshi SMBs.
>
> What makes it different:
> ✅ Serial-item tracking for high-value goods (CCTV, electronics)
> ✅ Bangladesh NBR/VAT compliance (Mushak 6.3 & 9.1)
> ✅ Offline-first architecture — sells even without internet
> ✅ Mobile-first design optimized for shop-floor use
>
> The CCTV Shop module alone has 40+ API endpoints, 50+ React components, and tracks products through an 11-state lifecycle (IN_STOCK → SOLD → INSTALLED → WARRANTY_ACTIVE → ...).
>
> Tech: Next.js 16, TypeScript, Prisma, Tailwind CSS, Zustand, Framer Motion, SQLite

**Instagram/Facebook:**
> 🏪 Your shop. Your inventory. Your rules.
>
> InventoryOS helps Bangladeshi shop owners:
> 📦 Track every product by serial number
> 💰 Generate VAT returns in one click
> 📱 Manage everything from your phone
> 🌐 Works even without internet
>
> #InventoryOS #BangladeshBusiness #SmallBusiness #TechForGood

### Hashtags
`#InventoryOS` `#BangladeshTech` `#BuildInPublic` `#SaaS` `#NextJS` `#Prisma` `#RetailTech` `#InventoryManagement` `#BangladeshSME` `#CCTVShop` `#PharmacyManagement` `#VATCompliance` `#NBRBangladesh` `#OfflineFirst` `#MobileFirst`

### Product Screenshots to Highlight
1. **Sales POS** — Clean cart-to-payment flow
2. **Serial Item Scanner** — Barcode/serial scanning with real-time validation
3. **Mushak 9.1 VAT Return** — 7-section color-coded tax form
4. **Dashboard** — Revenue, stock, and task overview
5. **Offline Indicator** — 4-state connection status banner

---

## 10. Current Limitations & Known Gaps

### Missing Features (High Priority)
1. **Supplier Management UI** — Shared API exists, no CCTV component
2. **Purchase Order Flow** — No way to create purchases from suppliers in CCTV module
3. **Sales Returns** — No return/refund flow for CCTV sales
4. **Due Book** — No customer due collection dashboard
5. **Ledger Report** — No financial ledger or day book
6. **Expense Tracking** — No "other costing" feature
7. **Serial Item Picker in Sales** — Backend supports `serialItemId` on sale items, but frontend doesn't collect it

### Technical Debt
1. Some dashboard stats are hardcoded (not API-driven)
2. `CCTVSerialItemsList.tsx` uses mock data
3. No pagination on some list endpoints
4. Sale code sequence not race-condition protected

---

*This document is auto-generated as a project context reference for AI assistants and content creators.*