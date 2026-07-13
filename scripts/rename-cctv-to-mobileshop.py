#!/usr/bin/env python3
"""
Phase 1: Rename all CCTV database tables and Prisma models to MobileShop.

This script:
1. Updates prisma/schema.prisma: @@map("cctv_*") -> @@map("mobile_shop_*")
2. Updates prisma/schema.prisma: model CCTV* -> model MS*
3. Updates prisma/schema.prisma: relation fields CCTV*[] -> MS*[]
4. Updates prisma/schema.prisma: relation types CCTV*? -> MS*?
5. Updates prisma/seed.ts: db.cCTV* -> db.mS* (Prisma client naming)
6. Updates all src/ files: db.cCTV* -> db.mS*
7. Updates all src/ files: CCTVViewType -> MSViewType
8. Updates prisma/seed.ts: business type slug cctv-shop -> mobile-shop

Usage: python3 scripts/rename-cctv-to-mobileshop.py
"""

import os
import re
import sys

# ─── Model name mapping: CCTV* -> MS* ───
# The Prisma client generates db.cCTVProduct for model CCTVProduct
# After rename: model MSProduct -> db.mSProduct
MODEL_MAPPINGS = {
    "CCTVCategory": "MSCategory",
    "CCTVMasterProduct": "MSMasterProduct",
    "CCTVProduct": "MSProduct",
    "CCTVSerialItem": "MSSerialItem",
    "CCTVSerialItemHistory": "MSSerialItemHistory",
    "CCTVPurchase": "MSPurchase",
    "CCTVPurchaseItem": "MSPurchaseItem",
    "CCTVSale": "MSSale",
    "CCTVSaleItem": "MSSaleItem",
    "CCTVPayment": "MSPayment",
    "CCTVExpense": "MSExpense",
    "CCTVReturn": "MSReturn",
    "CCTVReturnItem": "MSReturnItem",
    "CCTVWarrantyClaim": "MSWarrantyClaim",
    "CCTVAmcContract": "MSAmcContract",
    "CCTVAmcVisit": "MSAmcVisit",
    "CCTVEmiPlan": "MSEmiPlan",
    "CCTVEmiInstallment": "MSEmiInstallment",
    "CCTVJobCard": "MSJobCard",
    "CCTVJobCardPart": "MSJobCardPart",
    "CCTVProject": "MSProject",
    "CCTVSiteSurvey": "MSSiteSurvey",
    "CCTVCameraPosition": "MSCameraPosition",
    "CCTVCableRoute": "MSCableRoute",
    "CCTVInstallationTask": "MSInstallationTask",
    "CCTVTaskChecklist": "MSTaskChecklist",
    "CCTVKitDefinition": "MSKitDefinition",
    "CCTVKitComponent": "MSKitComponent",
    "CCTVBranch": "MSBranch",
    "CCTVTransfer": "MSTransfer",
    "CCTVTransferItem": "MSTransferItem",
    "CCTVTechnician": "MSTechnician",
    "CCTVCommissionRule": "MSCommissionRule",
    "CCTVCommissionRecord": "MSCommissionRecord",
    "CCTVOutsourcedVendor": "MSOutsourcedVendor",
    "CCTVLoyaltyConfig": "MSLoyaltyConfig",
    "CCTVLoyaltyOffer": "MSLoyaltyOffer",
    "CCTVLoyaltyTransaction": "MSLoyaltyTransaction",
    "CCTVNbrConfig": "MSNbrConfig",
    "CCTVHsCodeMapping": "MSHsCodeMapping",
    "CCTVMushakInvoice": "MSMushakInvoice",
    "CCTVMushakLineItem": "MSMushakLineItem",
    "CCTVVatReturn": "MSVatReturn",
}

# Prisma client accessor mapping: db.cCTVProduct -> db.mSProduct
# Pattern: CCTV -> mS (lowercase first letter, rest stays)
# db.cCTV + ModelName -> db.mS + ModelName
# e.g., db.cCTVProduct -> db.mSProduct
#       db.cCTVMasterProduct -> db.mSMasterProduct

