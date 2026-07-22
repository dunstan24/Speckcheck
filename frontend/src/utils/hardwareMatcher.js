import cpuData from '../data/cpus.json'
import gpuData from '../data/gpus.json'

export function tokenize(s) {
  if (!s) return new Set()
  // Hapus symbol (r), (tm), registered, trademark, tanda kurung, koma, titik
  const clean = s.replace(/\(r\)|\(tm\)|[®™\(\),\._\.]/gi, '')
  const tokens = new Set(clean.toLowerCase().split(/[\s\-/_]+/).filter(Boolean))
  
  // Tambahkan token tanpa suffix huruf untuk model CPU/GPU (contoh: "12400f" -> "12400")
  for (const token of tokens) {
    const match = token.match(/^(\d{2,})[a-z]+$/)
    if (match) {
      tokens.add(match[1])
    }
  }
  return tokens
}

export function extractNumbers(s) {
  if (!s) return new Set()
  const clean = s
    .replace(/\(r\)|\(tm\)|[®™\(\),\._\.]/gi, '')
    .replace(/@\s*\d+(?:\.\d+)?\s*(?:ghz|mhz)/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:ghz|mhz)\b/gi, '')
    .replace(/\b\d+\s*(?:gb|mb)\s*(?:vram|of vram)?\b/gi, '')
    .replace(/\b\d+(?:st|nd|rd|th)\b/gi, '')
  const matches = clean.toLowerCase().match(/\d{2,}/g)
  return new Set(matches || [])
}

function score(queryTokens, candidateName) {
  const cand = tokenize(candidateName)
  const intersection = [...queryTokens].filter(t => cand.has(t)).length
  return intersection / Math.max(queryTokens.size, cand.size)
}

export function mhzToScore(mhz) {
  const m = Number(mhz) || 0
  if (m <= 0)   return 0
  if (m < 1000) return Math.max(100, m * 0.1)
  if (m < 2000) return 1000 + (m - 1000) * 1.5
  if (m < 3000) return 2500 + (m - 2000) * 5
  if (m < 4000) return 7500 + (m - 3000) * 8
  if (m < 5000) return 15500 + (m - 4000) * 10
  return 25500 + (m - 5000) * 8
}

export function vramToScore(vram) {
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

  let resolvedMhz = fallbackMhz
  if (resolvedMhz <= 0) {
    const ghzMatch = nameStr.match(/(\d+(?:\.\d+)?)\s*ghz/i)
    if (ghzMatch) {
      resolvedMhz = Math.round(parseFloat(ghzMatch[1]) * 1000)
    } else {
      const mhzMatch = nameStr.match(/(\d+)\s*mhz/i)
      if (mhzMatch) {
        resolvedMhz = parseInt(mhzMatch[1], 10)
      }
    }
  }

  const tokens = tokenize(nameStr)
  const queryNums = extractNumbers(nameStr)
  let best = null, bestScore = 0
  for (const cpu of cpuData) {
    // Enforce model number constraint
    const candNums = extractNumbers(cpu.name)
    if (queryNums.size > 0 && candNums.size > 0) {
      const hasIntersection = [...queryNums].some(n => candNums.has(n))
      if (!hasIntersection) continue
    }

    const s = score(tokens, cpu.name)
    if (s > bestScore) { bestScore = s; best = cpu }
  }
  if (best && bestScore >= 0.3) {
    return { score: best.perf_score, name: best.name, found: true, data: best }
  }
  return { score: mhzToScore(resolvedMhz), name: nameStr, found: false }
}

