'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, X, Plus, Minus, Trash2,
  ShoppingCart, User, Package,
} from 'lucide-react';
import { useCCTVNavStore } from '@/stores/cctv-nav-store';
import { cn } from '@/lib/utils';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

const availableProducts = [
  { id: '1', name: 'Hikvision DS-2CD2143G2', price: 4200, stock: 45 },
  { id: '2', name: 'Dahua IPC-HDW2431T-AS', price: 3850, stock: 32 },
  { id: '3', name: 'Hikvision DS-7608NI-Q2/8P', price: 12500, stock: 8 },
  { id: '4', name: 'TP-Link TL-SG1008P PoE Switch', price: 6500, stock: 20 },
  { id: '5', name: 'CCTV Cable Cat6 100m', price: 1800, stock: 150 },
  { id: '6', name: 'HDD Seagate SkyHawk 2TB', price: 7500, stock: 10 },
  { id: '7', name: 'Hikvision DS-2CE5AD0T-IRP', price: 2200, stock: 65 },
  { id: '8', name: 'Dahua XVR5108HS-I3', price: 9800, stock: 12 },
];

export function CCTVSellView() {
  const { goBack } = useCCTVNavStore();
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showProducts, setShowProducts] = useState(true);

  const filteredProducts = availableProducts.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (product: (typeof availableProducts)[0]) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.id === product.id ? { ...c, qty: c.qty + 1 } : c
        );
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const total = cart.reduce((a, c) => a + c.price * c.qty, 0);

  return (
    <motion.div {...fadeUp} className="space-y-4 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">New Sale</h1>
        <span className="text-xs text-violet-600 font-semibold bg-violet-50 px-2.5 py-1 rounded-full">
          {cart.length} item{cart.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Customer field */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <label className="text-xs font-semibold text-gray-900 block mb-2">Customer</label>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-violet-500" />
          </div>
          <input
            type="text"
            placeholder="Customer name (optional)"
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="flex-1 h-9 px-3 rounded-xl bg-gray-50 border border-gray-100 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400"
          />
        </div>
        {!customer && (
          <p className="text-[10px] text-gray-400 mt-1.5 ml-10">Walk-in Customer</p>
        )}
      </div>

      {/* Product search */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-sm font-semibold text-gray-900">Add Products</span>
          <button
            onClick={() => setShowProducts(!showProducts)}
            className="text-xs text-violet-600 font-medium"
          >
            {showProducts ? 'Hide' : 'Show'}
          </button>
        </div>

        <AnimatePresence>
          {showProducts && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="relative mb-3">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-400" />
                <input
                  type="text"
                  placeholder="Search product..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-10 pr-10 rounded-xl bg-white border border-gray-200 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-violet-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 truncate">{product.name}</p>
                        <p className="text-[10px] text-gray-400">Stock: {product.stock}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-gray-900">৳{product.price.toLocaleString()}</span>
                      <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center">
                        <Plus className="w-3.5 h-3.5 text-violet-600" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cart */}
      <div>
        <span className="text-sm font-semibold text-gray-900 px-1 block mb-2">Cart</span>
        {cart.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
            <ShoppingCart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Cart is empty. Add products above.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cart.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 truncate">{item.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">৳{item.price.toLocaleString()} × {item.qty}</p>
                  </div>
                  <span className="text-xs font-bold text-gray-900 shrink-0">
                    ৳{(item.price * item.qty).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    <span className="text-sm font-semibold text-gray-900 w-6 text-center">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center active:bg-violet-200 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-violet-600" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-500">Total</span>
            <span className="text-xl font-bold text-gray-900">৳{total.toLocaleString()}</span>
          </div>
          <button
            disabled={cart.length === 0}
            className={cn(
              'w-full h-12 rounded-2xl text-sm font-semibold text-white transition-all',
              cart.length > 0
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 shadow-lg shadow-violet-500/30 active:scale-[0.98]'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            Complete Sale
          </button>
        </div>
      </div>
    </motion.div>
  );
}