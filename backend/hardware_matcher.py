"""
hardware_matcher.py
Matches arbitrary CPU/GPU name strings to the closest entry in our JSON databases.
Uses token-based scoring (no external deps).
"""
import os, json, re

_DIR = os.path.join(os.path.dirname(__file__), "data")

def _load(filename):
    path = os.path.join(_DIR, filename)
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)

_CPUS = None
_GPUS = None

def get_cpus():
    global _CPUS
    if _CPUS is None:
        _CPUS = _load("cpus.json")
    return _CPUS

def get_gpus():
    global _GPUS
    if _GPUS is None:
        _GPUS = _load("gpus.json")
    return _GPUS

def _tokenize(s):
    """Lowercase, split on spaces/dashes/slashes, remove empties."""
    return set(re.split(r"[\s\-/]+", s.lower()))

def _score(query_tokens, candidate_name):
    cand_tokens = _tokenize(candidate_name)
    if not query_tokens:
        return 0
    matches = len(query_tokens & cand_tokens)
    return matches / max(len(query_tokens), len(cand_tokens))

def match_cpu(name_str, fallback_mhz=0):
    """
    Return (perf_score, matched_name).
    Falls back to a MHz-derived estimate if no match found.
    """
    if not name_str or name_str.strip() == "":
        return _mhz_to_score(fallback_mhz), "Unknown CPU"

    cpus = get_cpus()
    if not cpus:
        return _mhz_to_score(fallback_mhz), name_str

    tokens = _tokenize(name_str)
    best, best_score = None, 0.0
    for cpu in cpus:
        s = _score(tokens, cpu["name"])
        if s > best_score:
            best_score = s
            best = cpu

    # Accept match if similarity >= 0.3
    if best and best_score >= 0.3:
        return best["perf_score"], best["name"]
    # fallback: use MHz heuristic
    return _mhz_to_score(fallback_mhz), name_str

def match_gpu(name_str, fallback_vram=0):
    """
    Return (perf_score, matched_name).
    Falls back to a VRAM-derived estimate if no match found.
    """
    if not name_str or name_str.strip() == "":
        return _vram_to_score(fallback_vram), "Unknown GPU"

    gpus = get_gpus()
    if not gpus:
        return _vram_to_score(fallback_vram), name_str

    tokens = _tokenize(name_str)
    best, best_score = None, 0.0
    for gpu in gpus:
        s = _score(tokens, gpu["name"])
        if s > best_score:
            best_score = s
            best = gpu

    if best and best_score >= 0.3:
        return best["perf_score"], best["name"]
    return _vram_to_score(fallback_vram), name_str

def _mhz_to_score(mhz):
    """Convert raw clock speed (MHz) to approximate perf_score."""
    mhz = int(mhz or 0)
    if mhz <= 0:   return 0
    if mhz < 1000: return max(100, mhz * 0.1)
    if mhz < 2000: return 1000 + (mhz - 1000) * 1.5
    if mhz < 3000: return 2500 + (mhz - 2000) * 5
    if mhz < 4000: return 7500 + (mhz - 3000) * 8
    if mhz < 5000: return 15500 + (mhz - 4000) * 10
    return 25500 + (mhz - 5000) * 8

def _vram_to_score(vram_gb):
    """Convert VRAM GB to rough GPU perf_score."""
    v = float(vram_gb or 0)
    if v <= 0:   return 0
    if v < 1:    return 600
    if v < 2:    return 1200
    if v < 4:    return 3000
    if v < 6:    return 6000
    if v < 8:    return 8000
    if v < 12:   return 12000
    if v < 16:   return 18000
    if v < 24:   return 25000
    return 35000

def resolve_game_requirement(cpu_raw, gpu_raw):
    """
    For a raw game requirement string (may contain alternatives like 'i5-2500K / FX-6300'),
    returns the LOWER of matched scores (minimum = can run with weaker hardware).
    """
    # Split on OR indicators
    def pick_best_from_alts(raw, match_fn):
        parts = re.split(r"\s*/\s*|\s+or\s+", raw, flags=re.IGNORECASE)
        scores = [match_fn(p.strip())[0] for p in parts if p.strip()]
        return max(scores) if scores else 0

    cpu_score = pick_best_from_alts(cpu_raw or "", lambda s: match_cpu(s))
    gpu_score = pick_best_from_alts(gpu_raw or "", lambda s: match_gpu(s))
    return cpu_score, gpu_score
