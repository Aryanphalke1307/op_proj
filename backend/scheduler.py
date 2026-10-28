"""
CPU Scheduling Module
Implements FCFS, SJF, Priority, and Round Robin scheduling algorithms.
Computes Gantt chart slices, waiting time, turnaround time, and comparative statistics.
"""

from typing import List, Dict, Any, Tuple


class Task:
    def __init__(self, id: int, burst: int, priority: int, arrival: int = 0):
        self.id = int(id)
        self.burst = int(burst)
        self.priority = int(priority)
        self.arrival = int(arrival)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "burst": self.burst,
            "priority": self.priority,
            "arrival": self.arrival
        }


def schedule(algo_id: int, tasks: List[Task], quantum: int = 2) -> Dict[str, Any]:
    """
    algo_id: 1 = FCFS, 2 = SJF, 3 = Priority, 4 = Round Robin
    Returns a dict with name, wt, tat, ct, avgWT, avgTAT, slices
    """
    n = len(tasks)
    if n == 0:
        return {
            "name": "None",
            "wt": [],
            "tat": [],
            "ct": [],
            "avgWT": 0.0,
            "avgTAT": 0.0,
            "slices": []
        }

    algo_names = {1: "FCFS", 2: "SJF", 3: "Priority", 4: "Round Robin"}
    name = algo_names.get(algo_id, "Unknown")

    wt = [0] * n
    tat = [0] * n
    ct = [0] * n
    slices: List[Dict[str, Any]] = []

    if algo_id != 4:
        # Non-preemptive ordering
        order = list(range(n))
        if algo_id == 2:  # SJF (Shortest Job First)
            order.sort(key=lambda idx: tasks[idx].burst)
        elif algo_id == 3:  # Priority (lower number = higher priority)
            order.sort(key=lambda idx: tasks[idx].priority)

        current_time = 0
        for idx in order:
            t = tasks[idx]
            start_t = current_time
            end_t = current_time + t.burst
            wt[idx] = start_t
            current_time = end_t
            tat[idx] = current_time
            ct[idx] = current_time

            slices.append({
                "taskId": t.id,
                "taskIndex": idx,
                "start": start_t,
                "end": end_t,
                "duration": t.burst
            })
    else:
        # Round Robin
        q_val = max(1, quantum)
        rem = [t.burst for t in tasks]
        queue: List[int] = list(range(n))

        current_time = 0
        while queue:
            idx = queue.pop(0)
            run = min(q_val, rem[idx])
            start_t = current_time
            end_t = current_time + run
            current_time = end_t
            rem[idx] -= run

            slices.append({
                "taskId": tasks[idx].id,
                "taskIndex": idx,
                "start": start_t,
                "end": end_t,
                "duration": run
            })

            if rem[idx] > 0:
                queue.append(idx)
            else:
                ct[idx] = current_time
                tat[idx] = current_time
                wt[idx] = current_time - tasks[idx].burst

    avg_wt = sum(wt) / n if n > 0 else 0.0
    avg_tat = sum(tat) / n if n > 0 else 0.0

    task_stats = []
    for i, t in enumerate(tasks):
        task_stats.append({
            "id": t.id,
            "burst": t.burst,
            "priority": t.priority,
            "arrival": t.arrival,
            "waiting": wt[i],
            "turnaround": tat[i],
            "completion": ct[i]
        })

    return {
        "algoId": algo_id,
        "name": name,
        "quantum": quantum if algo_id == 4 else None,
        "avgWT": round(avg_wt, 2),
        "avgTAT": round(avg_tat, 2),
        "totalDuration": current_time if n > 0 else 0,
        "taskStats": task_stats,
        "slices": slices
    }


def compare_all(tasks: List[Task], quantum: int = 2) -> Dict[str, Any]:
    """
    Runs all 4 scheduling algorithms and computes comparative metrics.
    """
    results = []
    best_wt = float("inf")
    best_algo = ""

    for algo_id in range(1, 5):
        res = schedule(algo_id, tasks, quantum)
        results.append({
            "algoId": res["algoId"],
            "name": res["name"],
            "avgWT": res["avgWT"],
            "avgTAT": res["avgTAT"],
            "totalDuration": res["totalDuration"],
            "slicesCount": len(res["slices"])
        })
        if res["avgWT"] < best_wt:
            best_wt = res["avgWT"]
            best_algo = res["name"]

    return {
        "algorithms": results,
        "bestAlgorithm": best_algo,
        "bestAvgWT": best_wt,
        "conclusion": f"{best_algo} gives the lowest average waiting time ({best_wt:.2f}) for this task set."
    }
