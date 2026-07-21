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

def get_gpu_vram_registry():
    """Membaca VRAM dari Windows Registry untuk menghindari bug 32-bit (4GB) pada WMI."""
    try:
        import winreg
        path = r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, path) as key:
            for i in range(10):
                try:
                    sub_key_name = winreg.EnumKey(key, i)
                    if sub_key_name.isdigit():
                        sub_path = path + "\\" + sub_key_name
                        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, sub_path) as sub_key:
                            try:
                                name, _ = winreg.QueryValueEx(sub_key, "DriverDesc")
                                try:
                                    mem_size, _ = winreg.QueryValueEx(sub_key, "HardwareInformation.MemorySize")
                                    if mem_size > 0:
                                        # Ubah dari bytes ke GB
                                        return round(mem_size / (1024**3), 1), name
                                except:
                                    pass
                            except:
                                pass
                except OSError:
                    break
    except:
        pass
    return None

def get_gpu_vram():
    # 1. Coba baca via Registry (paling akurat untuk modern GPU di Windows)
    reg_val = get_gpu_vram_registry()
    if reg_val:
        return reg_val

    # 2. Fallback ke WMI
    try:
        import wmi
        c = wmi.WMI()
        for gpu in c.Win32_VideoController():
            vram = getattr(gpu, 'AdapterRAM', 0) or 0
            name = getattr(gpu, 'Name', '') or ''
            if vram > 0:
                # Koreksi jika terkena bug unsigned 32-bit limit (4GB) tapi nama GPU modern
                if vram == 4294967295 or vram == 4294967296:
                    return 4.0, name
                return round(vram / (1024**3), 1), name
    except:
        pass

    # 3. Fallback ke dxdiag / PowerShell command
    try:
        cmd = 'powershell -command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM"'
        proc = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        out, _ = proc.communicate()
        out_str = out.decode('utf-8', errors='ignore')
        # Sederhana: cari angka besar
        import re
        nums = re.findall(r'\d+', out_str)
        if nums:
            # Cari angka di atas 1 juta (bytes)
            for n in nums:
                val = int(n)
                if val > 1000000:
                    return round(val / (1024**3), 1), "Graphics Adapter"
    except:
        pass

    return 0.0, "Unknown GPU"

def get_disk_gb():
    try:
        import psutil
        usage = psutil.disk_usage('C:\\' if platform.system() == 'Windows' else '/')
        return round(usage.free / (1024**3))
    except:
        pass
    # Alternatif jika psutil gagal (misal belum diinstall saat run manual)
    try:
        import shutil
        total, used, free = shutil.disk_usage('C:\\' if platform.system() == 'Windows' else '/')
        return round(free / (1024**3))
    except:
        pass
    return 50

def get_cpu_name():
    try:
        import wmi
        c = wmi.WMI()
        for cpu in c.Win32_Processor():
            return cpu.Name.strip()
    except:
        pass
    # Fallback ke registry jika WMI corrupt
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
        name, _ = winreg.QueryValueEx(key, "ProcessorNameString")
        return name.strip()
    except:
        pass
    return platform.processor() or "Unknown CPU"

def get_os_name():
    try:
        import wmi
        c = wmi.WMI()
        for os_info in c.Win32_OperatingSystem():
            return os_info.Caption.strip()
    except:
        pass
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        product_name, _ = winreg.QueryValueEx(key, "ProductName")
        try:
            display_version, _ = winreg.QueryValueEx(key, "DisplayVersion")
            return f"{product_name} {display_version}".strip()
        except:
            return product_name.strip()
    except:
        pass
    return f"{platform.system()} {platform.release()}"

def main():
    cpu_mhz  = get_cpu_mhz()
    cpu_name = get_cpu_name()
    ram_gb   = get_ram_gb()
    vram_gb, gpu_name = get_gpu_vram()
    disk_gb  = get_disk_gb()
    os_name  = get_os_name()

    params = urllib.parse.urlencode({
        "cpu":     cpu_mhz,
        "ram":     ram_gb,
        "vram":    vram_gb,
        "disk":    disk_gb,
        "cpuName": cpu_name,
        "gpuName": gpu_name,
        "ramGb":   ram_gb,
        "diskFree": disk_gb,
        "os":      os_name,
    })
    url = f"https://bisamainnggak.com/results?{params}"
    
    # Tampilkan Dialog GUI agar terasa aman dan premium
    try:
        import ctypes
        msg = (
            f"Spesifikasi PC Anda Berhasil Dideteksi!\n\n"
            f"• CPU: {cpu_name}\n"
            f"• RAM: {ram_gb} GB\n"
            f"• GPU: {gpu_name} ({vram_gb} GB VRAM)\n"
            f"• Storage: {disk_gb} GB tersedia\n\n"
            f"Klik OK untuk membuka hasil analisis di browser."
        )
        ctypes.windll.user32.MessageBoxW(0, msg, "Bisa Main Nggak Ya - Detektor Spesifikasi", 0x40)
    except Exception:
        pass

    webbrowser.open(url)

if __name__ == "__main__":
    main()
