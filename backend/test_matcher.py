"""
test_matcher.py
Simple script to test our hardware matching logic and performance scores.
"""
from hardware_matcher import match_cpu, match_gpu, resolve_game_requirement

def run_tests():
    print("=== TESTING HARDWARE MATCHING ENGINE ===")
    
    cpu_tests = [
        ("Intel Core i5-2500K", "Intel Core i5-2500K"),
        ("AMD FX-6300 Six-Core", "AMD FX-6300"),
        ("Intel Core i9 14900K @ 3.20GHz", "Intel Core i9-14900K"),
        ("Ryzen 7 7800X3D", "AMD Ryzen 7 7800X3D"),
        ("AMD Ryzen 7 9800X3D 8-Core", "AMD Ryzen 7 9800X3D"),
        ("Apple M2 Max", "Apple M2"),
        ("Unknown Retro CPU", "Unknown CPU"),
    ]
    
    print("\n[CPU Matches]")
    for test_str, expected in cpu_tests:
        score, name = match_cpu(test_str)
        print(f"Query: '{test_str}' => Matched: '{name}' (Perf Score: {score})")
        
    gpu_tests = [
        ("NVIDIA GeForce RTX 4070 Super", "NVIDIA GeForce RTX 4070 Super"),
        ("Nvidia RTX 3080", "NVIDIA GeForce RTX 3080"),
        ("Radeon RX 7900 XTX", "AMD Radeon RX 7900 XTX"),
        ("Intel Arc B580", "Intel Arc B580"),
        ("GTX 1060 6GB", "NVIDIA GeForce GTX 1060 6GB"),
        ("Riva TNT2", "NVIDIA RIVA TNT2"),
        ("Unknown GPU 4GB", "Unknown GPU"),
    ]
    
    print("\n[GPU Matches]")
    for test_str, expected in gpu_tests:
        score, name = match_gpu(test_str)
        print(f"Query: '{test_str}' => Matched: '{name}' (Perf Score: {score})")

    requirements_tests = [
        ("Intel Core i5-2500K / AMD FX-6300", "NVIDIA GeForce GTX 760 / AMD Radeon HD 7870"),
        ("Intel Core i7-4790K or Ryzen 5 1600", "NVIDIA GeForce GTX 1060 6GB or RX 580"),
        ("Intel Core Ultra 9 285K", "RTX 5090"),
    ]

    print("\n[Game Requirements Resolution]")
    for c_raw, g_raw in requirements_tests:
        c_score, g_score = resolve_game_requirement(c_raw, g_raw)
        print(f"Req: '{c_raw}' + '{g_raw}' => Resolved Score: CPU={c_score}, GPU={g_score}")

if __name__ == "__main__":
    run_tests()
