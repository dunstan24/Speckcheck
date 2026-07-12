import { matchCpu, matchGpu } from './hardwareMatcher'

export function normalizeSpec(spec) {
  return {
    cpu:      Number(spec.cpu) || 0,
    ram:      Number(spec.ram) || 0,
    vram:     Number(spec.vram) || 0,
    disk:     Number(spec.disk) || 0,
    cpuName:  spec.cpuName || 'Unknown CPU',
    gpuName:  spec.gpuName || 'Unknown GPU',
    ramGb:    Number(spec.ram) || 0,
    diskFree: Number(spec.disk) || 0,
    os:       spec.os || 'Unknown OS',
  }
}

export function analyzeOne(spec, sw) {
  // Resolve user hardware to perf scores
  const cpuMatch = matchCpu(spec.cpuName, spec.cpu)
  const gpuMatch = matchGpu(spec.gpuName, spec.vram)
  const userCpuScore = cpuMatch.score
  const userGpuScore = gpuMatch.score

  // Game requirement scores (backend sets gpu_score; fallback: vram * 3000)
  const minCpu = sw.min.cpu || 0
  const recCpu = sw.rec.cpu || 0
  const minGpu = sw.min.gpu_score ?? (sw.min.vram * 3000)
  const recGpu = sw.rec.gpu_score ?? (sw.rec.vram * 3000)

  const checks = [
    ['CPU',     userCpuScore, minCpu, recCpu],
    ['RAM',     spec.ram,     sw.min.ram,  sw.rec.ram],
    ['GPU',     userGpuScore, minGpu, recGpu],
    ['Storage', spec.disk,    sw.min.disk, sw.rec.disk],
  ]

  let totalScore = 0
  let isBelowMin = false
  let criticalFailure = false
  let unknownCount = 0

  const details = checks.map(([label, user, mn, rec]) => {
    let status, score, pct

    if (mn === 0 && rec === 0) {
      status = 'unknown'; score = 25; pct = 100; unknownCount++
    } else if (rec > 0 && user >= rec) {
      status = 'optimal'; score = 25; pct = 100
    } else if (mn > 0 && user >= mn) {
      status = 'minimum'; score = 15
      pct = rec > mn ? 50 + ((user - mn) / (rec - mn)) * 50 : 75
    } else {
      status = 'below'; score = 0
      const divisor = mn > 0 ? mn : rec
      pct = (user / Math.max(divisor, 1)) * 50
      isBelowMin = true
      if (label === 'Storage' || user === 0) criticalFailure = true
    }

    totalScore += score
    return { label, user, min: mn, rec, status, pct: Math.round(Math.min(pct, 100)) }
  })

  if (unknownCount === 4) totalScore = -1
  else if (criticalFailure) totalScore = Math.min(totalScore, 24)
  else if (isBelowMin)      totalScore = Math.min(totalScore, 49)

  let grade, label, color
  if      (totalScore === -1) { grade = '?'; label = 'Data Belum Tersedia'; color = '#94a3b8' }
  else if (totalScore >= 90)  { grade = 'S'; label = 'Sangat Optimal';       color = '#22d3ee' }
  else if (totalScore >= 70)  { grade = 'A'; label = 'Direkomendasikan';      color = '#4ade80' }
  else if (totalScore >= 50)  { grade = 'B'; label = 'Bisa (Minimum)';        color = '#fbbf24' }
  else if (totalScore >= 25)  { grade = 'C'; label = 'Di Bawah Minimum';      color = '#fb923c' }
  else                         { grade = 'D'; label = 'Tidak Bisa';            color = '#f87171' }

  return { totalScore, grade, label, color, details }
}

export function analyzeSoftware(spec, softwareList) {
  const normalized = normalizeSpec(spec)
  return softwareList.map(sw => ({ ...sw, result: analyzeOne(normalized, sw) }))
}

export function calculateStats(results) {
  return {
    canRun:  results.filter(r => r.result.totalScore >= 50).length,
    optimal: results.filter(r => r.result.totalScore >= 90).length,
    cantRun: results.filter(r => r.result.totalScore < 25).length,
    gamesOk: results.filter(r => r.cat === 'Game' && r.result.totalScore >= 70).length,
    total:   results.length,
  }
}
