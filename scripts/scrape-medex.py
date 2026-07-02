#!/usr/bin/env python3
"""
MedEx.com.bd Product Catalog Scraper (v2)
==========================================
Uses Playwright with 'domcontentloaded' instead of 'networkidle' (which times out
due to MedEx's long-polling connections). Handles CAPTCHA by waiting for manual
or auto-resolution.

Also tries an alternative approach: scraping individual company product pages
directly via known URL patterns.

Output: /home/z/my-project/download/medex_product_catalog.csv
"""

import csv
import json
import re
import time
import sys
import os
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

BASE_URL = "https://medex.com.bd"
OUTPUT_CSV = "/home/z/my-project/download/medex_product_catalog.csv"
OUTPUT_JSON = "/home/z/my-project/download/medex_product_catalog.json"

# Known company IDs from MedEx (found via web search)
# We'll scrape these one by one
KNOWN_COMPANIES = [
    {"id": "14", "name": "Beximco Pharmaceuticals Ltd"},
    {"id": "1", "name": "Square Pharmaceuticals PLC"},
    {"id": "2", "name": "Incepta Pharmaceuticals Ltd"},
    {"id": "3", "name": "Renata Limited"},
    {"id": "4", "name": "ACI Pharmaceuticals"},
    {"id": "5", "name": "Eskayef Bangladesh Ltd"},
    {"id": "6", "name": "Opsonin Pharma Limited"},
    {"id": "7", "name": "ACME Laboratories Ltd"},
    {"id": "8", "name": "Drug International Ltd"},
    {"id": "9", "name": " Aristopharma Ltd"},
    {"id": "10", "name": "Sun Pharmaceutical (Bangladesh) Ltd"},
    {"id": "11", "name": "Sanofi Bangladesh Ltd"},
    {"id": "12", "name": "Novartis (Bangladesh) Ltd"},
    {"id": "13", "name": "UniMed UniHealth Pharmaceuticals Ltd"},
    {"id": "15", "name": "Sk+F Plc"},
    {"id": "16", "name": "General Pharmaceuticals Ltd"},
    {"id": "17", "name": "The ACME Laboratories Ltd"},
    {"id": "18", "name": "Healthcare Pharmaceuticals Ltd"},
    {"id": "19", "name": "Orion Pharma Ltd"},
    {"id": "20", "name": "Square Toiletries Ltd"},
]

# More companies can be found by browsing /companies?alpha=a through /companies?alpha=z


def safe_goto(page, url, timeout=45000):
    """Navigate to a URL with fallback strategies."""
    for wait_strategy in ["domcontentloaded", "load", "commit"]:
        try:
            page.goto(url, wait_until=wait_strategy, timeout=timeout)
            return True
        except PlaywrightTimeout:
            print(f"    Timeout with '{wait_strategy}', trying next...")
        except Exception as e:
            print(f"    Error with '{wait_strategy}': {e}")
    return False


def wait_for_content(page, selector="body", timeout=15000):
    """Wait for page content to appear."""
    try:
        page.wait_for_selector(selector, timeout=timeout)
        return True
    except:
        return False


def handle_captcha(page):
    """Check for and handle CAPTCHA challenge."""
    content = page.content()
    if "captcha-challenge" in content or "captcha" in content.lower():
        print("    CAPTCHA detected, waiting 15s for auto-resolve...", end=" ", flush=True)
        time.sleep(15)
        try:
            page.reload(wait_until="domcontentloaded", timeout=30000)
            time.sleep(3)
        except:
            pass
        content = page.content()
        if "captcha" in content.lower():
            print("Still CAPTCHA - skipping")
            return False
        print("Resolved!")
        return True
    return True


