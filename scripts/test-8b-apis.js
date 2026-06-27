// Test Phase 8b APIs: Demand Forecast, Expiry Optimizer, Product Assistant
import http from 'http';

const BUSINESS_ID = 'cmqw75ln30003vo9ahyhrs0lj';
const HOST = 'localhost';
const PORT = 3000;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {};
    const req = http.request({ hostname: HOST, port: PORT, path, method, headers }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
        catch (e) { resolve({ status: res.statusCode, data: b }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== Phase 8b API Tests ===\n');

  // 1. Demand Forecast (algorithm-based, no LLM)
  console.log('1. POST /ai/forecast (30-day demand forecast)');
  const forecastRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/ai/forecast`, { days: 30 });
  console.log(`   Status: ${forecastRes.status}`);
  console.log(`   Summary:`);
  console.log(`     Products analyzed: ${forecastRes.data?.summary?.productsAnalyzed}`);
  console.log(`     Total forecasted sales: ${forecastRes.data?.summary?.totalForecastedSales}`);
  console.log(`     Total forecasted revenue: ৳${forecastRes.data?.summary?.totalForecastedRevenue?.toFixed(2)}`);
  console.log(`     Increasing trend: ${forecastRes.data?.summary?.increasingTrend}`);
  console.log(`     Decreasing trend: ${forecastRes.data?.summary?.decreasingTrend}`);
  console.log(`     Will stock out: ${forecastRes.data?.summary?.willStockOut}`);
  console.log(`     Avg confidence: ${forecastRes.data?.summary?.avgConfidence}%`);
  console.log(`   Top forecasts:`);
  forecastRes.data?.forecasts?.slice(0, 3).forEach((f) => {
    console.log(`     ${f.productName}: ${f.forecastedSales} units (৳${f.forecastedRevenue.toFixed(0)}) — trend: ${f.trend} — confidence: ${f.confidence}% — peak: ${f.peakDay}`);
  });
  console.log('');

  // 2. Expiry Optimizer (calls LLM)
  console.log('2. POST /ai/expiry-optimizer (AI expiry recommendations)');
  console.log('   (This calls the LLM — may take 5-10 seconds...)');
  const expiryRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/ai/expiry-optimizer`, {});
  console.log(`   Status: ${expiryRes.status}`);
  if (expiryRes.data?.success) {
    console.log(`   Summary:`);
    console.log(`     Total batches: ${expiryRes.data?.summary?.totalBatches}`);
    console.log(`     Total value at risk: ৳${expiryRes.data?.summary?.totalValueAtRisk?.toFixed(2)}`);
    console.log(`     Expired: ${expiryRes.data?.summary?.expiredCount}`);
    console.log(`     Critical (≤7d): ${expiryRes.data?.summary?.criticalCount}`);
    console.log(`     Warning (≤30d): ${expiryRes.data?.summary?.warningCount}`);
    console.log(`     Action summary:`, JSON.stringify(expiryRes.data?.summary?.actionSummary));
    console.log(`   Recommendations:`);
    expiryRes.data?.recommendations?.slice(0, 3).forEach((r) => {
      console.log(`     ${r.productName} — Batch ${r.batchNo} — ${r.daysUntilExpiry}d left — Action: ${r.action} — Urgency: ${r.urgency}`);
      console.log(`       Reason: ${r.reason?.substring(0, 80)}`);
      console.log(`       Recovery: ${r.estimatedRecovery}`);
    });
  } else {
    console.log(`   Error: ${expiryRes.data?.error || 'Unknown'}`);
    console.log(`   Message: ${expiryRes.data?.message || 'N/A'}`);
  }
  console.log('');

  // 3. Product Assistant — Generate Description (calls LLM)
  console.log('3. POST /ai/product-assistant (generate product description)');
  console.log('   (This calls the LLM...)');
  const descRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/ai/product-assistant`, {
    action: "generate_description",
    productData: {
      name: "Napa Extra",
      genericName: "Paracetamol + Caffeine",
      strength: "500mg",
      dosageForm: "Tablet",
      manufacturer: "Square",
      scheduleType: "OTC",
      isPrescription: false,
    },
  });
  console.log(`   Status: ${descRes.status}`);
  if (descRes.data?.success) {
    console.log(`   Description: ${descRes.data?.description?.substring(0, 200)}...`);
  }
  console.log('');

  // 4. Product Assistant — Suggest Category (calls LLM)
  console.log('4. POST /ai/product-assistant (suggest category)');
  const catRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/ai/product-assistant`, {
    action: "suggest_category",
    productName: "Ventolin Inhaler",
    genericName: "Salbutamol",
  });
  console.log(`   Status: ${catRes.status}`);
  if (catRes.data?.success) {
    console.log(`   Suggested category: ${catRes.data?.suggestion?.suggestedCategory}`);
    console.log(`   Suggested type: ${catRes.data?.suggestion?.suggestedType}`);
    console.log(`   Confidence: ${catRes.data?.suggestion?.confidence}`);
    console.log(`   Reason: ${catRes.data?.suggestion?.reason?.substring(0, 100)}`);
  }
  console.log('');

  // 5. Product Assistant — Check Interactions (calls LLM)
  console.log('5. POST /ai/product-assistant (check drug interactions)');
  const interactionRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/ai/product-assistant`, {
    action: "check_interactions",
    products: [
      { name: "Napa Extra", genericName: "Paracetamol + Caffeine" },
      { name: "Amodis", genericName: "Metronidazole" },
    ],
    conditions: ["diabetes", "hypertension"],
  });
  console.log(`   Status: ${interactionRes.status}`);
  if (interactionRes.data?.success) {
    console.log(`   Risk level: ${interactionRes.data?.interactionCheck?.riskLevel}`);
    console.log(`   Interactions: ${interactionRes.data?.interactionCheck?.interactions?.length || 0}`);
    interactionRes.data?.interactionCheck?.interactions?.forEach((i, idx) => {
      console.log(`     ${idx + 1}. [${i.severity}] ${i.description?.substring(0, 80)}`);
    });
    console.log(`   Condition warnings: ${interactionRes.data?.interactionCheck?.conditionWarnings?.length || 0}`);
    console.log(`   General advice: ${interactionRes.data?.interactionCheck?.generalAdvice?.substring(0, 100)}`);
  }
  console.log('');

  // 6. Product Assistant — Suggest Dosage (calls LLM)
  console.log('6. POST /ai/product-assistant (suggest dosage info)');
  const dosageRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/ai/product-assistant`, {
    action: "suggest_dosage",
    genericName: "Paracetamol",
    strength: "500mg",
    dosageForm: "Tablet",
  });
  console.log(`   Status: ${dosageRes.status}`);
  if (dosageRes.data?.success) {
    console.log(`   Adult dose: ${dosageRes.data?.dosageInfo?.adultDose}`);
    console.log(`   Max daily: ${dosageRes.data?.dosageInfo?.maxDailyDose}`);
    console.log(`   Side effects: ${dosageRes.data?.dosageInfo?.commonSideEffects?.length || 0} listed`);
    console.log(`   Warnings: ${dosageRes.data?.dosageInfo?.keyWarnings?.length || 0}`);
  }
  console.log('');

  console.log('=== All Phase 8b tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
