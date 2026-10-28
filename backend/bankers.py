"""
Banker's Algorithm for Deadlock Avoidance
Implements safety state verification and resource request algorithm with step-by-step tracing.
"""

from typing import List, Dict, Any, Tuple


class BankersAlgorithm:
    def __init__(self, allocation: List[List[int]], max_matrix: List[List[int]], available: List[int]):
        self.n = len(allocation)
        self.m = len(available)
        self.allocation = [row[:] for row in allocation]
        self.max_matrix = [row[:] for row in max_matrix]
        self.available = available[:]
        self.need = []
        for i in range(self.n):
            self.need.append([self.max_matrix[i][j] - self.allocation[i][j] for j in range(self.m)])

    def check_safety(self) -> Tuple[bool, List[int], List[Dict[str, Any]]]:
        """
        Runs Banker's safety algorithm.
        Returns (is_safe, safe_sequence, trace_steps)
        """
        work = self.available[:]
        finish = [False] * self.n
        safe_seq = []
        trace_steps = []

        cnt = 0
        while cnt < self.n:
            found = False
            for i in range(self.n):
                if not finish[i]:
                    # Check if need[i] <= work
                    can_allocate = all(self.need[i][j] <= work[j] for j in range(self.m))
                    if can_allocate:
                        prev_work = work[:]
                        for j in range(self.m):
                            work[j] += self.allocation[i][j]
                        finish[i] = True
                        safe_seq.append(i)
                        cnt += 1
                        found = True

                        trace_steps.append({
                            "step": cnt,
                            "process": i,
                            "processName": f"P{i}",
                            "need": self.need[i][:],
                            "workBefore": prev_work,
                            "workAfter": work[:],
                            "allocatedReleased": self.allocation[i][:]
                        })
            if not found:
                break

        is_safe = (cnt == self.n)
        return is_safe, safe_seq, trace_steps

    def process_request(self, proc_id: int, request: List[int]) -> Dict[str, Any]:
        """
        Tests whether a resource request from proc_id can be granted safely.
        """
        if proc_id < 0 or proc_id >= self.n:
            return {"granted": False, "error": f"Invalid process ID: {proc_id}"}

        if len(request) != self.m:
            return {"granted": False, "error": f"Request vector must contain {self.m} values"}

        # Condition 1: Request <= Need[proc_id]
        for j in range(self.m):
            if request[j] > self.need[proc_id][j]:
                return {
                    "granted": False,
                    "reason": f"Request exceeds maximum claim! Need of P{proc_id} is {self.need[proc_id]}, requested {request}",
                    "error": "Request > Need"
                }

        # Condition 2: Request <= Available
        for j in range(self.m):
            if request[j] > self.available[j]:
                return {
                    "granted": False,
                    "reason": f"Resources not currently available. Available is {self.available}, requested {request}. P{proc_id} must wait.",
                    "error": "Request > Available"
                }

        # Pretend allocation
        saved_avail = self.available[:]
        saved_alloc = [row[:] for row in self.allocation]
        saved_need = [row[:] for row in self.need]

        for j in range(self.m):
            self.available[j] -= request[j]
            self.allocation[proc_id][j] += request[j]
            self.need[proc_id][j] -= request[j]

        # Check safety on new pretend state
        is_safe, new_seq, trace = self.check_safety()

        if is_safe:
            return {
                "granted": True,
                "reason": f"Request can be safely GRANTED. Safe sequence exists: {' -> '.join(f'P{x}' for x in new_seq)}",
                "safeSequence": new_seq,
                "safeSequenceStr": " -> ".join(f"P{x}" for x in new_seq),
                "trace": trace,
                "newAvailable": self.available[:],
                "newAllocation": self.allocation[proc_id][:],
                "newNeed": self.need[proc_id][:]
            }
        else:
            # Rollback
            self.available = saved_avail
            self.allocation = saved_alloc
            self.need = saved_need
            return {
                "granted": False,
                "reason": "Request DENIED. Allocating this request would place the system in an UNSAFE state (potential deadlock).",
                "safeSequence": [],
                "error": "Unsafe State"
            }


def get_default_bankers_sample() -> Dict[str, Any]:
    """
    Standard RSCOE 5-process, 3-resource sample
    """
    allocation = [
        [0, 1, 0],
        [2, 0, 0],
        [3, 0, 2],
        [2, 1, 1],
        [0, 0, 2]
    ]
    max_matrix = [
        [7, 5, 3],
        [3, 2, 2],
        [9, 0, 2],
        [2, 2, 2],
        [4, 3, 3]
    ]
    available = [3, 3, 2]

    return {
        "n": 5,
        "m": 3,
        "resourceNames": ["A", "B", "C"],
        "allocation": allocation,
        "max": max_matrix,
        "available": available
    }