def discover_companies(page):
    """Discover all companies by browsing alphabetical index."""
    all_companies = []
    alphabet = list("abcdefghijklmnopqrstuvwxyz")
    
    for letter in alphabet:
        url = f"{BASE_URL}/companies?alpha={letter}"
        print(f"  Browsing companies: {letter.upper()}...", end=" ", flush=True)
        
        if not safe_goto(page, url):
            print("FAILED")
            continue
        
        time.sleep(2)
        handle_captcha(page)
        time.sleep(1)
        
        # Extract company links
        try:
            links = page.eval_on_selector_all(
                'a[href*="/companies/"]',
                '''elements => elements.map(el => ({
                    href: el.href,
                    text: el.textContent.trim()
                })).filter(e => e.text.length > 2)'''
            )
            
            count_before = len(all_companies)
            for link in links:
                href = link.get("href", "")
                match = re.search(r"/companies/(\d+)/", href)
                if match:
                    company_id = match.group(1)
                    company_name = link.get("text", "").strip()
                    # Skip pagination links and non-company links
                    if company_name and not company_name.isdigit() and len(company_name) > 3:
                        if not any(c["id"] == company_id for c in all_companies):
                            all_companies.append({
                                "id": company_id,
                                "name": company_name,
                                "url": href,
                            })
            
            found = len(all_companies) - count_before
            print(f"{found} companies found")
        except Exception as e:
            print(f"ERROR: {e}")
        
        time.sleep(1)
    
    return all_companies


def scrape_company_products(page, company):
    """Scrape all products for a single company."""
    products = []
    company_id = company["id"]
    company_name = company["name"]
    
    # Try the direct company page URL
    url = company.get("url", f"{BASE_URL}/companies/{company_id}")
    print(f"  [{company_name}]", end=" ", flush=True)
    
    if not safe_goto(page, url):
        print("SKIP (navigation failed)")
        return products
    
    time.sleep(2)
    if not handle_captcha(page):
        print("SKIP (CAPTCHA)")
        return products
    time.sleep(1)
    
    # Get page content and parse products
    try:
        # Strategy 1: Look for brand/product links
        product_links = page.eval_on_selector_all(
            'a',
            '''elements => elements
                .filter(el => el.href && (el.href.includes('/brands/') || el.href.includes('/generics/')))
                .map(el => ({
                    href: el.href,
                    text: el.textContent.trim().replace(/\\s+/g, ' '),
                    parentText: el.closest('div, li, tr')?.textContent?.trim()?.replace(/\\s+/g, ' ')?.substring(0, 300) || ''
                }))
                .filter(e => e.text.length > 1)'''
        )
        
        # Strategy 2: Look for structured product data in the page
        page_html = page.content()
        
        # Try to find product data in script tags (JSON-LD or inline data)
        json_matches = re.findall(r'"(?:brandName|name|product)"\s*:\s*"([^"]+)"', page_html)
        
        # Strategy 3: Parse from visible text
        # MedEx company pages typically list products with format:
        # "BrandName GenericName Strength DosageForm"
        
        for link in product_links:
            text = link.get("text", "").strip()
            parent_text = link.get("parentText", "").strip()
            href = link.get("href", "")
            
            if not text or len(text) < 2:
                continue
            
            # Skip navigation links
            if text.lower() in ["next", "previous", "more", "view all", "see more"]:
                continue
            
            # Parse product info from the text
            # The parent text usually contains: "BrandName GenericName Strength Form"
            full_text = parent_text if len(parent_text) > len(text) else text
            
            product = {
                "name": text,
                "genericName": "",
                "strength": "",
                "dosageForm": "",
                "manufacturer": company_name,
                "categoryName": "",
                "dgdaRegNo": "",
                "url": href,
                "rawText": full_text,
            }
            
            # Extract strength
            strength_match = re.search(r'(\d+(?:\.\d+)?\s*(?:mg|mcg|ml|g|IU|%|mg/5ml|mg/ml))', full_text, re.I)
            if strength_match:
                product["strength"] = strength_match.group(1).strip()
            
            # Extract dosage form
            forms = ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Ointment",
                     "Drop", "Suspension", "Suppository", "Inhaler", "Spray", "Gel",
                     "Lotion", "Powder", "Granules", "Eye Drop", "Ear Drop",
                     "Nasal Spray", "Solution", "Emulsion"]
            for form in forms:
                if form.lower() in full_text.lower():
                    product["dosageForm"] = form
                    break
            
            # Try to extract generic name (usually appears after brand name)
            # This is best-effort without structured HTML
            if parent_text and len(parent_text) > len(text):
                # Generic might be the text after the brand name
                remaining = parent_text[len(text):].strip()
                if remaining:
                    # Take first meaningful part as generic
                    generic = remaining.split(str(product.get("strength", "")))[0].strip()
                    generic = re.sub(r'^[\s,\-|]+', '', generic).strip()
                    if generic and len(generic) > 2:
                        product["genericName"] = generic[:100]  # Cap length
            
            products.append(product)
        
        # Deduplicate by product name
        seen = set()
        unique = []
        for p in products:
            key = p["name"].lower()
            if key not in seen:
                seen.add(key)
                unique.append(p)
        
        print(f"{len(unique)} products")
        return unique
        
    except Exception as e:
        print(f"ERROR: {e}")
        return products


