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
    """Clean up string and return a set of normalized tokens."""
    if not s:
        return set()
    # Remove trademark symbols and common punctuation/brackets
    s_clean = re.sub(r"\(r\)|\(tm\)|[®™\(\),\._\.]", "", s, flags=re.IGNORECASE)
    # Split on spaces, dashes, slashes
    tokens = set(re.split(r"[\s\-/_]+", s_clean.lower()))
    tokens = {t for t in tokens if t}
    
    # Add extra tokens without letter suffix (e.g. "12400f" -> "12400", "3600x" -> "3600")
    extra_tokens = set()
    for token in tokens:
        match = re.match(r"^(\d{2,})[a-z]+$", token)
        if match:
            extra_tokens.add(match.group(1))
    return tokens.union(extra_tokens)

def _extract_numbers(s):
    """Find all numeric digits of length >= 2 in the string."""
    if not s:
        return set()
    s_clean = re.sub(r"\(r\)|\(tm\)|[®™\(\),\._\.]", "", s, flags=re.IGNORECASE)
    return set(re.findall(r"\d{2,}", s_clean.lower()))

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
        return mhz_to_score(fallback_mhz), "Unknown CPU"

    cpus = get_cpus()
    if not cpus:
        return mhz_to_score(fallback_mhz), name_str

    tokens = _tokenize(name_str)
    query_nums = _extract_numbers(name_str)
    best, best_score = None, 0.0
    for cpu in cpus:
        # Enforce model number exact match constraint if both have model numbers
        cand_nums = _extract_numbers(cpu["name"])
        if query_nums and cand_nums:
            if not query_nums.intersection(cand_nums):
                continue

        s = _score(tokens, cpu["name"])
        if s > best_score:
            best_score = s
            best = cpu

    # Accept match if similarity >= 0.3
    if best and best_score >= 0.3:
        return best["perf_score"], best["name"]
    # fallback: use MHz heuristic
    return mhz_to_score(fallback_mhz), name_str

def extract_vram_from_name(name_str):
    if not name_str:
        return 0.0
    s_lower = name_str.lower()
    match_vram_gb = re.search(r'(\d+(?:\.\d+)?)\s*gb\s*(?:of\s*)?vram', s_lower)
    if match_vram_gb:
        return float(match_vram_gb.group(1))
    match_vram_mb = re.search(r'(\d+)\s*mb\s*(?:of\s*)?vram', s_lower)
    if match_vram_mb:
        return round(int(match_vram_mb.group(1)) / 1024.0, 2)
    match_gb = re.search(r'(\d+(?:\.\d+)?)\s*gb', s_lower)
    if match_gb:
        return float(match_gb.group(1))
    match_mb = re.search(r'(\d+)\s*mb', s_lower)
    if match_mb:
        return round(int(match_mb.group(1)) / 1024.0, 2)
    if "nvidia" in s_lower or "geforce" in s_lower:
        if any(x in s_lower for x in ["rtx 3080", "rtx 4080", "rtx 2080", "gtx 1080"]):
            return 8.0
        if any(x in s_lower for x in ["rtx 3060", "rtx 4060", "rtx 2060", "gtx 1060"]):
            return 6.0
        if any(x in s_lower for x in ["gtx 1050", "gtx 960", "gtx 760"]):
            return 4.0
        if any(x in s_lower for x in ["gtx 750", "gtx 660", "gt 1030"]):
            return 2.0
        return 1.0
    if "radeon" in s_lower or "amd" in s_lower or "ati" in s_lower:
        if "rx" in s_lower:
            return 4.0
        return 1.0
    if "intel hd" in s_lower or "intel iris" in s_lower or "graphics" in s_lower or "gma" in s_lower:
        return 0.5
    return 0.0

