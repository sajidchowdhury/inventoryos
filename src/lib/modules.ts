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
    icon: '📹',
    color: 'violet',
    gradient: 'from-violet-500 to-purple-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    isActive: true,
    tagline: 'Smart Mobile Shop Suite',
    description: 'End-to-end management for mobile shop businesses — products, serial tracking, job cards, AMC, and more.',
    features: [
      { name: 'Serial Tracking', icon: '🔢', description: 'Track every item by unique serial number' },
      { name: 'Job Cards', icon: '🔧', description: 'Installation & maintenance job management' },
      { name: 'AMC Management', icon: '📋', description: 'Annual maintenance contracts & renewals' },
      { name: 'EMI Tracking', icon: '💳', description: 'Customer EMI payment tracking' },
      { name: 'Warranty Management', icon: '🛡️', description: 'Product warranty tracking & alerts' },
      { name: 'Mushak Report', icon: '📊', description: 'VAT Mushak reports for compliance' },
      { name: 'Project Management', icon: '🏗️', description: 'Manage installation projects end-to-end' },
      { name: 'AI Insights', icon: '🤖', description: 'AI-powered business analytics' },
    ],
    stats: [
      { label: 'Products', value: '500+' },
      { label: 'Serial Items', value: '2,000+' },
      { label: 'Active AMC', value: '120+' },
      { label: 'Job Cards', value: '85' },
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
    slug: 'mobile-shop',
    name: 'Mobile Shop',
    icon: '📱',
    color: 'cyan',
    gradient: 'from-cyan-500 to-blue-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
    isActive: false,
    tagline: 'Mobile Store Management',
    description: 'Manage mobile phones, accessories, repairs, and EMI sales.',
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