def save_results(products, companies_scraped):
    """Save to CSV + JSON."""
    
    # Deduplicate globally
    seen = set()
    unique = []
    for p in products:
        key = f"{p.get('name', '').lower()}|{p.get('manufacturer', '').lower()}"
        if key not in seen:
            seen.add(key)
            unique.append(p)
    
    print(f"\n{'='*60}")
    print(f"  RESULTS")
    print(f"{'='*60}")
    print(f"  Companies scraped: {len(companies_scraped)}")
    print(f"  Total products found: {len(products)}")
    print(f"  Unique products: {len(unique)}")
    
    # Save CSV
    fieldnames = ["name", "genericName", "strength", "dosageForm", "manufacturer", "categoryName", "dgdaRegNo", "url", "rawText"]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(unique)
    print(f"\n  CSV: {OUTPUT_CSV}")
    
    # Save JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "scrapedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
            "totalCompanies": len(companies_scraped),
            "totalProducts": len(unique),
            "companies": [{"id": c["id"], "name": c["name"]} for c in companies_scraped],
            "products": unique,
        }, f, indent=2, ensure_ascii=False)
    print(f"  JSON: {OUTPUT_JSON}")
    
    # Sample
    if unique:
        print(f"\n  --- Sample (first 15) ---")
        for p in unique[:15]:
            name = p.get("name", "?")[:25]
            gen = p.get("genericName", "?")[:25]
            str_ = p.get("strength", "?")[:10]
            form = p.get("dosageForm", "?")[:10]
            mfr = p.get("manufacturer", "?")[:20]
            print(f"  {name:25s} | {gen:25s} | {str_:10s} | {form:10s} | {mfr}")
    
    return unique


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Scrape MedEx.com.bd product catalog")
    parser.add_argument("--max-companies", type=int, default=None, help="Limit to N companies")
    parser.add_argument("--company-id", type=str, default=None, help="Scrape specific company ID")
    parser.add_argument("--discover", action="store_true", help="Discover all companies first (slower)")
    args = parser.parse_args()
    
    print("=" * 60)
    print("  MedEx.com.bd Product Catalog Scraper v2")
    print("=" * 60)
    
    all_products = []
    companies_scraped = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
        )
        page = context.new_page()
        
        # Determine which companies to scrape
        if args.company_id:
            # Single company mode
            companies = [{"id": args.company_id, "name": f"Company {args.company_id}", "url": f"{BASE_URL}/companies/{args.company_id}"}]
        elif args.discover:
            # Full discovery mode
            print("\n--- Phase 1: Discovering all companies ---")
            companies = discover_companies(page)
            print(f"\nFound {len(companies)} companies")
        else:
            # Use known companies list
            companies = KNOWN_COMPANIES
            # Build URLs
            for c in companies:
                c["url"] = f"{BASE_URL}/companies/{c['id']}"
            print(f"\nUsing {len(companies)} known companies (use --discover for full list)")
        
        # Limit if requested
        if args.max_companies:
            companies = companies[:args.max_companies]
            print(f"Limited to {len(companies)} companies")
        
        # Scrape each company
        print(f"\n--- Phase 2: Scraping products from {len(companies)} companies ---")
        for i, company in enumerate(companies):
            print(f"\n[{i+1}/{len(companies)}]", end="")
            products = scrape_company_products(page, company)
            all_products.extend(products)
            companies_scraped.append(company)
        
        browser.close()
    
    # Save results
    save_results(all_products, companies_scraped)
    print(f"\n✅ Done! Ready for Master Catalog import.")


if __name__ == "__main__":
    main()
