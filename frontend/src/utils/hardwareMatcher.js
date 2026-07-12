import cpuData from '../data/cpus.json'
import gpuData from '../data/gpus.json'

function tokenize(s) {
  return new Set(s.toLowerCase().split(/[\s\-/]+/).filter(Boolean))
}

function score(queryTokens, candidateName) {
  const cand = tokenize(candidateName)
  const intersection = [...queryTokens].filter(t => cand.has(t)).length
  return intersection / Math.max(queryTokens.size, cand.size)
}

function mhzToScore(mhz) {
  const m = Number(mhz) || 0
  if (m <= 0)   return 0
  if (m < 1000) return Math.max(100, m * 0.1)
  if (m < 2000) return 1000 + (m - 1000) * 1.5
  if (m < 3000) return 2500 + (m - 2000) * 5
  if (m < 4000) return 7500 + (m - 3000) * 8
  if (m < 5000) return 15500 + (m - 4000) * 10
  return 25500 + (m - 5000) * 8
}

function vramToScore(vram) {
  const v = Number(vram) || 0
  if (v <= 0)  return 0
  if (v < 1)   return 600
  if (v < 2)   return 1200
  if (v < 4)   return 3000
  if (v < 6)   return 6000
  if (v < 8)   return 8000
  if (v < 12)  return 12000
  if (v < 16)  return 18000
  if (v < 24)  return 25000
  return 35000
}

export function matchCpu(nameStr, fallbackMhz = 0) {
  if (!nameStr || !nameStr.trim()) {
    return { score: mhzToScore(fallbackMhz), name: 'Unknown CPU', found: false }
  }
  const tokens = tokenize(nameStr)
  let best = null, bestScore = 0
  for (const cpu of cpuData) {
    const s = score(tokens, cpu.name)
    if (s > bestScore) { bestScore = s; best = cpu }
  }
  if (best && bestScore >= 0.3) {
    return { score: best.perf_score, name: best.name, found: true, data: best }
  }
  return { score: mhzToScore(fallbackMhz), name: nameStr, found: false }
}

export function matchGpu(nameStr, fallbackVram = 0) {
  if (!nameStr || !nameStr.trim()) {
    return { score: vramToScore(fallbackVram), name: 'Unknown GPU', found: false }
  }
  const tokens = tokenize(nameStr)
  let best = null, bestScore = 0
  for (const gpu of gpuData) {
    const s = score(tokens, gpu.name)
    if (s > bestScore) { bestScore = s; best = gpu }
  }
  if (best && bestScore >= 0.3) {
    return { score: best.perf_score, name: best.name, found: true, data: best }
  }
  return { score: vramToScore(fallbackVram), name: nameStr, found: false }
}

export function resolveGameRequirement(cpuRaw, gpuRaw) {
  const splitAlts = s => (s || '').split(/\s*\/\s*|\s+or\s+/i).filter(Boolean)

  const cpuParts = splitAlts(cpuRaw)
  const gpuParts = splitAlts(gpuRaw)

  const cpuScore = cpuParts.length
    ? Math.min(...cpuParts.map(p => matchCpu(p.trim()).score))
    : 0
  const gpuScore = gpuParts.length
    ? Math.min(...gpuParts.map(p => matchGpu(p.trim()).score))
    : 0

  return { cpuScore, gpuScore }
}

export { cpuData, gpuData }
