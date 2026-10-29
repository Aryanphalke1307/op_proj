"""
CPU Scheduling Module
Implements:
1. FCFS (First-Come First-Served)
2. SJF Non-Preemptive
3. Priority Non-Preemptive
4. Round Robin
5. SJF Preemptive (Shortest Remaining Time First - SRTF)
6. Priority Preemptive

Supports arrival times, Gantt chart slices, waiting time, turnaround time,
completion time, and comparative ranking.
"""

from typing import List, Dict, Any


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
    algo_id:
      1 = FCFS
      2 = SJF (Non-Preemptive)
      3 = Priority (Non-Preemptive)
      4 = Round Robin
      5 = SJF Preemptive (SRTF)
      6 = Priority Preemptive
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

    algo_names = {
        1: "FCFS",
        2: "SJF (Non-Preemptive)",
        3: "Priority (Non-Preemptive)",
        4: "Round Robin",
        5: "SJF Preemptive (SRTF)",
        6: "Priority Preemptive"
    }
    name = algo_names.get(algo_id, "Unknown")

    wt = [0] * n
    tat = [0] * n
    ct = [0] * n
    slices: List[Dict[str, Any]] = []

    # -------------------------------------------------------------
    # 1. FCFS
    # -------------------------------------------------------------
    if algo_id == 1:
        # Order by arrival time, then id
        order = sorted(range(n), key=lambda i: (tasks[i].arrival, tasks[i].id))
        current_time = 0
        for idx in order:
            t = tasks[idx]
            if current_time < t.arrival:
                current_time = t.arrival
            start_t = current_time
            end_t = current_time + t.burst
            current_time = end_t
            ct[idx] = current_time
            tat[idx] = ct[idx] - t.arrival
            wt[idx] = tat[idx] - t.burst

            slices.append({
                "taskId": t.id,
                "taskIndex": idx,
                "start": start_t,
                "end": end_t,
                "duration": t.burst
            })

    # -------------------------------------------------------------
    # 2. SJF Non-Preemptive
    # -------------------------------------------------------------
    elif algo_id == 2:
        completed = 0
        current_time = 0
        is_done = [False] * n

        while completed < n:
            ready = [i for i in range(n) if not is_done[i] and tasks[i].arrival <= current_time]
            if not ready:
                # CPU idle: jump to next arrival
                current_time = min(tasks[i].arrival for i in range(n) if not is_done[i])
                continue

            # Pick shortest burst, tie break arrival then id
            best_idx = min(ready, key=lambda i: (tasks[i].burst, tasks[i].arrival, tasks[i].id))
            t = tasks[best_idx]
            start_t = current_time
            end_t = current_time + t.burst
            current_time = end_t
            ct[best_idx] = current_time
            tat[best_idx] = ct[best_idx] - t.arrival
            wt[best_idx] = tat[best_idx] - t.burst
            is_done[best_idx] = True
            completed += 1

            slices.append({
                "taskId": t.id,
                "taskIndex": best_idx,
                "start": start_t,
                "end": end_t,
                "duration": t.burst
            })

    # -------------------------------------------------------------
    # 3. Priority Non-Preemptive (lower number = higher priority)
    # -------------------------------------------------------------
    elif algo_id == 3:
        completed = 0
        current_time = 0
        is_done = [False] * n

        while completed < n:
            ready = [i for i in range(n) if not is_done[i] and tasks[i].arrival <= current_time]
            if not ready:
                current_time = min(tasks[i].arrival for i in range(n) if not is_done[i])
                continue

            # Pick highest priority (lowest number)
            best_idx = min(ready, key=lambda i: (tasks[i].priority, tasks[i].arrival, tasks[i].id))
            t = tasks[best_idx]
            start_t = current_time
            end_t = current_time + t.burst
            current_time = end_t
            ct[best_idx] = current_time
            tat[best_idx] = ct[best_idx] - t.arrival
            wt[best_idx] = tat[best_idx] - t.burst
            is_done[best_idx] = True
            completed += 1

            slices.append({
                "taskId": t.id,
                "taskIndex": best_idx,
                "start": start_t,
                "end": end_t,
                "duration": t.burst
            })

    # -------------------------------------------------------------
    # 4. Round Robin
    # -------------------------------------------------------------
    elif algo_id == 4:
        q_val = max(1, quantum)
        rem = [t.burst for t in tasks]
        # Sort tasks by arrival to feed ready queue
        order = sorted(range(n), key=lambda i: (tasks[i].arrival, tasks[i].id))
        queue = []
        current_time = 0
        in_queue = [False] * n

        def push_arrived(t_limit):
            for i in order:
                if tasks[i].arrival <= t_limit and not in_queue[i] and rem[i] > 0:
                    queue.append(i)
                    in_queue[i] = True

        push_arrived(current_time)

        while queue or any(rem[i] > 0 for i in range(n)):
            if not queue:
                next_arr = min(tasks[i].arrival for i in range(n) if rem[i] > 0)
                current_time = next_arr
                push_arrived(current_time)
                if not queue:
                    continue

            idx = queue.pop(0)
            in_queue[idx] = False

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

            # Check new arrivals before re-adding current task
            push_arrived(current_time)

            if rem[idx] > 0:
                queue.append(idx)
                in_queue[idx] = True
            else:
                ct[idx] = current_time
                tat[idx] = ct[idx] - tasks[idx].arrival
                wt[idx] = tat[idx] - tasks[idx].burst

    # -------------------------------------------------------------
    # 5. SJF Preemptive (SRTF) & 6. Priority Preemptive
    # -------------------------------------------------------------
    elif algo_id in (5, 6):
        rem = [t.burst for t in tasks]
        completed = 0
        current_time = min(t.arrival for t in tasks) if tasks else 0
        current_proc = -1
        slice_start = current_time

        while completed < n:
            ready = [i for i in range(n) if tasks[i].arrival <= current_time and rem[i] > 0]
            if not ready:
                if current_proc != -1:
                    slices.append({
                        "taskId": tasks[current_proc].id,
                        "taskIndex": current_proc,
                        "start": slice_start,
                        "end": current_time,
                        "duration": current_time - slice_start
                    })
                    current_proc = -1
                current_time = min(tasks[i].arrival for i in range(n) if rem[i] > 0)
                slice_start = current_time
                continue

            if algo_id == 5:
                # SRTF: shortest remaining burst time
                best_idx = min(ready, key=lambda i: (rem[i], tasks[i].arrival, tasks[i].id))
            else:
                # Priority Preemptive: lowest priority value (1 = highest)
                best_idx = min(ready, key=lambda i: (tasks[i].priority, tasks[i].arrival, tasks[i].id))

            # Context switch / Preemption occurred
            if best_idx != current_proc:
                if current_proc != -1:
                    slices.append({
                        "taskId": tasks[current_proc].id,
                        "taskIndex": current_proc,
                        "start": slice_start,
                        "end": current_time,
                        "duration": current_time - slice_start
                    })
                current_proc = best_idx
                slice_start = current_time

            rem[best_idx] -= 1
            current_time += 1

            if rem[best_idx] == 0:
                completed += 1
                ct[best_idx] = current_time
                tat[best_idx] = ct[best_idx] - tasks[best_idx].arrival
                wt[best_idx] = tat[best_idx] - tasks[best_idx].burst

                slices.append({
                    "taskId": tasks[best_idx].id,
                    "taskIndex": best_idx,
                    "start": slice_start,
                    "end": current_time,
                    "duration": current_time - slice_start
                })
                current_proc = -1
                slice_start = current_time

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
    Runs all 6 scheduling algorithms and computes comparative metrics.
    """
    results = []
    best_wt = float("inf")
    best_algo = ""

    for algo_id in range(1, 7):
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
