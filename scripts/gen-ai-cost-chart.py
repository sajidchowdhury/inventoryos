"""
Generate cost-scaling chart for InventoryOS AI Features Report.
Emerald Pharmacy palette to match the app's brand identity.
Output: /home/z/my-project/download/ai-cost-scaling.png
"""
import matplotlib.font_manager as fm
fm.fontManager.addfont('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')

import matplotlib.pyplot as plt
import numpy as np

plt.rcParams['font.sans-serif'] = ['DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False

# Emerald Pharmacy palette
EMERALD_DARK = '#064E3B'
EMERALD = '#10B981'
EMERALD_LIGHT = '#6EE7B7'
PURPLE = '#8B5CF6'  # AI accent
AMBER = '#F59E0B'
ROSE = '#F43F5E'
GRAY = '#6B7280'
BG = '#FFFFFF'
SURFACE = '#F0FDF4'

# Data: monthly cost in BDT at 3 usage tiers across pharmacy scale
# Based on cost model in the report:
#  - Light user: ~30 BDT/month per pharmacy (5 chat + 1 insights + 1 expiry-opt + 2 prod-asst per day × 30 days, minus cache hits)
#  - Power user: ~75 BDT/month per pharmacy (maxes out rate limit)
#  - Abuser/worst case: ~150 BDT/month per pharmacy (uncapped output + large context)

pharmacies = np.array([1, 5, 10, 25, 50, 100, 250, 500, 1000])
light_cost = pharmacies * 15      # token-cap ceiling
power_cost = pharmacies * 75      # call-cap ceiling
worst_cost = pharmacies * 150     # uncapped output + unbounded context

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5.5), constrained_layout=True)
fig.patch.set_facecolor(BG)

# --- Chart 1: Cost scaling curve ---
ax1.set_facecolor(BG)
ax1.plot(pharmacies, light_cost, marker='o', linewidth=2.5, markersize=7,
         color=EMERALD, label='Light user (cache hits, ≤50 calls/mo)')
ax1.plot(pharmacies, power_cost, marker='s', linewidth=2.5, markersize=7,
         color=AMBER, label='Power user (maxes 1,000 calls/mo)')
ax1.plot(pharmacies, worst_cost, marker='^', linewidth=2.5, markersize=7,
         color=ROSE, label='Worst case (uncapped output + 500 batches)')

ax1.set_xscale('log')
ax1.set_yscale('log')
ax1.set_xlabel('Number of Pharmacies', fontsize=11, color=EMERALD_DARK, fontweight='bold')
ax1.set_ylabel('Monthly AI Cost (BDT)', fontsize=11, color=EMERALD_DARK, fontweight='bold')
ax1.set_title('AI Cost Scaling — Monthly Bill vs Pharmacy Count',
              fontsize=13, color=EMERALD_DARK, fontweight='bold', pad=14)
ax1.grid(True, which='both', alpha=0.25, color=GRAY)
ax1.legend(loc='upper left', frameon=True, fontsize=9, framealpha=0.95)

# Annotate key thresholds
ax1.axhline(y=15000, color=PURPLE, linestyle='--', alpha=0.5, linewidth=1)
ax1.text(1.2, 17000, 'Watch threshold: 15,000 BDT/mo', color=PURPLE, fontsize=8, fontweight='bold')
ax1.axhline(y=100000, color=ROSE, linestyle='--', alpha=0.5, linewidth=1)
ax1.text(1.2, 110000, 'Kill-switch: 100,000 BDT/mo', color=ROSE, fontsize=8, fontweight='bold')

for spine in ax1.spines.values():
    spine.set_color(GRAY)
    spine.set_alpha(0.3)
ax1.tick_params(colors=GRAY)

# --- Chart 2: Cost breakdown by feature (stacked bar at 100 pharmacies, power user) ---
ax2.set_facecolor(BG)
features = ['AI Chat', 'AI Insights', 'Expiry\nOptimizer', 'Product\nAssistant']
# Per-call cost (BDT) at power-user scale, monthly total per 100 pharmacies
per_call_cost = [0.08, 0.10, 0.42, 0.04]      # BDT per call (avg)
calls_per_month = [30000, 5000, 2000, 8000]   # total calls/mo for 100 pharmacies at power tier
monthly_cost = [round(p*c, 0) for p, c in zip(per_call_cost, calls_per_month)]
colors_bar = [EMERALD, PURPLE, AMBER, EMERALD_LIGHT]

