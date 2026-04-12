"""
SpecCheck_Detect.py
Deteksi spesifikasi PC Windows lalu buka browser ke SpecCheck.AI

Cara pakai:
  python speccheck_detect.py
  atau build ke .exe dengan BUILD.bat
"""

import platform
import subprocess
import webbrowser
import urllib.parse
import sys
import os

def get_cpu_mhz():
    try:
        import wmi
        c = wmi.WMI()
        for cpu in c.Win32_Processor():
            return int(cpu.MaxClockSpeed)
    except:
        pass
    try:
        import psutil
        freq = psutil.cpu_freq()
        if freq:
            return int(freq.max or freq.current)
    except:
        pass
    return 2000

def get_ram_gb():
    try:
        import psutil
        return round(psutil.virtual_memory().total / (1024**3))
    except:
        return 8

def get_gpu_vram():
    try:
        import wmi
        c = wmi.WMI()
        for gpu in c.Win32_VideoController():
            vram = getattr(gpu, 'AdapterRAM', 0) or 0
            name = getattr(gpu, 'Name', '') or ''
            if vram > 0:
                return round(vram / (1024**3), 1), name
    except:
        pass
    return 0, "Unknown GPU"

def get_disk_gb():
    try:
        import psutil
        usage = psutil.disk_usage('C:\\' if platform.system() == 'Windows' else '/')
        return round(usage.free / (1024**3))
    except:
        return 50

def get_cpu_name():
    try:
        import wmi
        c = wmi.WMI()
        for cpu in c.Win32_Processor():
            return cpu.Name.strip()
    except:
        pass
    return platform.processor() or "Unknown CPU"

def main():
    print("\n  SpecCheck.AI — Mendeteksi Spesifikasi PC...\n")

    cpu_mhz  = get_cpu_mhz()
    cpu_name = get_cpu_name()
    ram_gb   = get_ram_gb()
    vram_gb, gpu_name = get_gpu_vram()
    disk_gb  = get_disk_gb()

    print(f"  CPU  : {cpu_name} ({cpu_mhz} MHz)")
    print(f"  RAM  : {ram_gb} GB")
    print(f"  GPU  : {gpu_name} ({vram_gb} GB VRAM)")
    print(f"  Disk : {disk_gb} GB tersedia")

    params = urllib.parse.urlencode({
        "cpu":     cpu_mhz,
        "ram":     ram_gb,
        "vram":    vram_gb,
        "disk":    disk_gb,
        "cpuName": cpu_name,
        "gpuName": gpu_name,
        "ramGb":   ram_gb,
        "diskFree": disk_gb,
    })
    url = f"http://localhost:5173/results?{params}"
    print(f"\n  Membuka: {url}\n")
    webbrowser.open(url)
    input("  Tekan Enter untuk keluar...")

if __name__ == "__main__":
    main()