def get_prisma_client_name(old_model: str) -> str:
    """Convert CCTVProduct -> mSProduct (Prisma client naming convention)"""
    # Remove CCTV prefix, add mS prefix
    rest = old_model[3:]  # Remove "CCTV"
    return "mS" + rest

# ─── Process a single file ───
def process_file(filepath, is_schema=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    changes = 0
    
    # 1. Replace @@map("cctv_*") with @@map("mobile_shop_*")
    if is_schema:
        content = content.replace('@@map("cctv_', '@@map("mobile_shop_')
    
    # 2. Replace model names (longest first to avoid partial matches)
    # Sort by length descending to replace longer names first
    sorted_models = sorted(MODEL_MAPPINGS.items(), key=lambda x: len(x[0]), reverse=True)
    
    for old_name, new_name in sorted_models:
        # Replace in model declarations, type references, relation fields
        if old_name in content:
            count = content.count(old_name)
            content = content.replace(old_name, new_name)
            changes += count
    
    # 3. Replace Prisma client accessors: db.cCTV* -> db.mS*
    # This handles db.cCTVProduct, db.cCTVMasterProduct, etc.
    # Pattern: db.cCTV followed by uppercase letter
    # We need to handle the Prisma client naming: CCTVProduct -> cCTVProduct -> mSProduct
    for old_model, new_model in sorted_models:
        old_client = "cCTV" + old_model[3:]  # cCTVProduct
        new_client = "mS" + new_model[2:]     # mSProduct
        if old_client in content:
            count = content.count(old_client)
            content = content.replace(old_client, new_client)
            changes += count
    
    # 4. Replace CCTVViewType -> MSViewType
    if "CCTVViewType" in content:
        count = content.count("CCTVViewType")
        content = content.replace("CCTVViewType", "MSViewType")
        changes += count
    
    # 5. Replace cctv-shop slug -> mobile-shop (in seed and modules)
    if 'cctv-shop' in content:
        count = content.count('cctv-shop')
        content = content.replace('cctv-shop', 'mobile-shop')
        changes += count
    
    # 6. Replace 'cctv' slug in business types -> 'mobile-shop'
    if '"cctv"' in content:
        count = content.count('"cctv"')
        content = content.replace('"cctv"', '"mobile-shop"')
        changes += count
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        return changes
    return 0

# ─── Main ───
def main():
    base_dir = sys.argv[1] if len(sys.argv) > 1 else '.'
    
    total_files = 0
    total_changes = 0
    modified_files = []
    
    # Process schema.prisma first
    schema_path = os.path.join(base_dir, 'prisma/schema.prisma')
    if os.path.exists(schema_path):
        count = process_file(schema_path, is_schema=True)
        if count > 0:
            modified_files.append((schema_path, count))
            total_files += 1
            total_changes += count
            print(f"  ✅ {schema_path}: {count} changes")
    
    # Process seed.ts
    seed_path = os.path.join(base_dir, 'prisma/seed.ts')
    if os.path.exists(seed_path):
        count = process_file(seed_path)
        if count > 0:
            modified_files.append((seed_path, count))
            total_files += 1
            total_changes += count
            print(f"  ✅ {seed_path}: {count} changes")
    
    # Process all .ts and .tsx files in src/
    src_dir = os.path.join(base_dir, 'src')
    for root, dirs, files in os.walk(src_dir):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        for fname in files:
            if not (fname.endswith('.ts') or fname.endswith('.tsx')):
                continue
            filepath = os.path.join(root, fname)
            count = process_file(filepath)
            if count > 0:
                modified_files.append((filepath, count))
                total_files += 1
                total_changes += count
                print(f"  ✅ {filepath}: {count} changes")
    
    print(f"\n{'='*60}")
    print(f"Total files modified: {total_files}")
    print(f"Total changes: {total_changes}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
