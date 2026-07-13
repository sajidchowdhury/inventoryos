"use client";

// /admin/cctv — CCTV module placeholder.
// Will be built when the CCTV business module is activated.

import { Camera } from "lucide-react";

export default function CCTVPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
          <Camera className="h-8 w-8 text-violet-500" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">CCTV Module (Coming Soon)</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          A clean, simple, desktop-first CCTV business management module is being built.
          It will handle inventory, purchases, sales, warranty, and reports — designed
          specifically for Bangladeshi CCTV shops.
        </p>
      </div>
    </div>
  );
}
