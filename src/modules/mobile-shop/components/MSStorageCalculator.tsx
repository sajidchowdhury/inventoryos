'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, HardDrive, Camera, Clock, Film, Layers,
  Calculator, ChevronDown, ChevronUp, Copy, Check,
  Info, RotateCcw, Save,
} from 'lucide-react';
import { useMSNavStore } from '@/stores/ms-nav-store';
import { cn } from '@/lib/utils';

// ── Bitrate reference table (Mbps) ──
// Based on industry-standard H.264/H.265 bitrate recommendations
const BITRATE_TABLE: Record<string, Record<string, number>> = {
  H264: {
    '720p':  1.5,
    '1080p': 4.0,
    '2MP':   4.0,
    '4MP':   8.0,
    '5MP':   10.0,
    '8MP':   16.0,
    '12MP':  24.0,
  },
  H265: {
    '720p':  0.75,
    '1080p': 2.0,
    '2MP':   2.0,
    '4MP':   4.0,
    '5MP':   5.0,
    '8MP':   8.0,
    '12MP':  12.0,
  },
};

const RESOLUTION_OPTIONS = ['720p', '1080p', '2MP', '4MP', '5MP', '8MP', '12MP'];
const FPS_OPTIONS = [10, 15, 20, 25, 30];
const COMPRESSION_OPTIONS = ['H264', 'H265'] as const;
const RETENTION_OPTIONS = [7, 15, 30, 45, 60, 90];
const HOURS_PER_DAY = 24;

// ── Calculation functions ──
function calculateStorageGB(
  bitrateMbps: number,
  fps: number,
  baseFps: number,
  hoursPerDay: number,
  retentionDays: number,
): number {
  // Adjust bitrate proportionally to actual fps
  const adjustedBitrate = bitrateMbps * (fps / baseFps);
  // Formula: (Bitrate_Mbps × 3600 × Hours × Days) / (8 × 1024)
  return (adjustedBitrate * 3600 * hoursPerDay * retentionDays) / (8 * 1024);
}

interface CalculationResult {
  cameras: number;
  resolution: string;
  fps: number;
  compression: string;
  retentionDays: number;
  bitrateMbps: number;
  perCameraPerDay: number;
  totalPerDay: number;
  totalStorage: number;
  recommendedHDD: number;
  hddCount: number;
  recommendedHddSize: string;
  baseFps: number;
  hoursPerDay: number;
}

// HDD size tiers (commonly available sizes in GB)
const HDD_SIZE_TIERS = [500, 1000, 2000, 3000, 4000, 6000, 8000, 10000, 12000, 16000];

function formatSize(gb: number): string {
  if (gb < 1) return `${(gb * 1024).toFixed(0)} MB`;
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
  return `${gb.toFixed(1)} GB`;
}

