const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  TableOfContents, LevelFormat,
} = require("docx");
const fs = require("fs");

// ── Palette: Tech Startup (Cool + Light + Active) ──
const P = {
  primary: "#0B1D3A",
  body: "#1A2332",
  secondary: "#5A6B80",
  accent: "#2563EB",
  surface: "#EFF6FF",
  coverBg: "#0B1D3A",
  coverAccent: "#3B82F6",
  coverTitle: "#FFFFFF",
  coverSubtitle: "#93C5FD",
  coverMeta: "#CBD5E1",
};

const c = (hex) => hex.replace("#", "");

// ── Helpers ──
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 360 : 240, after: 120 },
    children: [new TextRun({ text, bold: true, color: c(P.primary), font: { ascii: "Calibri", eastAsia: "SimHei" } })],
  });
}

function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri", eastAsia: "SimSun" } })],
  });
}

function bodyBold(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 120 },
    children: [new TextRun({ text, size: 24, color: c(P.body), bold: true, font: { ascii: "Calibri", eastAsia: "SimSun" } })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { line: 312, after: 60 },
    children: [new TextRun({ text, size: 24, color: c(P.body), font: { ascii: "Calibri" } })],
  });
}

function makeTable(headers, rows) {
  const borderStyle = { style: BorderStyle.SINGLE, size: 2, color: c(P.accent) };
  const lightBorder = { style: BorderStyle.SINGLE, size: 1, color: "D0D0D0" };
  const noBorder = { style: BorderStyle.NONE, size: 0 };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: borderStyle,
      bottom: borderStyle,
      left: noBorder,
      right: noBorder,
      insideHorizontal: lightBorder,
      insideVertical: noBorder,
    },
    rows: [
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: headers.map(h =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 21, color: c(P.primary) })] })],
            shading: { type: ShadingType.CLEAR, fill: c(P.surface) },
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
          })
        ),
      }),
      ...rows.map(row =>
        new TableRow({
          cantSplit: true,
          children: row.map(cell =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: cell, size: 21, color: c(P.body) })] })],
              margins: { top: 50, bottom: 50, left: 120, right: 120 },
            })
          ),
        })
      ),
    ],
  });
}

// ── Cover (R4-style: Top Color Block) ──
function buildCover() {
  const coverRows = [];

  // Top color block (60% of page)
  coverRows.push(
    new TableRow({
      height: { value: 9600, rule: "exact" },
      children: [
        new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: c(P.coverBg) },
          verticalAlign: "top",
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          children: [
            new Paragraph({ spacing: { before: 2800 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { line: 900, lineRule: "atLeast" },
              children: [new TextRun({ text: "InventoryOS", size: 72, bold: true, color: c(P.coverTitle), font: { ascii: "Calibri" } })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, line: 480, lineRule: "atLeast" },
              children: [new TextRun({ text: "A Collection of Inventory Systems", size: 32, color: c(P.coverSubtitle), font: { ascii: "Calibri" } })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100 },
              children: [new TextRun({ text: "Technical Blueprint & Implementation Plan", size: 24, color: c(P.coverMeta), font: { ascii: "Calibri" } })],
            }),
          ],
        }),
      ],
    })
  );

  // Bottom white block
  coverRows.push(
    new TableRow({
      height: { value: 7238, rule: "exact" },
      children: [
        new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          verticalAlign: "top",
          borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
          children: [
            new Paragraph({ spacing: { before: 1200 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [new TextRun({ text: "Phase-by-Phase Development Roadmap", size: 22, color: c(P.secondary), font: { ascii: "Calibri" } })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [new TextRun({ text: "BDIX VPS Deployment Strategy", size: 22, color: c(P.secondary), font: { ascii: "Calibri" } })],
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
              children: [new TextRun({ text: "Full Tech Stack & Architecture Design", size: 22, color: c(P.secondary), font: { ascii: "Calibri" } })],
            }),
            new Paragraph({ spacing: { before: 600 } }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "June 2026", size: 22, color: c(P.secondary), font: { ascii: "Calibri" } })],
            }),
          ],
        }),
      ],
    })
  );

  return coverRows;
}

