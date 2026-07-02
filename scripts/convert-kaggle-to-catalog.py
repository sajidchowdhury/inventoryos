#!/usr/bin/env python3
"""
Convert Kaggle Bangladesh Medicine Dataset to InventoryOS Master Catalog CSV.
=============================================================================

Input: /tmp/medex_data/medicine.csv (21,714 products from Kaggle/MedEx)
Output: /home/z/my-project/download/master_catalog_import.csv

The output CSV is ready for import via POST /api/super-admin/master-products/import
once Phase 1 of the Master Catalog is implemented.

Columns in output:
  name, genericName, strength, dosageForm, manufacturer, categoryName,
  dgdaRegNo, barcode, defaultMrp, hsnCode, vatRate, unit, stripSize, boxSize
"""

import csv
import re
import os

INPUT = "/tmp/medex_data/medicine.csv"
MANUFACTURERS = "/tmp/medex_data/manufacturer.csv"
OUTPUT = "/home/z/my-project/download/master_catalog_import.csv"

def extract_mrp(package_size_str):
    """Extract MRP from package size string like '100 ml bottle: ৳ 40.12'"""
    if not package_size_str:
        return ""
    # Look for ৳ followed by a number
    match = re.search(r'৳\s*([\d.]+)', package_size_str)
    if match:
        return match.group(1)
    return ""

def extract_package_info(package_size_str):
    """Extract package size info like strip size, box size from string"""
    if not package_size_str:
        return "", "", ""
    
    strip_size = ""
    box_size = ""
    unit = "piece"
    
    # Look for patterns like "10 tablets" or "100 ml"
    if "tablet" in package_size_str.lower() or "capsule" in package_size_str.lower():
        unit = "tablet"
        # Try to find strip size (e.g., "10 tablets per strip" or "10x10")
        strip_match = re.search(r'(\d+)\s*(?:tablets?|capsules?)\s*(?:per\s*)?(?:strip|blister|pack)', package_size_str, re.I)
        if strip_match:
            strip_size = strip_match.group(1)
    
    if "ml" in package_size_str.lower():
        unit = "ml"
    elif "g " in package_size_str.lower() or "gram" in package_size_str.lower():
        unit = "g"
    
    return strip_size, box_size, unit

def infer_category(generic_name, drug_class=""):
    """Infer pharmacy category from generic name or drug class"""
    text = (generic_name + " " + drug_class).lower()
    
    categories = [
        ("paracetamol", "Pain & Fever"),
        ("ibuprofen", "Pain & Fever"),
        ("naproxen", "Pain & Fever"),
        ("diclofenac", "Pain & Fever"),
        ("aceclofenac", "Pain & Fever"),
        ("aspirin", "Pain & Fever"),
        ("antibiotic", "Antibiotics"),
        ("amoxicillin", "Antibiotics"),
        ("ciprofloxacin", "Antibiotics"),
        ("azithromycin", "Antibiotics"),
        ("cephalexin", "Antibiotics"),
        ("cefixime", "Antibiotics"),
        ("metronidazole", "Antibiotics"),
        ("ciprofloxacin", "Antibiotics"),
        ("omeprazole", "Digestive Health"),
        ("esomeprazole", "Digestive Health"),
        ("ranitidine", "Digestive Health"),
        ("pantoprazole", "Digestive Health"),
        ("metoclopramide", "Digestive Health"),
        ("amlodipine", "Heart & BP"),
        ("losartan", "Heart & BP"),
        ("atenolol", "Heart & BP"),
        ("bisoprolol", "Heart & BP"),
        ("enalapril", "Heart & BP"),
        ("captopril", "Heart & BP"),
        ("metformin", "Diabetes"),
        ("glimepiride", "Diabetes"),
        ("glibenclamide", "Diabetes"),
        ("insulin", "Diabetes"),
        ("sitagliptin", "Diabetes"),
        ("cetirizine", "Cold & Flu"),
        ("loratadine", "Cold & Flu"),
        ("fexofenadine", "Cold & Flu"),
        ("pseudoephedrine", "Cold & Flu"),
        ("dextromethorphan", "Cold & Flu"),
        ("bromhexine", "Cold & Flu"),
        ("salbutamol", "Respiratory"),
        ("montelukast", "Respiratory"),
        ("budesonide", "Respiratory"),
        ("beclometasone", "Respiratory"),
        ("dermat", "Skin Care"),
        ("clotrimazole", "Skin Care"),
        ("ketoconazole", "Skin Care"),
        ("hydrocortisone", "Skin Care"),
        ("miconazole", "Skin Care"),
        ("vitamin", "Vitamins & Supplements"),
        ("calcium", "Vitamins & Supplements"),
        ("iron", "Vitamins & Supplements"),
        ("folic acid", "Vitamins & Supplements"),
        ("zinc", "Vitamins & Supplements"),
        ("diazepam", "Central Nervous System"),
        ("alprazolam", "Central Nervous System"),
        ("sertraline", "Central Nervous System"),
        ("fluoxetine", "Central Nervous System"),
        ("risperidone", "Central Nervous System"),
        ("oral saline", "Oral Saline"),
        ("ors", "Oral Saline"),
    ]
    
    for keyword, category in categories:
        if keyword in text:
            return category
    
    return ""