function formatBDT(gb: number): string {
  // Rough HDD cost estimate: ~15 BDT per GB for surveillance HDDs
  const cost = Math.ceil(gb * 15);
  return `~৳${cost.toLocaleString('en-BD')}`;
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

export function MSStorageCalculator() {
  const { goBack } = useMSNavStore();

  // ── Input state ──
  const [cameras, setCameras] = useState(4);
  const [resolution, setResolution] = useState('2MP');
  const [fps, setFps] = useState(25);
  const [compression, setCompression] = useState<'H264' | 'H265'>('H265');
  const [retentionDays, setRetentionDays] = useState(30);
  const [hoursPerDay, setHoursPerDay] = useState(24);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<Array<{ name: string; result: CalculationResult }>>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [copiedResult, setCopiedResult] = useState(false);
  const [customName, setCustomName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  // ── Calculation ──
  const result: CalculationResult = useMemo(() => {
    const baseFps = 25; // reference fps for bitrate table
    const bitrateMbps = BITRATE_TABLE[compression]?.[resolution] ?? 4.0;
    const perCameraPerDay = calculateStorageGB(bitrateMbps, fps, baseFps, hoursPerDay, retentionDays);
    const totalPerDay = perCameraPerDay * cameras;
    const totalStorage = perCameraPerDay * cameras;
    const safetyMargin = totalStorage * 0.20;
    const recommendedHDD = totalStorage + safetyMargin;

    // Determine optimal HDD configuration
    let hddCount = 1;
    let recommendedHddSize = '';
    for (const size of HDD_SIZE_TIERS) {
      if (size >= recommendedHDD) {
        recommendedHddSize = size >= 1000 ? `${size / 1000} TB` : `${size} GB`;
        hddCount = 1;
        break;
      }
    }
    if (!recommendedHddSize) {
      // Need multiple HDDs - find best combination using 4TB drives (most cost-effective)
      const commonDrive = 4000;
      hddCount = Math.ceil(recommendedHDD / commonDrive);
      recommendedHddSize = `${commonDrive / 1000} TB × ${hddCount}`;
    }

    return {
      cameras,
      resolution,
      fps,
      compression,
      retentionDays,
      bitrateMbps,
      perCameraPerDay,
      totalPerDay,
      totalStorage,
      recommendedHDD,
      hddCount,
      recommendedHddSize,
      baseFps,
      hoursPerDay,
    };
  }, [cameras, resolution, fps, compression, retentionDays, hoursPerDay]);

  // ── H.264 vs H.265 comparison ──
  const h264Result: CalculationResult = useMemo(() => {
    const baseFps = 25;
    const bitrateMbps = BITRATE_TABLE['H264']?.[resolution] ?? 4.0;
    const perCameraPerDay = calculateStorageGB(bitrateMbps, fps, baseFps, hoursPerDay, retentionDays);
    const totalStorage = perCameraPerDay * cameras;
    const safetyMargin = totalStorage * 0.20;
    const recommendedHDD = totalStorage + safetyMargin;
    return {
      cameras,
      resolution,
      fps,
      compression: 'H264',
      retentionDays,
      bitrateMbps,
      perCameraPerDay,
      totalPerDay: perCameraPerDay * cameras,
      totalStorage,
      recommendedHDD,
      hddCount: 1,
      recommendedHddSize: '',
      baseFps,
      hoursPerDay,
    };
  }, [cameras, resolution, fps, retentionDays, hoursPerDay]);

  const savingsPercent = Math.round((1 - result.recommendedHDD / h264Result.recommendedHDD) * 100);

  // ── Handlers ──
  const handleReset = () => {
    setCameras(4);
    setResolution('2MP');
    setFps(25);
    setCompression('H265');
    setRetentionDays(30);
    setHoursPerDay(24);
  };

  const handleSaveConfig = () => {
    const name = customName.trim() || `Config ${savedConfigs.length + 1}`;
    setSavedConfigs(prev => [...prev, { name, result: { ...result } }]);
    setCustomName('');
    setShowSaveModal(false);
  };

  const handleDeleteSaved = (index: number) => {
    setSavedConfigs(prev => prev.filter((_, i) => i !== index));
  };

  const handleCopyResult = () => {
    const text = [
      `CCTV Storage Estimation`,
      `─────────────────────`,
      `Cameras: ${result.cameras}`,
      `Resolution: ${result.resolution}`,
      `FPS: ${result.fps}`,
      `Compression: ${result.compression}`,
      `Retention: ${result.retentionDays} days`,
      `Recording: ${result.hoursPerDay} hrs/day`,
      `─────────────────────`,
      `Storage per camera/day: ${formatSize(result.perCameraPerDay)}`,
      `Total daily storage: ${formatSize(result.totalPerDay)}`,
      `Total for ${result.retentionDays} days: ${formatSize(result.totalStorage)}`,
      `With 20% safety margin: ${formatSize(result.recommendedHDD)}`,
      `Recommended HDD: ${result.recommendedHddSize}`,
      `Est. HDD Cost: ${formatBDT(result.recommendedHDD)}`,
      compression === 'H265' ? `\nH.265 saves ~${savingsPercent}% vs H.264` : '',
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopiedResult(true);
    setTimeout(() => setCopiedResult(false), 2000);
  };

  const handleLoadSaved = (config: { name: string; result: CalculationResult }) => {
    setCameras(config.result.cameras);
    setResolution(config.result.resolution);
    setFps(config.result.fps);
    setCompression(config.result.compression as 'H264' | 'H265');
    setRetentionDays(config.result.retentionDays);
    setHoursPerDay(config.result.baseFps === 25 ? 24 : 24);
    setShowSaved(false);
  };

  // ── Render ──
  return (
    <motion.div variants={fadeUp} initial="initial" animate="animate" className="pb-8">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={goBack}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Storage Calculator</h1>
          <p className="text-[11px] text-gray-400">HDD estimation for CCTV systems</p>
        </div>
        <button
          onClick={() => setShowSaved(!showSaved)}
          className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center active:bg-gray-50 transition-colors shadow-sm"
        >
          <Save className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* ── Saved Configurations ── */}
      <AnimatePresence>
        {showSaved && savedConfigs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Saved Configs</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {savedConfigs.map((config, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 border border-gray-100"
                  >
                    <HardDrive className="w-4 h-4 text-violet-500 shrink-0" />
                    <button
                      onClick={() => handleLoadSaved(config)}
                      className="flex-1 text-left min-w-0"
                    >
                      <p className="text-xs font-semibold text-gray-800 truncate">{config.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {config.result.cameras} cam · {config.result.resolution} · {config.result.compression} · {formatSize(config.result.recommendedHDD)}
                      </p>
                    </button>
                    <button
                      onClick={() => handleDeleteSaved(idx)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Calculator className="w-4 h-4 text-violet-600" />
          </div>
          <h2 className="text-sm font-bold text-gray-900">Configure System</h2>
        </div>

        {/* Cameras */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-600">Number of Cameras</label>
            <span className="text-sm font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg">{cameras}</span>
          </div>
          <input
            type="range"
            min={1}
            max={64}
            value={cameras}
            onChange={(e) => setCameras(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-violet-500"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-300">1</span>
            <span className="text-[10px] text-gray-300">64</span>
          </div>
          {/* Quick select chips */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {[1, 4, 8, 16, 32, 64].map((n) => (
              <button
                key={n}
                onClick={() => setCameras(n)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                  cameras === n
                    ? 'bg-violet-500 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Resolution */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Resolution</label>
          <div className="grid grid-cols-4 gap-1.5">
            {RESOLUTION_OPTIONS.map((res) => (
              <button
                key={res}
                onClick={() => setResolution(res)}
                className={cn(
                  'py-2 rounded-xl text-[11px] font-semibold transition-all',
                  resolution === res
                    ? 'bg-violet-500 text-white shadow-sm shadow-violet-500/20'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                )}
              >
                {res}
              </button>
            ))}
          </div>
        </div>

        {/* Frame Rate */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-600">Frame Rate</label>
            <span className="text-sm font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg">{fps} fps</span>
          </div>
          <input
            type="range"
            min={10}
            max={30}
            step={5}
            value={fps}
            onChange={(e) => setFps(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-violet-500"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-300">10 fps</span>
            <span className="text-[10px] text-gray-300">30 fps</span>
          </div>
          <div className="flex gap-1.5 mt-2">
            {FPS_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setFps(f)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                  fps === f
                    ? 'bg-violet-500 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Compression */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Compression Type</label>
          <div className="grid grid-cols-2 gap-2">
            {COMPRESSION_OPTIONS.map((comp) => (
              <button
                key={comp}
                onClick={() => setCompression(comp)}
                className={cn(
                  'py-3 rounded-xl text-xs font-semibold transition-all relative overflow-hidden',
                  compression === comp
                    ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/20'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100'
                )}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{comp}</span>
                </div>
                {comp === 'H265' && (
                  <span className={cn(
                    'text-[9px] font-bold mt-0.5 block',
                    compression === comp ? 'text-white/70' : 'text-emerald-500'
                  )}>
                    ~50% less storage
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Retention Days */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-gray-600">Retention Period</label>
            <span className="text-sm font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg">{retentionDays} days</span>
          </div>
          <input
            type="range"
            min={7}
            max={90}
            step={1}
            value={retentionDays}
            onChange={(e) => setRetentionDays(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-violet-500"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-300">7 days</span>
            <span className="text-[10px] text-gray-300">90 days</span>
          </div>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {RETENTION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setRetentionDays(d)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                  retentionDays === d
                    ? 'bg-violet-500 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Advanced: Hours per Day */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors mb-3"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Advanced Settings</span>
          {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-600">Recording Hours / Day</label>
                  <span className="text-xs font-bold text-gray-700">{hoursPerDay} hrs</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={24}
                  value={hoursPerDay}
                  onChange={(e) => setHoursPerDay(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-violet-500"
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-300">8 hrs</span>
                  <span className="text-[10px] text-gray-300">24 hrs (continuous)</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  Motion-only recording typically uses 40-60% of continuous recording storage.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 text-gray-500 text-xs font-medium hover:bg-gray-100 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset to Defaults
        </button>
      </div>

      {/* ── Results Card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <HardDrive className="w-4 h-4 text-emerald-600" />
          </div>
          <h2 className="text-sm font-bold text-gray-900">Storage Estimate</h2>
        </div>

        {/* Primary Result - HDD Recommendation */}
        <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-5 text-white mb-4 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full" />
          <div className="absolute -bottom-6 -left-6 w-20 h-20 bg-white/5 rounded-full" />
          <div className="relative z-10">
            <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider mb-1">Recommended HDD</p>
            <p className="text-3xl font-extrabold">{formatSize(result.recommendedHDD)}</p>
            <p className="text-white/80 text-xs mt-1">{result.recommendedHddSize} configuration</p>
            <div className="flex items-center gap-3 mt-3 text-[11px] text-white/70">
              <span className="flex items-center gap-1">
                <Camera className="w-3 h-3" />
                {result.cameras} cameras
              </span>
              <span className="flex items-center gap-1">
                <Film className="w-3 h-3" />
                {result.resolution}
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {result.compression}
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Per Camera / Day</span>
            </div>
            <span className="text-xs font-bold text-gray-800">{formatSize(result.perCameraPerDay)}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Total / Day ({result.cameras} cameras)</span>
            </div>
            <span className="text-xs font-bold text-gray-800">{formatSize(result.totalPerDay)}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Film className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs text-gray-500">Total for {result.retentionDays} days</span>
            </div>
            <span className="text-xs font-bold text-gray-800">{formatSize(result.totalStorage)}</span>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-xs text-gray-500">Bitrate / Camera</span>
            </div>
            <span className="text-xs font-bold text-gray-800">{result.bitrateMbps} Mbps</span>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-xs text-gray-500">+ 20% Safety Margin</span>
            </div>
            <span className="text-xs font-bold text-violet-600">{formatSize(result.recommendedHDD - result.totalStorage)}</span>
          </div>
        </div>

        {/* Estimated Cost */}
        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700">Estimated HDD Cost</span>
            <span className="text-sm font-bold text-amber-800">{formatBDT(result.recommendedHDD)}</span>
          </div>
          <p className="text-[10px] text-amber-500 mt-1">*Approximate cost for surveillance-grade HDD</p>
        </div>
      </div>

      {/* ── H.264 vs H.265 Comparison ── */}
      {compression === 'H265' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Layers className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">H.265 vs H.264 Savings</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-center">
              <p className="text-[10px] font-medium text-red-400 mb-1">H.264 Required</p>
              <p className="text-lg font-extrabold text-red-600">{formatSize(h264Result.recommendedHDD)}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
              <p className="text-[10px] font-medium text-emerald-400 mb-1">H.265 Required</p>
              <p className="text-lg font-extrabold text-emerald-600">{formatSize(result.recommendedHDD)}</p>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
            <p className="text-xs text-emerald-600 font-medium">
              You save <span className="text-base font-extrabold">{savingsPercent}%</span> storage with H.265
            </p>
            <p className="text-[10px] text-emerald-500 mt-0.5">
              {formatSize(h264Result.recommendedHDD - result.recommendedHDD)} less storage needed
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Bitrate Reference Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-4">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => {
            const el = document.getElementById('bitrate-ref');
            if (el) el.classList.toggle('hidden');
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Info className="w-4 h-4 text-blue-500" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">Bitrate Reference</h2>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        <div id="bitrate-ref" className="hidden mt-3">
          <p className="text-[10px] text-gray-400 mb-2">Industry-standard bitrate values (Mbps) at 25fps</p>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-1.5 text-gray-400 font-medium">Resolution</th>
                  <th className="text-center py-1.5 text-gray-400 font-medium">H.264</th>
                  <th className="text-center py-1.5 text-gray-400 font-medium">H.265</th>
                </tr>
              </thead>
              <tbody>
                {RESOLUTION_OPTIONS.map((res) => (
                  <tr key={res} className={cn('border-b border-gray-50', resolution === res && 'bg-violet-50/50')}>
                    <td className={cn('py-1.5 font-semibold', resolution === res ? 'text-violet-700' : 'text-gray-600')}>{res}</td>
                    <td className="text-center py-1.5 text-gray-500">{BITRATE_TABLE['H264'][res]} Mbps</td>
                    <td className="text-center py-1.5 text-gray-500">{BITRATE_TABLE['H265'][res]} Mbps</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-300 mt-2 text-center">Formula: Storage(GB) = (Bitrate × 3600 × Hours × Days) / (8 × 1024)</p>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={handleCopyResult}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-gray-200 text-gray-700 text-xs font-semibold active:scale-[0.97] transition-transform shadow-sm"
        >
          {copiedResult ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          {copiedResult ? 'Copied!' : 'Copy Result'}
        </button>
        <button
          onClick={() => setShowSaveModal(true)}
          className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold active:scale-[0.97] transition-transform shadow-lg shadow-violet-500/20"
        >
          <Save className="w-4 h-4" />
          Save Config
        </button>
      </div>

      {/* ── Save Modal ── */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={() => setShowSaveModal(false)}
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[480px] bg-white rounded-t-3xl p-5 pb-8"
            >
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <h3 className="text-sm font-bold text-gray-900 mb-1">Save Configuration</h3>
              <p className="text-[11px] text-gray-400 mb-4">Save this configuration for quick reference later</p>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g., Office Building 8-Cam Setup"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="py-3 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold shadow-lg shadow-violet-500/20"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}