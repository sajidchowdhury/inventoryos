// Test Phase 8a APIs: AI Insights, AI Chat, Smart Reorder
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
  console.log('=== Phase 8a API Tests ===\n');

  // 1. Smart Reorder (no AI call — pure algorithm)
  console.log('1. GET /ai/reorder (smart reorder suggestions)');
  const reorderRes = await makeRequest('GET', `/api/businesses/${BUSINESS_ID}/ai/reorder`);
  console.log(`   Status: ${reorderRes.status}`);
  console.log(`   Summary:`);
  console.log(`     Total suggestions: ${reorderRes.data?.summary?.totalSuggestions}`);
  console.log(`     Critical: ${reorderRes.data?.summary?.critical}`);
  console.log(`     High: ${reorderRes.data?.summary?.high}`);
  console.log(`     Medium: ${reorderRes.data?.summary?.medium}`);
  console.log(`     Low: ${reorderRes.data?.summary?.low}`);
  console.log(`     Total estimated cost: ৳${reorderRes.data?.summary?.totalEstimatedCost?.toFixed(2)}`);
  console.log(`     Out of stock: ${reorderRes.data?.summary?.outOfStock}`);
  console.log(`   Top 3 suggestions:`);
  reorderRes.data?.suggestions?.slice(0, 3).forEach((s) => {
    console.log(`     ${s.productName} — ${s.urgency} — stock: ${s.currentStock} ${s.unit} — order: ${s.suggestedOrderQty} — ৳${s.estimatedCost.toFixed(0)}`);
    console.log(`       Reason: ${s.reason}`);
    console.log(`       Velocity: ${s.dailyVelocity}/day, ${s.daysOfStock ?? '∞'} days left`);
  });
  console.log('');

  // 2. AI Insights (calls LLM)
  console.log('2. POST /ai/insights (AI-generated business analysis)');
  console.log('   (This calls the LLM — may take 5-10 seconds...)');
  const insightsRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/ai/insights`);
  console.log(`   Status: ${insightsRes.status}`);
  if (insightsRes.data?.success) {
    console.log(`   Health Score: ${insightsRes.data?.insights?.healthScore}/100`);
    console.log(`   Health Label: ${insightsRes.data?.insights?.healthLabel}`);
    console.log(`   Summary: ${insightsRes.data?.insights?.summary?.substring(0, 150)}...`);
    console.log(`   Insights: ${insightsRes.data?.insights?.insights?.length}`);
    insightsRes.data?.insights?.insights?.slice(0, 3).forEach((ins, i) => {
      console.log(`     ${i + 1}. [${ins.type}] ${ins.title} — ${ins.description?.substring(0, 80)}...`);
    });
    console.log(`   Recommendations: ${insightsRes.data?.insights?.recommendations?.length}`);
    insightsRes.data?.insights?.recommendations?.slice(0, 2).forEach((rec, i) => {
      console.log(`     ${i + 1}. [${rec.priority}] ${rec.title} — ${rec.description?.substring(0, 80)}...`);
    });
    console.log(`   Data points analyzed:`, JSON.stringify(insightsRes.data?.dataPoints));
  } else {
    console.log(`   Error: ${insightsRes.data?.error || 'Unknown'}`);
    console.log(`   Raw response: ${JSON.stringify(insightsRes.data).substring(0, 300)}`);
  }
  console.log('');

  // 3. AI Chat (calls LLM)
  console.log('3. POST /ai/chat (natural language Q&A)');
  console.log('   Question: "How many products do I have in stock?"');
  console.log('   (This calls the LLM — may take 5-10 seconds...)');
  const chatRes = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/ai/chat`, {
    message: 'How many products do I have in stock? Are any low on stock?',
  });
  console.log(`   Status: ${chatRes.status}`);
  if (chatRes.data?.success) {
    console.log(`   AI Response:`);
    console.log(`   ${chatRes.data?.response?.substring(0, 500)}`);
  } else {
    console.log(`   Error: ${chatRes.data?.error || 'Unknown'}`);
  }
  console.log('');

  // 4. AI Chat with follow-up
  console.log('4. POST /ai/chat (follow-up question)');
  console.log('   Question: "What should I do about the low stock items?"');
  const chat2Res = await makeRequest('POST', `/api/businesses/${BUSINESS_ID}/ai/chat`, {
    message: 'What should I do about the low stock items?',
    history: [
      { role: 'user', content: 'How many products do I have in stock?' },
      { role: 'assistant', content: chatRes.data?.response || '' },
    ],
  });
  console.log(`   Status: ${chat2Res.status}`);
  if (chat2Res.data?.success) {
    console.log(`   AI Response:`);
    console.log(`   ${chat2Res.data?.response?.substring(0, 400)}`);
  }
  console.log('');

  console.log('=== All Phase 8a tests complete! ===');
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