def main():
    # Load manufacturers for ID mapping
    manufacturers = {}
    if os.path.exists(MANUFACTURERS):
        with open(MANUFACTURERS, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                manufacturers[row.get("manufacturer name", "")] = row.get("manufacturer id", "")
    
    # Read medicine CSV and convert
    products = []
    seen = set()  # For deduplication
    
    with open(INPUT, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            brand_name = row.get("brand name", "").strip()
            generic = row.get("generic", "").strip()
            strength = row.get("strength", "").strip()
            dosage_form = row.get("dosage form", "").strip()
            manufacturer = row.get("manufacturer", "").strip()
            package = row.get("package container", "").strip() or row.get("Package Size", "").strip()
            
            if not brand_name or len(brand_name) < 2:
                continue
            
            # Deduplicate by brand name + manufacturer
            key = f"{brand_name.lower()}|{manufacturer.lower()}"
            if key in seen:
                continue
            seen.add(key)
            
            # Extract MRP from package string
            mrp = extract_mrp(package)
            
            # Extract package info
            strip_size, box_size, unit = extract_package_info(package)
            
            # Infer category
            category = infer_category(generic)
            
            product = {
                "name": brand_name,
                "genericName": generic,
                "strength": strength,
                "dosageForm": dosage_form,
                "manufacturer": manufacturer,
                "categoryName": category,
                "dgdaRegNo": "",
                "barcode": "",
                "defaultMrp": mrp,
                "hsnCode": "",
                "vatRate": "",
                "unit": unit,
                "stripSize": strip_size,
                "boxSize": box_size,
            }
            
            products.append(product)
    
    # Write output CSV
    fieldnames = ["name", "genericName", "strength", "dosageForm", "manufacturer", 
                  "categoryName", "dgdaRegNo", "barcode", "defaultMrp", 
                  "hsnCode", "vatRate", "unit", "stripSize", "boxSize"]
    
    with open(OUTPUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(products)
    
    print(f"=" * 60)
    print(f"  Master Catalog CSV Generated")
    print(f"=" * 60)
    print(f"  Input: {INPUT}")
    print(f"  Output: {OUTPUT}")
    print(f"  Total products: {len(products)}")
    print(f"  Unique manufacturers: {len(set(p['manufacturer'] for p in products if p['manufacturer']))}")
    print(f"  With MRP: {len([p for p in products if p['defaultMrp']])}")
    print(f"  With category: {len([p for p in products if p['categoryName']])}")
    print(f"  With strength: {len([p for p in products if p['strength']])}")
    print(f"  With dosage form: {len([p for p in products if p['dosageForm']])}")
    
    # Sample
    print(f"\n  --- Sample (first 10) ---")
    for p in products[:10]:
        print(f"  {p['name']:25s} | {p['genericName'][:25]:25s} | {p['strength'][:12]:12s} | {p['dosageForm'][:12]:12s} | {p['manufacturer'][:25]}")
    
    # Manufacturer breakdown (top 15)
    mfr_counts = {}
    for p in products:
        mfr = p["manufacturer"] or "Unknown"
        mfr_counts[mfr] = mfr_counts.get(mfr, 0) + 1
    
    print(f"\n  --- Top 15 Manufacturers ---")
    for mfr, count in sorted(mfr_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"  {count:5d}  {mfr}")
    
    print(f"\n✅ Ready for import into InventoryOS Master Catalog!")

if __name__ == "__main__":
    main()