def match_gpu(name_str, fallback_vram=0):
    """
    Return (perf_score, matched_name).
    Falls back to a VRAM-derived estimate if no match found.
    """
    if not name_str or name_str.strip() == "":
        return vram_to_score(fallback_vram), "Unknown GPU"

    gpus = get_gpus()
    if not gpus:
        return vram_to_score(fallback_vram), name_str

    tokens = _tokenize(name_str)
    query_nums = _extract_numbers(name_str)
    best, best_score = None, 0.0
    for gpu in gpus:
        # Enforce model number exact match constraint if both have model numbers
        cand_nums = _extract_numbers(gpu["name"])
        if query_nums and cand_nums:
            if not query_nums.intersection(cand_nums):
                continue

        s = _score(tokens, gpu["name"])
        if s > best_score:
            best_score = s
            best = gpu

    if best and best_score >= 0.3:
        return best["perf_score"], best["name"]
    
    resolved_vram = fallback_vram if fallback_vram > 0 else extract_vram_from_name(name_str)
    return vram_to_score(resolved_vram), name_str


def mhz_to_score(mhz):
    """Convert raw clock speed (MHz) to approximate perf_score."""
    mhz = int(mhz or 0)
    if mhz <= 0:   return 0
    if mhz < 1000: return max(100, mhz * 0.1)
    if mhz < 2000: return 1000 + (mhz - 1000) * 1.5
    if mhz < 3000: return 2500 + (mhz - 2000) * 5
    if mhz < 4000: return 7500 + (mhz - 3000) * 8
    if mhz < 5000: return 15500 + (mhz - 4000) * 10
    return 25500 + (mhz - 5000) * 8

def vram_to_score(vram_gb):
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

def split_concatenated_specs(s):
    """
    Format concatenated specifications from scraping.
    Inserts a slash separator before hardware vendor keywords and space before glued digits.
    Example: "i5-9500AMD" -> "i5-9500 / AMD"
    """
    if not s:
        return ""
    # Sisipkan " / " sebelum kata kunci AMD, Intel, Nvidia, Radeon, GeForce, ATI, DirectX, Shader
    # yang didahului karakter, dan tidak diikuti huruf kecil (lookahead)
    cleaned = re.sub(
        r'([a-zA-Z0-9])(AMD|Intel|Nvidia|Radeon|GeForce|ATI|DirectX|Shader)(?![a-z])',
        r'\1 / \2',
        s,
        flags=re.IGNORECASE
    )
    # Pisahkan model number dari VRAM yang menempel (misal: 3870512 MB -> 3870 512 MB, atau 16503 GB -> 1650 3 GB)
    cleaned = re.sub(
        r'(\d+)(1024|2048|4096|128|256|512|10|11|12|16|20|24|1|2|3|4|5|6|8)(?=\s*(MB|GB|VRAM|of))',
        r'\1 \2',
        cleaned,
        flags=re.IGNORECASE
    )
    # Pisahkan digit yang menempel di belakang kata (panjang kata >= 2 untuk menghindari "i5" -> "i 5")
    cleaned = re.sub(r'([a-zA-Z]{2,})(\d+)', r'\1 \2', cleaned)
    return cleaned

def resolve_game_requirement(cpu_raw, gpu_raw):
    """
    For a raw game requirement string (may contain alternatives like 'i5-2500K / FX-6300'),
    returns the LOWER of matched scores (minimum = can run with weaker hardware).
    """
    # Clean concatenated specifications before processing
    cpu_cleaned = split_concatenated_specs(cpu_raw or "")
    gpu_cleaned = split_concatenated_specs(gpu_raw or "")

    def pick_best_from_alts(raw, match_fn):
        parts = re.split(r"\s*/\s*|\s+or\s+", raw, flags=re.IGNORECASE)
        scores = []
        for p in parts:
            p_str = p.strip()
            if not p_str:
                continue
            score, matched_name = match_fn(p_str)
            # Abaikan noise/deskripsi alternatif yang gagal di-match (score 0 dan nama default/Unknown)
            if ("Unknown" in matched_name or matched_name == p_str) and score == 0:
                continue
            scores.append(score)
        return min(scores) if scores else 0

    cpu_score = pick_best_from_alts(cpu_cleaned, lambda s: match_cpu(s))
    gpu_score = pick_best_from_alts(gpu_cleaned, lambda s: match_gpu(s))
    return cpu_score, gpu_score
