"""
Resource Utilization Analysis Module
Runs identical task schedules over 1, 2, 3, 4 worker threads to measure
speedup, idle time, and resource efficiency.
"""

from typing import List, Dict, Any
try:
    from .thread_executor import ThreadExecutor
except ImportError:
    from thread_executor import ThreadExecutor


def analyze_thread_scalability(slices: List[Dict[str, Any]], max_workers: int = 4, ms_per_unit: int = 40) -> Dict[str, Any]:
    """
    Executes slices sequentially across 1 to max_workers threads and returns comparison table and curves.
    """
    results = []
    base_wall_sec = None

    for w in range(1, max_workers + 1):
        executor = ThreadExecutor(slices, workers=w, ms_per_unit=ms_per_unit, verbose=False)
        stats = executor.run()

        wall_sec = stats["wallSec"]
        if w == 1:
            base_wall_sec = wall_sec

        speedup = round(base_wall_sec / wall_sec, 2) if wall_sec > 0 and base_wall_sec else 1.00

        results.append({
            "workers": w,
            "wallSec": wall_sec,
            "averageUtilizationPct": stats["averageUtilizationPct"],
            "speedup": speedup,
            "idealSpeedup": float(w),
            "workersBreakdown": stats["workers"]
        })

    # Generate academic analysis observation
    observation = (
        "Observation: Increasing worker threads from 1 to 2 provides clear speedup as long as "
        "concurrent tasks are available. However, when thread count exceeds the parallelizable slices, "
        "or when bounded by the longest task burst (granularity barrier), speedup saturates and per-thread "
        "utilization declines sharply."
    )

    return {
        "analysisTable": results,
        "maxWorkers": max_workers,
        "baseTimeSec": base_wall_sec,
        "observation": observation
    }
