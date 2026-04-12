export function normalizeSpec(spec) {
  return {
    cpu: Number(spec.cpu) || 0,
    ram: Number(spec.ram) || 0,
    vram: Number(spec.vram) || 0,
    disk: Number(spec.disk) || 0,
    cpuName: spec.cpuName || "Unknown CPU",
    gpuName: spec.gpuName || "Unknown GPU",
    ramGb: Number(spec.ram) || 0,
    diskFree: Number(spec.disk) || 0,
  };
}

export function analyzeOne(spec, sw) {
  const checks = [
    ["CPU", spec.cpu, sw.min.cpu, sw.rec.cpu],
    ["RAM", spec.ram, sw.min.ram, sw.rec.ram],
    ["GPU", spec.vram, sw.min.vram, sw.rec.vram],
    ["Storage", spec.disk, sw.min.disk, sw.rec.disk],
  ];

  let totalScore = 0;
  const details = checks.map(([label, user, mn, rec]) => {
    let status, score, pct;

    if (mn === 0 && rec === 0) {
      status = "optimal";
      score = 25;
      pct = 100;
    } else if (user >= rec) {
      status = "optimal";
      score = 25;
      pct = 100;
    } else if (user >= mn) {
      status = "minimum";
      score = 15;
      pct = 50 + ((user - mn) / Math.max(rec - mn, 1)) * 50;
    } else {
      status = "below";
      score = 0;
      pct = (user / Math.max(mn, 1)) * 50;
    }

    totalScore += score;
    return {
      label,
      user,
      min: mn,
      rec,
      status,
      pct: Math.round(Math.min(pct, 100)),
    };
  });

  let grade, label, color;
  if (totalScore >= 90) {
    grade = "S";
    label = "Sangat Optimal";
    color = "#22d3ee";
  } else if (totalScore >= 70) {
    grade = "A";
    label = "Direkomendasikan";
    color = "#4ade80";
  } else if (totalScore >= 50) {
    grade = "B";
    label = "Bisa (Minimum)";
    color = "#fbbf24";
  } else if (totalScore >= 25) {
    grade = "C";
    label = "Di Bawah Minimum";
    color = "#fb923c";
  } else {
    grade = "D";
    label = "Tidak Bisa";
    color = "#f87171";
  }

  return {
    totalScore,
    grade,
    label,
    color,
    details,
  };
}

export function analyzeSoftware(spec, softwareList) {
  const normalized = normalizeSpec(spec);
  return softwareList.map((sw) => ({
    ...sw,
    result: analyzeOne(normalized, sw),
  }));
}

export function calculateStats(results) {
  return {
    canRun: results.filter((r) => r.result.totalScore >= 50).length,
    optimal: results.filter((r) => r.result.totalScore >= 90).length,
    cantRun: results.filter((r) => r.result.totalScore < 25).length,
    gamesOk: results.filter(
      (r) => r.cat === "Game" && r.result.totalScore >= 70,
    ).length,
    total: results.length,
  };
}
