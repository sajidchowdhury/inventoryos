export interface ModuleFeature {
  name: string;
  icon: string;
  description: string;
}

export interface ModuleRegistryItem {
  slug: string;
  name: string;
  icon: string;
  color: string;
  gradient: string;
  bgColor: string;
  borderColor: string;
  isActive: boolean;
  tagline: string;
  description: string;
  features: ModuleFeature[];
  stats: { label: string; value: string }[];
}

export const moduleRegistry: ModuleRegistryItem[] = [
  {
    slug: 'pharmacy',
    name: 'Pharmacy',
    icon: '💊',
    color: 'emerald',
    gradient: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    isActive: true,
    tagline: 'Complete Pharmacy Management',
    description: 'Manage medicines, prescriptions, expiry tracking, and sales with ease.',
    features: [
      { name: 'Inventory Management', icon: '📦', description: 'Track stock levels, batches, and expiry dates' },
      { name: 'Prescription Handling', icon: '📋', description: 'Process and manage prescriptions' },
      { name: 'Sales & Billing', icon: '💰', description: 'POS system with GST billing' },
      { name: 'Expiry Alerts', icon: '🔔', description: 'Get notified before medicines expire' },
    ],
    stats: [
      { label: 'Products', value: '2,500+' },
      { label: 'Daily Sales', value: '150+' },
      { label: 'Prescriptions', value: '80/day' },
      { label: 'Accuracy', value: '99.9%' },
    ],
  },
  {
    slug: 'mobile-shop',
    name: 'Mobile Shop',
    icon: '📱',
    color: 'cyan',
    gradient: 'from-cyan-500 to-blue-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    isActive: true,
    tagline: 'Complete Mobile Shop Management',
    description: 'Manage phones, accessories, repairs, EMI sales, and IMEI tracking with ease.',
    features: [
      { name: 'IMEI Tracking', icon: '🔢', description: 'Track every phone by unique IMEI number' },
      { name: 'Phone Repairs', icon: '🔧', description: 'Job cards for repair & maintenance' },
      { name: 'EMI Sales', icon: '💳', description: 'Customer installment payment tracking' },
      { name: 'Warranty Management', icon: '🛡️', description: 'Product warranty tracking & alerts' },
      { name: 'Accessories & Bundles', icon: '📦', description: 'Kits for phone + case + protector' },
      { name: 'Loyalty Program', icon: '⭐', description: 'Reward repeat customers' },
      { name: 'Technician Management', icon: '👨‍🔧', description: 'Track repairs & commissions' },
      { name: 'AI Insights', icon: '🤖', description: 'AI-powered business analytics' },
    ],
    stats: [
      { label: 'Products', value: '1,000+' },
      { label: 'IMEI Items', value: '5,000+' },
      { label: 'Repairs', value: '200+' },
      { label: 'EMI Active', value: '50+' },
    ],
  },
  {
    slug: 'cctv-shop',
    name: 'CCTV Shop',
    icon: '📹',
    color: 'violet',
    gradient: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    isActive: true,
    tagline: 'Simple CCTV Business Management',
    description: 'Clean, desktop-first inventory management designed for Bangladeshi CCTV shops. Buy, sell, track serials, manage warranty.',
    features: [
      { name: 'Product Setup', icon: '📦', description: 'Simple product management with serial tracking' },
      { name: 'Buy Products', icon: '🛒', description: 'One-screen purchase flow with bulk serial entry' },
      { name: 'Sell Products', icon: '💰', description: 'Type serial to sell — auto-finds product' },
      { name: 'Warranty Tracking', icon: '🛡️', description: 'Track warranty by serial number' },
      { name: 'Daily Cash Book', icon: '📒', description: 'Money in vs money out — one page' },
      { name: 'Reports', icon: '📊', description: 'P&L, customer ledger, supplier ledger' },
    ],
    stats: [
      { label: 'Products', value: '200+' },
      { label: 'Serial Items', value: '1,000+' },
      { label: 'Daily Sales', value: '20+' },
      { label: 'Warranty', value: '99%' },
    ],
  },
  {
    slug: 'grocery',
    name: 'Grocery',
    icon: '🛒',
    color: 'orange',
    gradient: 'from-orange-500 to-amber-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    isActive: false,
    tagline: 'Grocery Store Management',
    description: 'Manage inventory, billing, and supplier orders for your grocery store.',
    features: [],
    stats: [],
  },
  {
    slug: 'restaurant',
    name: 'Restaurant',
    icon: '🍽️',
    color: 'red',
    gradient: 'from-red-500 to-rose-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    isActive: false,
    tagline: 'Restaurant POS System',
    description: 'Complete restaurant management with menu, orders, and table management.',
    features: [],
    stats: [],
  },
  {
    slug: 'electric-shop',
    name: 'Electric Shop',
    icon: '⚡',
    color: 'yellow',
    gradient: 'from-yellow-500 to-orange-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    isActive: false,
    tagline: 'Electrical Supply Chain',
    description: 'Manage electrical products, quotations, and project supplies.',
    features: [],
    stats: [],
  },
  {
    slug: 'bakery',
    name: 'Bakery',
    icon: '🧁',
    color: 'pink',
    gradient: 'from-pink-500 to-rose-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    isActive: false,
    tagline: 'Bakery Management',
    description: 'Recipe management, production planning, and order tracking for bakeries.',
    features: [],
    stats: [],
  },
];

export function getModule(slug: string): ModuleRegistryItem | undefined {
  return moduleRegistry.find((m) => m.slug === slug);
}

export function getActiveModules(): ModuleRegistryItem[] {
  return moduleRegistry.filter((m) => m.isActive);
}