// src/lib/zai.ts
// ── InventoryOS: Z.ai SDK instance helper ──
//
// The z-ai-web-dev-sdk's ZAI.create() looks for a .z-ai-config file in
// process.cwd(), os.homedir(), or /etc. In the Next.js Turbopack dev server
// environment, this file lookup can fail even when the file exists (Turbopack
// may resolve process.cwd() differently). This helper reads the config file
// explicitly and passes it to the ZAI constructor directly, bypassing the
// file-resolution issue.
//
// All AI routes should use getZai() instead of ZAI.create() to get a
// configured SDK instance.

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
let _cachedConfigPath: string | null = null;

/**
 * Load the Z.ai config from the first readable location.
 * Checks: /etc/.z-ai-config, project dir, home dir (in that order for sandbox).
 * In production, the same file is typically at /etc/.z-ai-config (created by
 * the container start script).
 */
function loadConfigExplicit(): ZaiConfig {
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
        _cachedConfigPath = filePath;
        return config as ZaiConfig;
      }
    } catch {
      // try next location
    }
  }

  throw new Error(
    "Z.ai config not found. Checked: " + candidates.join(", ")
  );
}

/**
 * Get a configured Z.ai SDK instance. Caches the instance after first creation
 * so repeated AI calls don't re-read the config file.
 *
 * Usage:
 *   const zai = await getZai();
 *   const response = await zai.chat.completions.createVision({ ... });
 */
export async function getZai(): Promise<ZAI> {
  if (_cachedInstance) return _cachedInstance;

  const config = loadConfigExplicit();
  _cachedInstance = new ZAI(config);
  console.log(`[zai] SDK initialized from config at: ${_cachedConfigPath}`);
  return _cachedInstance;
}

/**
 * Reset the cached instance (useful if the config file changes at runtime,
 * e.g. during testing).
 */
export function resetZaiCache(): void {
  _cachedInstance = null;
  _cachedConfigPath = null;
}
