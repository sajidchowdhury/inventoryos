import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

const BUSINESS_ID = 'bus_placeholder';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _businessId } = await params;
    const { searchParams } = new URL(_req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const search = searchParams.get('search') || '';

    const where: Prisma.MSMushakInvoiceWhereInput = {
      businessId: BUSINESS_ID,
      isActive: true,
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { buyerName: { contains: search, mode: "insensitive" } },
          { buyerBin: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      db.mSMushakInvoice.findMany({
        where,
        include: {
          lineItems: { where: { isActive: true }, orderBy: { slNo: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.mSMushakInvoice.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[MUSHAK-LIST]', error);
    return NextResponse.json({ success: false, error: 'Failed to load Mushak invoices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _businessId } = await params;
    const body = await req.json();
    const { saleId, buyerName, buyerAddress, buyerBin, lineItems: customLineItems } = body;

    if (!saleId) {
      return NextResponse.json({ success: false, error: 'Sale ID is required' }, { status: 400 });
    }

    // Fetch the sale with items
    const sale = await db.mSSale.findFirst({
      where: { id: saleId, businessId: BUSINESS_ID, isActive: true },
      include: { items: { where: { isActive: true } } },
    });
    if (!sale) {
      return NextResponse.json({ success: false, error: 'Sale not found' }, { status: 404 });
    }

    // Check for existing invoice for this sale
    const existing = await db.mSMushakInvoice.findFirst({
      where: { saleId, businessId: BUSINESS_ID, isActive: true },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: 'Mushak invoice already exists for this sale', existingInvoiceId: existing.id, invoiceNumber: existing.invoiceNumber }, { status: 409 });
    }

    // Get NBR config for seller details + HS codes
    const nbrConfig = await db.mSNbrConfig.findUnique({ where: { businessId: BUSINESS_ID } });
    const hsMappings = nbrConfig
      ? await db.mSHsCodeMapping.findMany({ where: { configId: nbrConfig.id, isActive: true } })
      : [];

    const sellerName = nbrConfig?.legalName || 'N/A';
    const sellerAddress = nbrConfig?.legalAddress || undefined;
    const sellerBin = nbrConfig?.bin || undefined;
    const vatRate = nbrConfig?.applicableVatRate ?? 15;

    // Build HS code lookup from mappings (category-based matching)
    const hsLookup = new Map<string, string>();
    for (const m of hsMappings) {
      hsLookup.set(m.category.toLowerCase(), m.hsCode);
    }

    // Generate sequential invoice number
    const nextSeq = (nbrConfig?.mushakInvoiceSeq ?? 0) + 1;
    const prefix = nbrConfig?.mushakInvoicePrefix || 'MUSHAK';
    const invoiceNumber = `${prefix}-${String(nextSeq).padStart(4, '0')}`;

    // Build line items with VAT
    let subtotal = 0;
    let totalVat = 0;
    const invoiceLines = sale.items.map((item, idx) => {
      const lineVatRate = vatRate;
      const lineTotal = item.totalPrice;
      const lineVat = Math.round(lineTotal * (lineVatRate / 100) * 100) / 100;

      // Try to match HS code by product brand or category
      let hsCode: string | undefined;
      const brand = (item.productBrand || '').toLowerCase();
      const name = (item.productName || '').toLowerCase();
      if (hsLookup.has('mobile phones') && (brand.includes('samsung') || brand.includes('xiaomi') || brand.includes('oppo') || brand.includes('realme') || brand.includes('symphony') || name.includes('phone'))) {
        hsCode = hsLookup.get('mobile phones');
      } else if (hsLookup.has('cameras') && (name.includes('camera') || name.includes('cctv') || name.includes('bullet') || name.includes('dome') || name.includes('ptz'))) {
        hsCode = hsLookup.get('cameras');
      } else if (hsLookup.has('nvr') && (name.includes('nvr') || name.includes('dvr') || name.includes('recorder'))) {
        hsCode = hsLookup.get('nvr');
      } else if (hsLookup.has('cables') && (name.includes('cable') || name.includes('wire') || name.includes('cat5') || name.includes('cat6') || name.includes('coax'))) {
        hsCode = hsLookup.get('cables');
      } else if (hsLookup.has('hard drives') && (name.includes('hdd') || name.includes('ssd') || name.includes('hard disk'))) {
        hsCode = hsLookup.get('hard drives');
      } else if (hsLookup.has('monitors') && name.includes('monitor')) {
        hsCode = hsLookup.get('monitors');
      } else if (hsLookup.has('power supplies') && (name.includes('power') || name.includes('adapter') || name.includes('psu'))) {
        hsCode = hsLookup.get('power supplies');
      } else if (hsLookup.has('routers & switches') && (name.includes('router') || name.includes('switch') || name.includes('access point'))) {
        hsCode = hsLookup.get('routers & switches');
      } else if (hsLookup.has('accessories')) {
        hsCode = hsLookup.get('accessories');
      }

      subtotal += lineTotal;
      totalVat += lineVat;

      return {
        businessId: BUSINESS_ID,
        slNo: idx + 1,
        productName: item.productName,
        hsCode: hsCode || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: lineTotal,
        vatRate: lineVatRate,
        vatAmount: lineVat,
      };
    });

    const grandTotal = subtotal + totalVat - (sale.discountAmount || 0);

    // Number to words
    const taka = Math.floor(grandTotal);
    const poisha = Math.round((grandTotal - taka) * 100);
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tensArr = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function convert(n: number): string {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      if (n < 100) return tensArr[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
      if (n < 1000000000) return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
      return convert(Math.floor(n / 1000000000)) + ' Billion';
    }
    let amountWords = '';
    if (taka > 0) amountWords += convert(taka) + ' Taka';
    if (poisha > 0) amountWords += (taka > 0 ? ' and ' : '') + convert(poisha) + ' Poisha';
    amountWords += ' Only';

    // Create invoice + line items in a transaction
    const invoice = await db.$transaction(async (tx) => {
      const inv = await tx.cCTVMushakInvoice.create({
        data: {
          businessId: BUSINESS_ID,
          saleId,
          invoiceNumber,
          sellerName,
          sellerAddress,
          sellerBin,
          buyerName: buyerName || sale.customerName,
          buyerAddress: buyerAddress || undefined,
          buyerBin: buyerBin || undefined,
          subtotal,
          totalVat,
          grandTotal,
          discountAmount: sale.discountAmount || 0,
          amountInWords: amountWords,
          lineItems: { create: invoiceLines },
        },
        include: { lineItems: { orderBy: { slNo: 'asc' } } },
      });

      // Increment sequence on NBR config
      if (nbrConfig) {
        await tx.cCTVNbrConfig.update({
          where: { id: nbrConfig.id },
          data: { mushakInvoiceSeq: nextSeq },
        });
      }

      return inv;
    });

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Invoice number conflict. Please retry.' }, { status: 409 });
    }
    console.error('[MUSHAK-CREATE]', error);
    return NextResponse.json({ success: false, error: 'Failed to generate Mushak invoice' }, { status: 500 });
  }
}