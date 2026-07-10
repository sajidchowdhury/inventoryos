// src/lib/zai.ts
// ── InventoryOS: Z.ai SDK instance helper ──
//
// Resolves Z.ai credentials in priority order:
//   1. Environment variables: ZAI_API_KEY + ZAI_API_BASE (production-preferred)
//   2. Config file: /etc/.z-ai-config, project dir, or home dir
//
// The z-ai-web-dev-sdk's own ZAI.create() uses async fs/promises which can
// fail silently in Turbopack dev mode. This helper reads the config
// synchronously and passes it to new ZAI(config) directly.
//
// All AI routes should use getZai() instead of ZAI.create().

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";
import os from "os";

interface ZaiConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

let _cachedInstance: ZAI | null = null;
let _cachedSource: string | null = null;

/**
 * Load the Z.ai config.
 * Priority: env vars first (production), then config file (sandbox/dev).
 */
function loadConfig(): ZaiConfig {
  // 1. Environment variables — production-preferred
  const envKey = process.env.ZAI_API_KEY;
  const envBase = process.env.ZAI_API_BASE;
  if (envKey && envBase) {
    _cachedSource = "env vars (ZAI_API_KEY + ZAI_API_BASE)";
    return { baseUrl: envBase, apiKey: envKey };
  }

  // 2. Config file — check /etc first, then project dir, then home dir
  const candidates = [
    "/etc/.z-ai-config",
    path.join(process.cwd(), ".z-ai-config"),
    path.join(os.homedir(), ".z-ai-config"),
  ];

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const configStr = fs.readFileSync(filePath, "utf-8");
      const config = JSON.parse(configStr);
      if (config.baseUrl && config.apiKey) {
        _cachedSource = `config file at ${filePath}`;
        return config as ZaiConfig;
      }
    } catch {
      // try next location
    }
  }

  throw new Error(
    "Z.ai config not found. Either set ZAI_API_KEY + ZAI_API_BASE env vars, " +
    "or create .z-ai-config in one of: " + candidates.join(", ")
  );
}

/**
 * Get a configured Z.ai SDK instance. Caches after first creation.
 *
 * Usage:
 *   const zai = await getZai();
 *   const response = await zai.chat.completions.createVision({ ... });
 */
export async function getZai(): Promise<ZAI> {
  if (_cachedInstance) return _cachedInstance;

  const config = loadConfig();
  _cachedInstance = new ZAI(config);
  console.log(`[zai] SDK initialized from ${_cachedSource}`);
  return _cachedInstance;
}

/**
 * Reset the cached instance (useful if the config changes at runtime).
 */
export function resetZaiCache(): void {
  _cachedInstance = null;
  _cachedSource = null;
}