bars = ax2.bar(features, monthly_cost, color=colors_bar, edgecolor='white', linewidth=2)
ax2.set_ylabel('Monthly Cost at 100 Pharmacies (BDT)', fontsize=11, color=EMERALD_DARK, fontweight='bold')
ax2.set_title('Cost Breakdown by Feature — 100 Power-User Pharmacies',
              fontsize=13, color=EMERALD_DARK, fontweight='bold', pad=14)
ax2.grid(True, axis='y', alpha=0.25, color=GRAY)

# Value labels on bars
for bar, cost in zip(bars, monthly_cost):
    h = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2, h + max(monthly_cost)*0.02,
             f'{int(cost):,}\nBDT', ha='center', va='bottom',
             fontsize=10, fontweight='bold', color=EMERALD_DARK)

for spine in ax2.spines.values():
    spine.set_color(GRAY)
    spine.set_alpha(0.3)
ax2.tick_params(colors=GRAY)
ax2.set_ylim(0, max(monthly_cost) * 1.25)

# Save
output_path = '/home/z/my-project/download/ai-cost-scaling.png'
plt.savefig(output_path, dpi=180, bbox_inches=None, facecolor=BG)
plt.close()
print(f'Chart saved to: {output_path}')

# Also generate a second chart: risk severity matrix
fig2, ax = plt.subplots(figsize=(11, 5.5), constrained_layout=True)
fig2.patch.set_facecolor(BG)
ax.set_facecolor(BG)

# Risk matrix: severity (1-5) vs likelihood (1-5) for 10 red flags
risks = [
    ('No max_tokens cap', 5, 4, ROSE),        # HIGH severity, HIGH likelihood
    ('Unbounded expiry-opt context', 5, 3, ROSE),  # HIGH severity, MED likelihood
    ('No free-tier guard', 4, 4, AMBER),      # MED-HIGH
    ('No cache in product-asst', 3, 5, AMBER),
    ('Large insights system prompt', 2, 5, EMERALD),
    ('No products.length validation', 4, 2, AMBER),
    ('Per-page-load trigger (DB)', 2, 4, EMERALD),
    ('forecast/reorder no logging', 1, 5, EMERALD_LIGHT),
    ('No streaming retry loops', 1, 1, EMERALD_LIGHT),  # NOT a risk — good
    ('No cron AI calls', 1, 1, EMERALD_LIGHT),  # NOT a risk — good
]

for name, sev, lik, color in risks:
    ax.scatter(lik, sev, s=450, color=color, alpha=0.75, edgecolor='white', linewidth=2)
    ax.annotate(name, (lik, sev), xytext=(8, 8), textcoords='offset points',
                fontsize=8, color=EMERALD_DARK, fontweight='bold')

ax.set_xlim(0, 6)
ax.set_ylim(0, 6)
ax.set_xlabel('Likelihood →', fontsize=11, color=EMERALD_DARK, fontweight='bold')
ax.set_ylabel('Severity →', fontsize=11, color=EMERALD_DARK, fontweight='bold')
ax.set_title('AI Cost Risk Matrix — Severity vs Likelihood',
             fontsize=13, color=EMERALD_DARK, fontweight='bold', pad=14)
ax.grid(True, alpha=0.2, color=GRAY)
ax.set_xticks([1, 2, 3, 4, 5])
ax.set_xticklabels(['1\nRare', '2', '3\nPossible', '4', '5\nFrequent'])
ax.set_yticks([1, 2, 3, 4, 5])
ax.set_yticklabels(['1\nLow', '2', '3\nMedium', '4', '5\nCritical'])

# Quadrant shading
ax.axhspan(3.5, 5.5, xmin=0.5/6, xmax=1, alpha=0.08, color=ROSE)
ax.text(4.5, 5.3, 'FIX NOW', ha='center', fontsize=10, color=ROSE, fontweight='bold', alpha=0.6)
ax.text(1.5, 1.5, 'SAFE', ha='center', fontsize=10, color=EMERALD, fontweight='bold', alpha=0.6)

for spine in ax.spines.values():
    spine.set_color(GRAY)
    spine.set_alpha(0.3)
ax.tick_params(colors=GRAY)

output_path2 = '/home/z/my-project/download/ai-risk-matrix.png'
plt.savefig(output_path2, dpi=180, bbox_inches=None, facecolor=BG)
plt.close()
print(f'Risk matrix saved to: {output_path2}')
