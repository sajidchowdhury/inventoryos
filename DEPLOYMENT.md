# Deployment Guide — WHM Server Update

This guide walks you through safely updating your production server with all the new CCTV features (reports, warranty system, estimates, categories, CSV import, etc.) **without losing any existing data or breaking the running app**.

---

## What's Being Updated

### New Code (from GitHub)
- 6 new reports (Sales, Purchase, Profit & Loss, Due Collection, Top Products, Expense Summary)
- Organized sidebar with grouped menus
- Category management + CSV product import
- Warranty system with printable tokens
- Estimate/Quotation system
- Quick-add customer/supplier from any screen
- 4 payment methods (Cash, Bank, bKash, Nagad)
- All reports now lazy-load (no data on page load)

### New Database Tables (5 new tables, 0 deleted)
| Table | Purpose |
|-------|---------|
| `cctv_serial_history` | Audit log for every serial event |
| `cctv_repairs` | Repair jobs with warranty detection |
| `cctv_supplier_replacements` | Send-to-supplier + receive replacement flow |
| `cctv_estimates` | Project quotations/estimates |
| `cctv_estimate_items` | Line items for estimates |

### New Columns (added to existing tables, no data lost)
- `cctv_serial_items.warrantyMonths` + `replacesSerialId`
- `cctv_purchase_items.warrantyMonths`
- `cctv_repairs.tokenNo` + `underWarranty` + `warrantyExpiryDate`

**IMPORTANT: No existing tables are dropped. No existing data is modified. The `prisma db push` command only ADDS new tables and columns.**

---

## Deployment Steps (5 minutes total)

### Step 1: SSH into your WHM server
```bash
ssh root@your-server-ip
cd /path/to/inventoryos
```

### Step 2: Run the deployment script
```bash
bash scripts/deploy-update.sh
```

**That's it.** The script does everything automatically:
1. ✅ Backs up your database to `backups/inventoryos_YYYYMMDD_HHMMSS.sql`
2. ✅ Pulls latest code from GitHub
3. ✅ Installs dependencies
4. ✅ Applies schema changes (adds new tables/columns, preserves existing data)
5. ✅ Builds the Next.js app
6. ✅ Restarts pm2
7. ✅ Runs smoke tests

### Step 3: Test in your browser
Visit your website and check:
- CCTV module → Reports → try the new reports (Sales Report, Profit & Loss, etc.)
- CCTV module → Products → Categories + Import buttons
- CCTV module → Estimates → create a new estimate
- CCTV module → Repairs → create a repair, print token

---

## If Something Breaks (Rollback)

If the app doesn't work after deployment, roll back in 1 command:

```bash
bash scripts/rollback-deploy.sh
```

This will:
1. Restore the database from the backup
2. Revert the code to the previous commit
3. Rebuild and restart

---

## Manual Backup (Anytime)

You can create a backup anytime without deploying:

```bash
bash scripts/backup-db.sh
```

Backups are saved to `backups/` and only the last 5 are kept.

---

## What the Scripts Do NOT Touch

- ❌ Your `.env` file (leave it exactly as it is)
- ❌ Your port configuration (3000, 3001, whatever it is)
- ❌ Your pm2 process name
- ❌ Your Nginx/Apache config
- ❌ Your SSL certificates
- ❌ Existing data in the database

---

## Common Issues

### "pg_dump: command not found"
Install PostgreSQL client tools:
```bash
yum install postgresql-contrib   # CentOS/RHEL/WHM
# or
apt install postgresql-client    # Ubuntu/Debian
```

### "prisma db push failed"
This usually means the database connection is wrong. Check:
```bash
cat .env | grep DATABASE_URL
```
Make sure it points to your production database (not localhost if you're on a remote server).

### "pm2: command not found"
```bash
npm install -g pm2
```

### Build takes too long
The build normally takes 1-2 minutes. If it's much slower, your server may be low on RAM. Try:
```bash
pm2 stop all   # free up RAM
bun run build
pm2 start all
```

### App doesn't load after restart
Check pm2 logs:
```bash
pm2 logs --lines 30
```
Common causes: database connection error, missing .env variable.

---

## Verification Checklist

After deployment, verify these work:

- [ ] Website loads in browser
- [ ] Can log in
- [ ] CCTV dashboard shows real stats
- [ ] Reports → Daily Summary (pick a date, click Search)
- [ ] Reports → Weekly Health (click Generate Report)
- [ ] Reports → Sales Report (pick date range, click Search)
- [ ] Products → Categories (create a category)
- [ ] Products → Import (download template)
- [ ] Estimates → New Estimate (add products)
- [ ] Repairs → New Repair (enter a serial)
- [ ] Buy Products → scan serials
- [ ] Sell Products → select customer (quick-add works)

If all these work, your deployment is successful! 🎉