// ── Build Document ──
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Calibri", eastAsia: "Microsoft YaHei" }, size: 24, color: c(P.body) },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 32, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 360, after: 160, line: 312 } },
      },
      heading2: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 28, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 240, after: 120, line: 312 } },
      },
      heading3: {
        run: { font: { ascii: "Calibri", eastAsia: "SimHei" }, size: 24, bold: true, color: c(P.primary) },
        paragraph: { spacing: { before: 200, after: 100, line: 312 } },
      },
    },
  },
  numbering: {
    config: [
      {
        reference: "phase-list",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      },
      {
        reference: "risk-list",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      },
    ],
  },
  sections: [
    // ── Section 1: Cover ──
    {
      properties: {
        page: { margin: { top: 0, bottom: 0, left: 0, right: 0 }, size: { width: 11906, height: 16838 } },
      },
      children: [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: buildCover(),
        }),
      ],
    },
    // ── Section 2: TOC ──
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "InventoryOS Blueprint", size: 18, color: c(P.secondary) })] })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) })] })],
        }),
      },
      children: [
        new Paragraph({
          spacing: { after: 300 },
          children: [new TextRun({ text: "Table of Contents", size: 32, bold: true, color: c(P.primary), font: { ascii: "Calibri" } })],
        }),
        new TableOfContents("Table of Contents", {
          hyperlink: true,
          headingStyleRange: "1-3",
        }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: "Right-click the Table of Contents and select \"Update Field\" to refresh page numbers.", italics: true, size: 20, color: "888888" })],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },
    // ── Section 3: Body ──
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "InventoryOS Blueprint", size: 18, color: c(P.secondary) })] })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary) })] })],
        }),
      },
      children: [
        // ── 1. Executive Summary ──
        heading("1. Executive Summary"),
        body("InventoryOS is a multi-business inventory management platform designed specifically for small and medium-sized retail businesses across Bangladesh. Unlike monolithic inventory solutions that force every business into the same workflow, InventoryOS adopts a collection-based approach: one unified platform that offers business-type-specific inventory modules, each tailored to the unique needs of grocery shops, pharmacies, CCTV shops, electric shops, mobile shops, bakeries, and restaurants. This approach allows business owners to select only the module that fits their operation, eliminating unnecessary complexity while maintaining a consistent, easy-to-learn interface across all modules."),
        body("The platform begins with a Pharmacy System as its Minimum Viable Product (MVP), with other business types queued for future development. The technical architecture is built on Next.js 16 with App Router, TypeScript, Tailwind CSS 4, shadcn/ui components, Prisma ORM, and PostgreSQL, all deployed on a BDIX VPS with 80GB storage using Docker Compose and Nginx. The design philosophy prioritizes mobile-first accessibility and simplicity so intuitive that even a person with an 8th-grade education can navigate the system without difficulty. Authentication is phone-number-first, allowing users to discover existing businesses linked to their number before creating new ones, with per-business credentials for multi-business owners."),
        body("This document provides the complete technical blueprint, including user flow design, technology stack justification, database schema, API structure, folder organization, a five-phase implementation roadmap, deployment strategy, UX principles, and risk mitigation plans. It serves as the authoritative reference for the development team throughout the project lifecycle."),

        // ── 2. Project Vision & Problem Statement ──
        heading("2. Project Vision & Problem Statement"),
        heading("2.1 The Problem", HeadingLevel.HEADING_2),
        body("Small retail businesses in Bangladesh, from neighborhood grocery stores to local pharmacies, operate with minimal digital infrastructure. Most rely on handwritten ledgers, mental stock calculations, or at best, a basic spreadsheet that only the owner understands. When a pharmacy needs to track expiry dates across hundreds of medicines, or a restaurant needs to manage perishable ingredients with rotating menus, these manual systems break down silently. Stockouts cost sales, expired products risk health violations, and theft goes unnoticed. Existing inventory software solutions are either too expensive, too complex, or designed for Western business models that do not map onto the realities of a Bangladeshi roadside pharmacy or a small-town mobile phone shop."),
        body("The core problem is not a lack of technology but a lack of appropriate technology. Business owners do not need a Swiss-army-knife enterprise resource planning system. They need a simple tool that understands their specific business, speaks their language (both literally and figuratively), and works on the smartphone they already carry in their pocket. The learning curve must be near-zero because these owners cannot afford to spend days training themselves or their staff on complex software."),

        heading("2.2 The InventoryOS Solution", HeadingLevel.HEADING_2),
        body("InventoryOS addresses this gap with a collection-based architecture. Instead of building one generic inventory system and trying to make it fit every business, we build a family of specialized inventory modules, each designed from the ground up for a specific business type. A pharmacy module understands medicine categories, batch numbers, expiry tracking, and GST/VAT compliance. A restaurant module understands recipes, ingredient linking, daily preparation lists, and waste tracking. A mobile shop module tracks IMEI numbers, warranty periods, and accessory bundling. Each module is a focused application, not a watered-down version of something bigger."),
        body("What ties these modules together is the unified platform layer. Users visit one website, identify their business type, and are seamlessly routed to the appropriate module. The authentication system is phone-number-centric, reflecting how people in Bangladesh primarily identify themselves digitally. Multi-business owners, who might run both a pharmacy and a grocery store, can manage both under a single phone number with separate credentials per business. The interface is designed to be colorful, inviting, and so straightforward that even someone with minimal formal education can operate it confidently on a mobile phone screen."),

        // ── 3. User Flow & Authentication Design ──
        heading("3. User Flow & Authentication Design"),
        heading("3.1 Complete User Journey", HeadingLevel.HEADING_2),
        body("The user journey is designed to minimize friction at every step. When a visitor arrives at the InventoryOS website, they first encounter a clean, visually engaging landing page that explains in simple terms what the platform does and who it serves. Icons and short descriptions for each business type (grocery, pharmacy, CCTV, electric, mobile, bakery, restaurant) make it immediately clear that this platform offers something tailored for their specific needs. A prominent call-to-action button invites them to get started."),
        body("Upon clicking the call-to-action, the user is asked to provide their mobile phone number. This is the single entry point for both registration and login, eliminating the confusion of having separate sign-up and sign-in flows. The phone number serves as the universal identifier. After submitting the phone number, the system performs a lookup to check whether any businesses are already registered under that number. This lookup result determines the next step in the flow and creates two distinct paths that the system must handle gracefully."),

        heading("3.2 Path A: No Existing Business", HeadingLevel.HEADING_2),
        body("When the phone number lookup returns no registered businesses, the user sees an empty business list with a friendly message like \"No businesses found linked to this number\" and an \"Add Business\" button. Clicking this button reveals the business selection screen, which displays all supported business types as large, colorful cards. Only the Pharmacy card is currently active and clickable; all other business types (grocery, CCTV, electric, mobile, bakery, restaurant) are visible but grayed out with a \"Coming Soon\" badge, giving users confidence that the platform will grow to support their needs."),
        body("After selecting a business type, the user fills in basic business details such as business name, owner name, and address. Upon submission, the system creates the business record and prompts the user to set up their admin credentials: a username and password for this specific business. It is critical to emphasize that these credentials are scoped to this business only. If the same user later adds a second business, they will create a separate set of credentials for that business. This per-business credential model ensures that a staff member managing one business cannot accidentally access another business under the same phone number, which is essential for owners who might operate multiple businesses with different trusted employees."),

        heading("3.3 Path B: Existing Business(es) Found", HeadingLevel.HEADING_2),
        body("When the phone number lookup returns one or more registered businesses, the user sees a list displaying each business name, business type, and a visual icon. If they already have credentials set up for a particular business, they can select that business and proceed to log in with their username and password. If they want to add another business, an \"Add Business\" button at the bottom of the list allows them to do so, following the same flow as Path A. This design accommodates the common scenario where a shop owner expands into a second line of business and needs to manage both inventories separately."),
        body("An important design consideration is the case where a business exists but has not yet set up credentials (for example, if the business was created by another method or during a soft launch). In this scenario, the business appears in the list with a \"Set Up Login\" button instead of a login prompt, guiding the user through the credential creation flow. This prevents the dead-end situation where a user sees their business but has no way to access it."),

        heading("3.4 Authentication Simplification Strategy", HeadingLevel.HEADING_2),
        body("To reduce complexity and improve security, we implement several simplification strategies. First, we use phone-based OTP (One-Time Password) verification during the initial setup instead of email verification, since nearly all target users in Bangladesh have mobile phones but not necessarily email accounts. Second, we offer a \"remember this device\" option after successful login, using a secure refresh token stored in an HTTP-only cookie, so users do not need to enter credentials every time on their own device. Third, we provide a password reset flow via OTP to the registered phone number, eliminating the need for security questions or email-based resets that many users find confusing. Fourth, we consider biometric authentication (fingerprint or face recognition) as a future enhancement, leveraging the Web Authentication API supported by modern mobile browsers, which would allow users to log in with a single touch."),

        // ── 4. Technology Stack Recommendation ──
        heading("4. Technology Stack Recommendation"),
        body("The technology stack is chosen to maximize developer productivity, ensure long-term maintainability, and operate efficiently within the constraints of a BDIX VPS with 80GB storage. Every component has been selected with a specific justification that balances capability against resource consumption."),
        makeTable(
          ["Layer", "Technology", "Justification"],
          [
            ["Frontend Framework", "Next.js 16 (App Router)", "Server-side rendering for fast initial loads, file-based routing, API routes in the same codebase, and built-in optimization for mobile-first design"],
            ["Language", "TypeScript", "Type safety catches bugs at compile time, self-documenting code, and superior IDE support that accelerates development"],
            ["Styling", "Tailwind CSS 4", "Utility-first CSS that produces minimal bundle sizes, responsive design out of the box, and rapid prototyping without context-switching to separate CSS files"],
            ["UI Components", "shadcn/ui", "Accessible, customizable components built on Radix UI primitives that look professional without requiring a design team"],
            ["ORM", "Prisma", "Type-safe database queries, auto-generated types from schema, migration management, and excellent PostgreSQL support"],
            ["Database", "PostgreSQL", "Rock-solid reliability, JSON support for flexible data, row-level security for multi-tenancy, and efficient storage that fits 80GB budget"],
            ["Caching/Sessions", "Redis", "In-memory store for session tokens, OTP rate limiting, and frequently accessed data like business type configurations"],
            ["Containerization", "Docker Compose", "One-command deployment, reproducible environments, easy service orchestration, and simplified updates"],
            ["Reverse Proxy", "Nginx", "SSL termination, static asset serving, load balancing preparation, and efficient request routing"],
            ["SSL Certificates", "Let's Encrypt / Certbot", "Free, automated SSL certificates that renew automatically, essential for HTTPS and PWA support"],
          ]
        ),
        body("The combination of Next.js and PostgreSQL provides a powerful yet lean full-stack framework. Next.js API routes eliminate the need for a separate backend server, reducing memory footprint and deployment complexity. PostgreSQL handles the multi-tenant data model with row-level security policies that ensure complete data isolation between businesses. Redis, while optional in Phase 1, becomes essential for performance as user count grows, handling session management and caching hot data like business configurations and inventory summaries."),

        // ── 5. Database Architecture & Schema Design ──
        heading("5. Database Architecture & Schema Design"),
        heading("5.1 Multi-Tenant Strategy", HeadingLevel.HEADING_2),
        body("InventoryOS employs a shared-database, shared-schema multi-tenancy model with row-level isolation. All businesses share the same database and tables, but every query is scoped to a specific business through a mandatory business_id foreign key and enforced by application-level checks. This approach minimizes storage overhead (critical for the 80GB VPS constraint), simplifies cross-business analytics for the platform operator, and allows new businesses to be onboarded instantly without provisioning new schema. Row-level security policies in PostgreSQL provide an additional defense layer, ensuring that even a direct database query cannot leak data across business boundaries."),

        heading("5.2 Core Schema Entities", HeadingLevel.HEADING_2),
        makeTable(
          ["Entity", "Key Fields", "Purpose"],
          [
            ["users", "id, phone, name, created_at", "Platform-level user identified by phone number. A user can own multiple businesses."],
            ["business_types", "id, slug, name, icon, is_active", "Registry of supported business types (pharmacy, grocery, etc.). is_active controls availability."],
            ["businesses", "id, user_id, business_type_id, name, address, phone, created_at", "A specific business registered under a user. Links to business_type for module routing."],
            ["business_users", "id, business_id, username, password_hash, role, is_active", "Per-business login credentials. Each business has its own set of usernames and passwords."],
            ["categories", "id, business_id, parent_id, name, type", "Product/stock categories scoped per business. Supports hierarchical nesting via parent_id."],
            ["products", "id, business_id, category_id, name, sku, unit, created_at", "Base product table. Extended by business-type-specific tables via polymorphic association."],
            ["inventory", "id, business_id, product_id, quantity, min_stock, unit_cost", "Current stock levels, minimum stock alerts, and cost tracking per product."],
            ["transactions", "id, business_id, product_id, type, quantity, note, created_at", "Stock in/out movements. Type enum: PURCHASE, SALE, ADJUSTMENT, WASTE, RETURN."],
          ]
        ),

        heading("5.3 Business-Type Extension Tables", HeadingLevel.HEADING_2),
        body("Each business type extends the base product and inventory tables with specialized fields through a polymorphic association pattern. Rather than cluttering the base tables with nullable columns that only apply to one business type, we use separate extension tables that reference the base product. This keeps the core schema clean and allows each business module to define only the fields it needs."),
        makeTable(
          ["Extension Table", "Business Type", "Key Additional Fields"],
          [
            ["pharmacy_products", "Pharmacy", "generic_name, batch_no, manufacturer, expiry_date, hsn_code, mrp, gst_rate, schedule_type, rack_no"],
            ["grocery_products", "Grocery", "barcode, brand, weight_unit, weight_value, wholesale_price, retail_price, is_perishable, shelf_life_days"],
            ["restaurant_products", "Restaurant", "recipe_yield, prep_time_mins, allergens, is_ingredient, menu_category, selling_price"],
            ["cctv_products", "CCTV", "model_no, brand, resolution, lens_type, warranty_months, installation_type, compatible_dvr"],
            ["mobile_products", "Mobile Shop", "imei_number, brand, model, color, ram, storage, warranty_months, purchase_invoice_no"],
            ["electric_products", "Electric Shop", "brand, model, wattage, voltage, certification, warranty_months, wire_length_meters"],
            ["bakery_products", "Bakery", "recipe_id, production_date, best_before_days, allergens, selling_price, is_custom_order"],
          ]
        ),
        body("This extension pattern means that adding a new business type to the platform requires creating a new extension table and the corresponding module code, without modifying any existing tables or code. The base product and inventory system remains untouched, and existing business modules continue to function exactly as before. This is the key architectural enabler for the collection-based approach."),

        // ── 6. API Design & Folder Structure ──
        heading("6. API Design & Folder Structure"),
        heading("6.1 RESTful API Routes", HeadingLevel.HEADING_2),
        body("The API follows RESTful conventions with clear resource naming and HTTP method semantics. All business-scoped routes require a business context (identified via the authenticated session), ensuring complete data isolation. The following table summarizes the primary API route groups and their functions."),
        makeTable(
          ["Route Group", "Endpoints", "Description"],
          [
            ["Authentication", "POST /api/auth/phone, POST /api/auth/verify-otp, POST /api/auth/login, POST /api/auth/logout, POST /api/auth/reset-password", "Phone-based authentication flow with OTP verification and per-business login"],
            ["Businesses", "GET /api/businesses?phone=..., POST /api/businesses, GET /api/businesses/:id, PUT /api/businesses/:id", "CRUD operations for businesses linked to the authenticated user's phone number"],
            ["Business Users", "POST /api/businesses/:id/users, PUT /api/businesses/:id/users/:userId, DELETE /api/businesses/:id/users/:userId", "Manage per-business credentials and roles (admin, manager, staff)"],
            ["Categories", "GET /api/businesses/:id/categories, POST /api/businesses/:id/categories, PUT /api/businesses/:id/categories/:catId", "Product category management scoped to a specific business"],
            ["Products (Base)", "GET /api/businesses/:id/products, POST /api/businesses/:id/products, PUT /api/businesses/:id/products/:prodId", "Base product CRUD, extended by business-type-specific endpoints"],
            ["Inventory", "GET /api/businesses/:id/inventory, PATCH /api/businesses/:id/inventory/:itemId, GET /api/businesses/:id/inventory/low-stock", "Stock level management, adjustments, and low-stock alert queries"],
            ["Transactions", "GET /api/businesses/:id/transactions, POST /api/businesses/:id/transactions, GET /api/businesses/:id/transactions/report", "Stock movement logging and reporting with date range filters"],
            ["Pharmacy Module", "GET /api/businesses/:id/pharmacy/products, POST /api/businesses/:id/pharmacy/products, GET /api/businesses/:id/pharmacy/expiring", "Pharmacy-specific product fields, expiry tracking, and batch management"],
          ]
        ),

        heading("6.2 Project Folder Structure", HeadingLevel.HEADING_2),
        body("The folder structure enforces a modular, plugin-based architecture. Each business type lives in its own self-contained directory with its routes, components, database extensions, and business logic. Adding a new business module means creating a new directory under /modules and registering it in the module registry, without touching any existing code."),
        makeTable(
          ["Directory", "Contents", "Purpose"],
          [
            ["/app", "layout.tsx, page.tsx, (auth)/, (dashboard)/", "Next.js App Router pages and layouts. Route groups for auth vs dashboard"],
            ["/app/api", "auth/, businesses/, inventory/, transactions/", "API route handlers following Next.js convention"],
            ["/modules", "pharmacy/, grocery/, restaurant/, cctv/, mobile/, electric/, bakery/", "Self-contained business modules. Each has: routes/, components/, services/, types/, schema/"],
            ["/modules/pharmacy", "routes/, components/, services/, types/, schema/", "Example module: pharmacy routes (expiry alerts, batch mgmt), UI components, business logic, TypeScript types, Prisma extension schema"],
            ["/components", "ui/, shared/, layout/", "shadcn/ui components, shared business components (stock table, transaction form), layout shell"],
            ["/lib", "db.ts, auth.ts, redis.ts, utils.ts", "Database client (Prisma), auth utilities, Redis client, helper functions"],
            ["/prisma", "schema.prisma, migrations/, seed.ts", "Prisma schema with all tables, migration history, seed data for development"],
            ["/docker", "docker-compose.yml, Dockerfile, nginx.conf", "Docker and Nginx configuration for deployment"],
            ["/types", "index.d.ts, business-module.d.ts", "Global TypeScript type definitions and business module interface contracts"],
          ]
        ),
        body("The module registry pattern is the architectural linchpin. Each module exports a standard interface (name, slug, icon, isActive, routes, menuItems, dashboardWidgets) that the platform core consumes dynamically. When a user selects their business type, the platform loads only the relevant module's routes and components, keeping the bundle size small and the interface focused. This lazy-loading approach is critical for mobile performance, where every kilobyte of JavaScript affects load time on slow 3G connections common in parts of Bangladesh."),

        // ── 7. Phase-by-Phase Implementation Roadmap ──
        heading("7. Phase-by-Phase Implementation Roadmap"),
        body("The project is divided into five phases, each delivering a functional increment that can be deployed and tested independently. This phased approach reduces risk, allows early user feedback, and ensures that the team is always building on a solid foundation rather than constructing an elaborate structure on uncertain ground."),

        heading("7.1 Phase 1: Foundation (Weeks 1-4)", HeadingLevel.HEADING_2),
        body("Phase 1 establishes the platform's core infrastructure and the complete user authentication flow. At the end of this phase, a user can visit the website, see the landing page with business type explanations, enter their phone number, discover existing businesses or add a new one, set up credentials, log in, and see a dashboard that confirms they are authenticated. While the dashboard itself will be minimal (a welcome message, business name, and a \"Logged In\" confirmation), the entire authentication pipeline, session management, and business scoping must be production-ready. This includes phone number OTP verification (using an SMS provider like BulkSMSBD or Twilio), the per-business credential system, session token management with Redis, and the business-type selection UI with active/inactive states."),
        body("Key deliverables for Phase 1 include: a responsive landing page with business type cards; phone number input with OTP verification; business discovery and creation flow; per-business username/password setup; login and session management; a shell dashboard page; Docker Compose setup for local development; Prisma schema for all core tables (users, businesses, business_users, business_types); and a CI/CD pipeline for automated testing and deployment."),

        heading("7.2 Phase 2: Pharmacy MVP (Weeks 5-10)", HeadingLevel.HEADING_2),
        body("Phase 2 builds the complete Pharmacy Inventory Module on top of the Phase 1 foundation. This is the first business-specific module and serves as the template for all future modules. Every design decision made here should consider how it generalizes to other business types, but the implementation must be pharmacy-specific, not generic. The pharmacy module must include: medicine product management with batch numbers and manufacturer tracking; expiry date monitoring with automatic alerts (30-day, 15-day, and 7-day warnings); stock in/out transactions with reason codes (purchase, sale, adjustment, waste, return); category management for organizing medicines by therapeutic class; low-stock alerts with configurable minimum thresholds; a dashboard with key metrics (total items, items expiring soon, low-stock count, today's transactions); and basic reporting (daily stock summary, monthly transaction report, expiry report)."),
        body("The UI for the pharmacy module must be exceptionally clean and mobile-optimized. Pharmacists in Bangladesh often manage inventory on their phones between serving customers. Large touch targets, clear visual indicators for critical states (red for expiring, orange for low stock, green for healthy), and a one-tap stock adjustment flow are essential. The transaction entry form should require no more than three taps to record a sale or a purchase."),

        heading("7.3 Phase 3: Architecture Hardening (Weeks 11-13)", HeadingLevel.HEADING_2),
        body("Before adding more business modules, Phase 3 focuses on hardening the platform architecture based on lessons learned from the Pharmacy MVP. This includes: implementing the module registry pattern that enables dynamic loading of business-type modules; adding role-based access control (admin, manager, staff) with different permission levels per business; implementing row-level security in PostgreSQL for defense-in-depth data isolation; adding database-level audit logging for all data changes; setting up automated daily database backups to a secondary storage location; implementing rate limiting and abuse prevention on all API endpoints; adding comprehensive error handling and user-friendly error messages in Bengali and English; and conducting a security audit of the authentication and session management system."),
        body("This phase is deliberately positioned between the first module and subsequent modules. The pharmacy implementation will inevitably reveal architectural assumptions that need correction, API patterns that need standardization, and UI components that should be abstracted into shared libraries. Fixing these issues while there is only one module to refactor is far cheaper than trying to refactor across six modules simultaneously."),

        heading("7.4 Phase 4: Additional Business Modules (Weeks 14-24)", HeadingLevel.HEADING_2),
        body("With the hardened architecture in place, Phase 4 adds business modules in priority order: Grocery Shop, Restaurant, Mobile Shop, Bakery, Electric Shop, and CCTV Shop. Each module follows the established pattern: create the business-type extension table in Prisma, implement the module directory with routes/components/services/types/schema, register the module in the platform registry, and activate it in the business type selection UI. The priority order is determined by market demand, module complexity, and the breadth of features that generalize well. Grocery is second because it shares many inventory concepts with pharmacy. Restaurant is third because its recipe-linking feature introduces a new architectural pattern (composite products) that will benefit later modules."),
        body("Each module should be developed in a two-week sprint with the following structure: Week 1 covers schema design, API endpoints, and business logic; Week 2 covers UI implementation, testing, and deployment. A module is not considered complete until it passes a manual usability test with a real business owner from the target segment, who must be able to perform core tasks without any written instructions."),

        heading("7.5 Phase 5: Scale and Polish (Weeks 25-30)", HeadingLevel.HEADING_2),
        body("The final phase focuses on scaling the platform for growth and polishing the user experience. Key initiatives include: implementing multi-language support (Bengali as primary, English as secondary) with a translation management system; adding offline-first capabilities using a Progressive Web App (PWA) architecture with service workers and IndexedDB for local data caching; building a notification system for critical alerts (expiry warnings, low stock, abnormal transaction patterns) via SMS and in-app push notifications; creating an analytics dashboard that provides cross-business insights for platform operators; implementing a subscription and billing system for monetization; adding data export features (CSV, PDF reports) for compliance and record-keeping; and conducting performance optimization to ensure the platform handles thousands of concurrent users on the BDIX VPS infrastructure."),

        // ── 8. Deployment Strategy ──
        heading("8. Deployment Strategy (BDIX VPS)"),
        body("Deployment on the BDIX VPS with 80GB storage requires careful resource allocation and a lean service architecture. The following Docker Compose setup orchestrates all required services within the VPS constraints, with estimated resource allocations to ensure stable operation under expected load."),
        makeTable(
          ["Service", "Docker Image", "Estimated RAM", "Estimated Disk", "Purpose"],
          [
            ["Next.js App", "node:20-alpine", "256-512 MB", "2 GB", "Frontend + API server. Single instance with SSR. Alpine keeps image small."],
            ["PostgreSQL", "postgres:16-alpine", "256-512 MB", "20-30 GB", "Primary database. 20-30GB provides room for data growth. Regular vacuuming."],
            ["Redis", "redis:7-alpine", "64-128 MB", "1 GB", "Session store, OTP cache, rate limiting. Minimal disk, mostly in-memory."],
            ["Nginx", "nginx:alpine", "32-64 MB", "0.5 GB", "Reverse proxy, SSL termination, static asset serving. Very lightweight."],
            ["Certbot", "certbot/certbot", "64 MB", "0.5 GB", "Automated SSL certificate renewal. Runs periodically, not continuously."],
            ["Backup Cron", "alpine:latest", "64 MB", "10 GB", "Daily pg_dump to local + optional remote backup via rclone to cloud storage."],
          ]
        ),
        body("The total estimated resource consumption is 700-1300 MB RAM and 35-45 GB disk, leaving comfortable headroom within the 80GB VPS constraint. PostgreSQL is the primary disk consumer, and its storage requirements should be monitored weekly. When the database approaches 70% of its allocated space, consider archiving old transaction records to compressed backups and implementing table partitioning by date range for the transactions table, which will grow the fastest. Nginx is configured to serve Next.js static assets directly (images, CSS, JS bundles) for better performance, bypassing the Node.js process for these requests. SSL certificates are provisioned automatically via Certbot with a cron job that checks and renews certificates before expiration."),

        heading("8.1 Deployment Workflow", HeadingLevel.HEADING_2),
        body("The deployment workflow follows a Git-based continuous deployment model. All code is stored in a Git repository (GitHub or GitLab). When code is pushed to the main branch, a GitHub Actions (or similar CI/CD) pipeline runs automated tests, builds the Docker images, and deploys to the VPS via SSH. The deployment script on the VPS pulls the latest images, runs database migrations via Prisma, and restarts services with zero downtime using a rolling update strategy. A health check endpoint (/api/health) verifies that all services are operational after each deployment, and failed deployments are automatically rolled back to the last known good state."),

        // ── 9. UX/UI Design Principles ──
        heading("9. UX/UI Design Principles"),
        body("The UX philosophy of InventoryOS is guided by a single principle: if an 8th-grade student cannot figure out how to use a feature within 30 seconds, the design needs to be simplified further. This is not an exaggeration; many of our target users have limited formal education and limited patience for complex interfaces. Every design decision is measured against this standard, and features that fail this test are redesigned or removed."),
        makeTable(
          ["Principle", "Implementation", "Example"],
          [
            ["Mobile-First", "All layouts designed for 360px width first, then enhanced for larger screens. Touch targets minimum 44x44px. No hover-dependent interactions.", "Product list uses large card tiles instead of compact tables; buttons are full-width on mobile."],
            ["Colorful but Professional", "Each business type has a signature color (pharmacy: green, grocery: orange, restaurant: red). Status colors are universal (red=alert, orange=warning, green=ok).", "Pharmacy dashboard uses green accents; expiry alerts are red regardless of business type."],
            ["Progressive Disclosure", "Show only essential information by default. Advanced options are hidden behind expandable sections or secondary screens.", "Stock entry shows only name and quantity by default; batch number and expiry are in an \"Advanced\" collapsible section."],
            ["Bengali Language Support", "All UI text available in Bengali with English fallback. Number formatting follows Bengali conventions where appropriate.", "Dashboard greeting: \"\u09B8\u09CD\u09AC\u09BE\u0997\u09A4\u09AE\" (Swagatam) or \"Welcome\" based on language preference."],
            ["Minimal Cognitive Load", "Maximum 5 items visible at any decision point. Forms have maximum 5 fields per step. Wizards for complex flows.", "Business type selection shows max 7 options with icons; product entry is a 3-step wizard."],
            ["Clear Visual Hierarchy", "Primary actions are large and colored. Secondary actions are smaller and neutral. Destructive actions require confirmation.", "\"Add Stock\" is a large blue button; \"Delete Product\" is small, red, and requires a confirmation dialog."],
          ]
        ),
        body("The shadcn/ui component library provides an excellent foundation for these principles. Its Dialog, Sheet, and Collapsible components map directly to our progressive disclosure needs. The DataTable component handles inventory lists with built-in sorting and pagination. The Alert component handles status notifications. Custom theme tokens in Tailwind ensure consistent spacing, typography, and color usage across all modules while allowing each business module to inject its signature color through CSS custom properties."),

        // ── 10. Risk Analysis & Mitigation ──
        heading("10. Risk Analysis & Mitigation"),
        body("Every project carries risks, and acknowledging them early allows the team to prepare mitigations rather than being caught off guard. The following analysis identifies the most significant risks to the InventoryOS project and provides concrete, actionable mitigation strategies for each."),

        heading("10.1 Scope Creep from Multi-Business Support", HeadingLevel.HEADING_2),
        body("The most dangerous risk is trying to build too many business modules too quickly, each with unique requirements that pull the architecture in different directions. A pharmacy needs expiry tracking; a restaurant needs recipe linking; a CCTV shop needs warranty management. Building all of these simultaneously would fracture the team's focus and produce half-finished modules. The mitigation is strict adherence to the phased roadmap: one module at a time, fully tested with real users, before starting the next. The module registry architecture enforces this naturally, since each module is independent and cannot destabilize others. A module is not started until the previous module is deployed, tested, and stable."),

        heading("10.2 VPS Resource Limits", HeadingLevel.HEADING_2),
        body("With 80GB of storage, the VPS can comfortably handle the initial deployment and moderate growth, but uncontrolled database expansion or memory leaks could exhaust resources. Mitigation includes: implementing database pagination on all queries to prevent loading entire tables into memory; setting up automated monitoring (using a lightweight tool like Prometheus + Grafana or a simpler alternative like Netdata) that alerts when resource usage exceeds 80% thresholds; scheduling weekly database maintenance (VACUUM, REINDEX) to reclaim space and maintain query performance; implementing a data archival strategy that moves transactions older than 2 years to compressed backup files; and configuring Docker container memory limits to prevent any single service from consuming all available RAM."),

        heading("10.3 Data Security and Privacy", HeadingLevel.HEADING_2),
        body("Inventory data is sensitive business information. A breach could expose pricing, supplier relationships, and sales volumes to competitors. Mitigation includes: enforcing HTTPS on all connections via Nginx and Let's Encrypt; implementing row-level security in PostgreSQL as a defense-in-depth measure alongside application-level checks; storing passwords using bcrypt with a minimum cost factor of 12; using HTTP-only, Secure, SameSite cookies for session tokens; implementing CSRF protection on all state-changing endpoints; conducting a security review before each phase deployment; and maintaining an incident response plan that includes immediate notification to affected business owners if a breach is detected."),

        heading("10.4 User Adoption Barriers", HeadingLevel.HEADING_2),
        body("Even a perfectly designed system fails if business owners do not use it. Common barriers include: distrust of digital systems, lack of perceived value, fear of complexity, and unreliable internet connectivity. Mitigation includes: building a PWA with offline capabilities so the app works even when connectivity is spotty; designing the onboarding flow to demonstrate value within the first 60 seconds (e.g., showing how easy it is to record a stock entry); creating short video tutorials in Bengali that walk through common tasks; offering a free tier with no time limit for small businesses (under 100 products); and building a referral system where existing users can invite other business owners, creating organic growth within business communities."),

        heading("10.5 Internet Connectivity Challenges", HeadingLevel.HEADING_2),
        body("Internet connectivity in parts of Bangladesh can be unreliable, especially on mobile networks outside major cities. Since InventoryOS is a web application, connectivity issues could prevent users from accessing their inventory at critical moments. Mitigation includes: implementing a PWA with a service worker that caches the application shell and recently accessed data for offline use; using IndexedDB to store pending transactions locally when offline and syncing them automatically when connectivity returns; designing all forms to save drafts locally before attempting to submit; and optimizing all API responses for minimal payload size, reducing the data required for each operation to work on slow 2G/3G connections."),
      ],
    },
  ],
});

// ── Generate ──
Packer.toBuffer(doc).then((buffer) => {
  const outputPath = "/home/z/my-project/download/InventoryOS_Technical_Blueprint.docx";
  fs.writeFileSync(outputPath, buffer);
  console.log(`Document generated: ${outputPath}`);
  console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
});