export function extractVramFromName(nameStr) {
  if (!nameStr) return 0
  const sLower = nameStr.toLowerCase()
  const matchVramGb = sLower.match(/(\d+(?:\.\d+)?)\s*gb\s*(?:of\s*)?vram/)
  if (matchVramGb) {
    return parseFloat(matchVramGb[1])
  }
  const matchVramMb = sLower.match(/(\d+)\s*mb\s*(?:of\s*)?vram/)
  if (matchVramMb) {
    return Math.round((parseInt(matchVramMb[1], 10) / 1024) * 100) / 100
  }
  const matchGb = sLower.match(/(\d+(?:\.\d+)?)\s*gb/)
  if (matchGb) {
    return parseFloat(matchGb[1])
  }
  const matchMb = sLower.match(/(\d+)\s*mb/)
  if (matchMb) {
    return Math.round((parseInt(matchMb[1], 10) / 1024) * 100) / 100
  }
  if (sLower.includes("nvidia") || sLower.includes("geforce")) {
    if (["rtx 3080", "rtx 4080", "rtx 2080", "gtx 1080"].some(x => sLower.includes(x))) return 8.0
    if (["rtx 3060", "rtx 4060", "rtx 2060", "gtx 1060"].some(x => sLower.includes(x))) return 6.0
    if (["gtx 1050", "gtx 960", "gtx 760"].some(x => sLower.includes(x))) return 4.0
    if (["gtx 750", "gtx 660", "gt 1030"].some(x => sLower.includes(x))) return 2.0
    return 1.0
  }
  if (sLower.includes("radeon") || sLower.includes("amd") || sLower.includes("ati")) {
    if (sLower.includes("rx")) return 4.0
    return 1.0
  }
  if (sLower.includes("intel hd") || sLower.includes("intel iris") || sLower.includes("graphics") || sLower.includes("gma")) {
    return 0.5
  }
  return 0.0
}

export function matchGpu(nameStr, fallbackVram = 0) {
  if (!nameStr || !nameStr.trim()) {
    return { score: vramToScore(fallbackVram), name: 'Unknown GPU', found: false }
  }
  const tokens = tokenize(nameStr)
  const queryNums = extractNumbers(nameStr)
  let best = null, bestScore = 0
  for (const gpu of gpuData) {
    // Enforce model number constraint
    const candNums = extractNumbers(gpu.name)
    if (queryNums.size > 0 && candNums.size > 0) {
      const hasIntersection = [...queryNums].some(n => candNums.has(n))
      if (!hasIntersection) continue
    }

    const s = score(tokens, gpu.name)
    if (s > bestScore) { bestScore = s; best = gpu }
  }
  if (best && bestScore >= 0.3) {
    return { score: best.perf_score, name: best.name, found: true, data: best }
  }
  const resolvedVram = fallbackVram > 0 ? fallbackVram : extractVramFromName(nameStr)
  return { score: vramToScore(resolvedVram), name: nameStr, found: false }
}


export function splitConcatenatedSpecs(s) {
  if (!s) return ''
  // Sisipkan " / " sebelum kata kunci AMD, Intel, Nvidia, Radeon, GeForce, ATI, DirectX, Shader
  // yang didahului karakter, dan tidak diikuti huruf kecil (lookahead)
  let cleaned = s.replace(/([a-zA-Z0-9])(AMD|Intel|Nvidia|Radeon|GeForce|ATI|DirectX|Shader)(?![a-z])/gi, '$1 / $2')
  
  // Pisahkan model number dari VRAM yang menempel (misal: 3870512 MB -> 3870 512 MB, atau 16503 GB -> 1650 3 GB)
  cleaned = cleaned.replace(/(\d+)(1024|2048|4096|128|256|512|10|11|12|16|20|24|1|2|3|4|5|6|8)(?=\s*(MB|GB|VRAM|of))/gi, '$1 $2')

  // Pisahkan angka yang menempel di belakang kata (length >= 2 untuk hindari "i5" -> "i 5")
  cleaned = cleaned.replace(/([a-zA-Z]{2,})(\d+)/g, '$1 $2')
  return cleaned
}


export function resolveGameRequirement(cpuRaw, gpuRaw) {
  const cpuCleaned = splitConcatenatedSpecs(cpuRaw)
  const gpuCleaned = splitConcatenatedSpecs(gpuRaw)

  const splitAlts = s => (s || '').split(/\s*\/\s*|\s+or\s+/i).filter(Boolean)

  const cpuParts = splitAlts(cpuCleaned)
  const gpuParts = splitAlts(gpuCleaned)

  const cpuScores = cpuParts.map(p => matchCpu(p.trim())).filter(res => {
    // Abaikan jika tidak cocok (score 0 dan nama mengandung Unknown atau nama sama dengan input)
    if (res.score === 0 && (res.name.includes('Unknown') || !res.found)) {
      return false
    }
    return true
  }).map(res => res.score)

  const gpuScores = gpuParts.map(p => matchGpu(p.trim())).filter(res => {
    if (res.score === 0 && (res.name.includes('Unknown') || !res.found)) {
      return false
    }
    return true
  }).map(res => res.score)

  const cpuScore = cpuScores.length ? Math.min(...cpuScores) : 0
  const gpuScore = gpuScores.length ? Math.min(...gpuScores) : 0

  return { cpuScore, gpuScore }
}

export { cpuData, gpuData }
