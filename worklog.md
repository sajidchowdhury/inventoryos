---
Task ID: 1
Agent: Main Agent
Task: Store implementation plan & implement 1A Serialized Inventory Schema

Work Log:
- Read and parsed the InventoryOS_CCTV_Shop_Module_Implementation_Plan.docx (7-phase, 33-segment plan)
- Copied plan document to /home/z/my-project/docs/ for project reference
- Analyzed existing Prisma schema: 60+ models, found pre-existing CCTVCategory, CCTVProduct, CCTVSerialItem (3 stub models)
- Enhanced CCTVSerialItem with 15+ new fields per spec:
  - Identification: imei (for phones), enhanced serialNumber
  - Status lifecycle: 10 states (IN_STOCK, SOLD, IN_REPAIR, RETURNED, WARRANTY_ACTIVE, WARRANTY_EXPIRED, DEFECTIVE, DISPOSED, IN_TRANSIT, INSTALLED)
  - Physical condition: grade (A/B/C/D), conditionNotes
  - Procurement: purchaseId, supplierId, purchaseDate
  - Warranty: warrantyMonths, warrantyStart, warrantyEnd
  - Location: branchId (for 1D multi-branch), currentLocation
  - Project reference: projectId (for Phase 4 CCTV projects)
- Created CCTVSerialItemHistory model (append-only audit log with fromStatus, toStatus, event, userId, referenceId, referenceType, notes)
- Created CCTVKitDefinition model (virtual bundles with name, slug, kitPrice, discountPercent)
- Created CCTVKitComponent model (links products to kits with quantity, isRequired, componentLabel)
- Added all reverse relations on Business and CCTVProduct models
- Changed provider from postgresql to sqlite for local sandbox compatibility
- Removed @db.Text PostgreSQL-specific annotations (AiConfig model)
- Successfully ran `bun run db:push` — all 7 tables created in SQLite

Stage Summary:
- Implementation plan stored at docs/InventoryOS_CCTV_Shop_Module_Implementation_Plan.docx
- 4 CCTV models now in schema: CCTVCategory (existing), CCTVProduct (existing), CCTVSerialItem (enhanced), CCTVSerialItemHistory (new), CCTVKitDefinition (new), CCTVKitComponent (new)
- Database schema pushed and Prisma client regenerated
- No git push/commit per user instruction
