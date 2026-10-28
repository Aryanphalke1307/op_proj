"""
Multithreaded Execution Engine
Implements Producer-Consumer pattern with Mutex, Condition Variable,
Worker Thread Pool, Active Worker atomic monitoring, and busy-time tracking.
"""

import time
import threading
import queue
from typing import List, Dict, Any, Tuple


class ThreadExecutor:
    def __init__(self, slices: List[Dict[str, Any]], workers: int = 2, ms_per_unit: int = 50, verbose: bool = True):
        """
        slices: list of dicts with taskId, duration
        workers: number of worker threads (default 2)
        ms_per_unit: milliseconds per CPU burst unit (default 50ms for snappy web UI response)
        """
        self.slices = slices
        self.worker_count = max(1, workers)
        self.ms_per_unit = max(5, ms_per_unit)
        self.verbose = verbose

        self.q = queue.Queue()
        self.qm = threading.Lock()
        self.cv = threading.Condition(self.qm)
        self.done = False

        self.active_workers = 0
        self.active_lock = threading.Lock()

        self.busy_ms = [0.0] * self.worker_count
        self.worker_tasks_completed = [0] * self.worker_count

        self.events: List[Dict[str, Any]] = []
        self.events_lock = threading.Lock()

        self.wall_sec = 0.0
        self.utilization = 0.0

    def _log_event(self, event_type: str, message: str, meta: Dict[str, Any] = None):
        with self.events_lock:
            self.events.append({
                "timeMs": round(time.perf_counter() * 1000, 2),
                "type": event_type,
                "message": message,
                "meta": meta or {}
            })

    def _monitor_loop(self, stop_event: threading.Event):
        while not stop_event.is_set():
            time.sleep(0.15)  # 150ms monitor polling interval
            if stop_event.is_set():
                break
            with self.active_lock:
                a = self.active_workers
            pct = 100.0 * a / self.worker_count
            self._log_event(
                "MONITOR",
                f"[MONITOR] Active workers: {a}/{self.worker_count} | CPU slots in use: {pct:.0f}%",
                {"active": a, "total": self.worker_count, "utilizationPct": round(pct, 1)}
            )

    def _worker_loop(self, worker_id: int):
        w_idx = worker_id - 1
        while True:
            item = None
            with self.cv:
                while self.q.empty() and not self.done:
                    self.cv.wait()
                if self.q.empty() and self.done:
                    return
                item = self.q.get()

            task_id = item["taskId"]
            duration_units = item["duration"]

            self._log_event(
                "WORKER_START",
                f"[Worker {worker_id}] START Task T{task_id} for {duration_units} units",
                {"workerId": worker_id, "taskId": task_id, "units": duration_units}
            )

            with self.active_lock:
                self.active_workers += 1

            start_t = time.perf_counter()
            # Simulate work (time.sleep releases the GIL in Python, achieving real concurrent waiting)
            time.sleep((duration_units * self.ms_per_unit) / 1000.0)
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0

            with self.active_lock:
                self.active_workers -= 1

            self.busy_ms[w_idx] += elapsed_ms
            self.worker_tasks_completed[w_idx] += 1

            self._log_event(
                "WORKER_END",
                f"[Worker {worker_id}] END   Task T{task_id} ({elapsed_ms:.1f}ms)",
                {"workerId": worker_id, "taskId": task_id, "busyMs": round(elapsed_ms, 1)}
            )

    def _producer_loop(self):
        for s in self.slices:
            with self.cv:
                self.q.put(s)
                self.cv.notify(1)
            self._log_event(
                "PRODUCER_ENQUEUE",
                f"[Producer] Queued slice Task T{s['taskId']} ({s['duration']} units)",
                {"taskId": s["taskId"], "units": s["duration"]}
            )
            time.sleep(0.015)  # 15ms producer arrival spacing

        with self.cv:
            self.done = True
            self.cv.notify_all()
        self._log_event("PRODUCER_DONE", "[Producer] All task slices pushed to queue.")

    def run(self) -> Dict[str, Any]:
        stop_mon = threading.Event()
        mon_thread = None
        if self.verbose:
            mon_thread = threading.Thread(target=self._monitor_loop, args=(stop_mon,), daemon=True)
            mon_thread.start()

        start_time = time.perf_counter()

        worker_threads = []
        for w in range(1, self.worker_count + 1):
            t = threading.Thread(target=self._worker_loop, args=(w,))
            worker_threads.append(t)
            t.start()

        prod_thread = threading.Thread(target=self._producer_loop)
        prod_thread.start()

        prod_thread.join()
        for t in worker_threads:
            t.join()

        stop_mon.set()
        if mon_thread:
            mon_thread.join(timeout=0.5)

        self.wall_sec = time.perf_counter() - start_time
        total_busy_ms = sum(self.busy_ms)
        denom = self.worker_count * (self.wall_sec * 1000.0)
        self.utilization = 100.0 * (total_busy_ms / denom) if denom > 0 else 0.0

        # Construct worker stats summary
        workers_summary = []
        for w in range(self.worker_count):
            w_busy = self.busy_ms[w]
            w_u = 100.0 * w_busy / (self.wall_sec * 1000.0) if self.wall_sec > 0 else 0.0
            workers_summary.append({
                "workerId": w + 1,
                "busyMs": round(w_busy, 1),
                "tasksCompleted": self.worker_tasks_completed[w],
                "utilizationPct": round(w_u, 1)
            })

        return {
            "wallSec": round(self.wall_sec, 3),
            "workerCount": self.worker_count,
            "totalSlices": len(self.slices),
            "totalBusyMs": round(total_busy_ms, 1),
            "averageUtilizationPct": round(self.utilization, 1),
            "workers": workers_summary,
            "events": self.events
        }
