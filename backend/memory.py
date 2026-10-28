"""
Memory Management Module
Simulates Fixed Partition Allocation: First Fit, Best Fit, and Worst Fit.
Calculates block utilization, internal fragmentation, unallocated processes, and free memory pools.
"""

from typing import List, Dict, Any


def allocate_memory(blocks: List[int], procs: List[int]) -> Dict[str, Any]:
    """
    Executes First Fit, Best Fit, and Worst Fit on the provided blocks and processes.
    """
    algo_names = ["First Fit", "Best Fit", "Worst Fit"]
    summary = []
    detailed_results = {}

    for st, name in enumerate(algo_names):
        used = [False] * len(blocks)
        alloc = [-1] * len(procs)

        for i, p_size in enumerate(procs):
            pick = -1
            for b, b_size in enumerate(blocks):
                if used[b] or b_size < p_size:
                    continue
                if st == 0:  # First Fit
                    pick = b
                    break
                elif st == 1:  # Best Fit (smallest block >= process size)
                    if pick == -1 or b_size < blocks[pick]:
                        pick = b
                elif st == 2:  # Worst Fit (largest block >= process size)
                    if pick == -1 or b_size > blocks[pick]:
                        pick = b

            if pick != -1:
                used[pick] = True
                alloc[i] = pick

        # Build process allocation mapping
        internal_frag = 0
        unallocated_count = 0
        proc_details = []

        for i, p_size in enumerate(procs):
            b_idx = alloc[i]
            if b_idx != -1:
                frag = blocks[b_idx] - p_size
                internal_frag += frag
                proc_details.append({
                    "processIndex": i,
                    "processId": f"P{i + 1}",
                    "size": p_size,
                    "allocated": True,
                    "blockIndex": b_idx,
                    "blockId": f"B{b_idx + 1}",
                    "blockSize": blocks[b_idx],
                    "internalFrag": frag
                })
            else:
                unallocated_count += 1
                proc_details.append({
                    "processIndex": i,
                    "processId": f"P{i + 1}",
                    "size": p_size,
                    "allocated": False,
                    "blockIndex": None,
                    "blockId": None,
                    "blockSize": None,
                    "internalFrag": 0
                })

        # Build block layout mapping
        free_blocks_total = 0
        block_details = []
        for b, b_size in enumerate(blocks):
            # Find process mapped to this block
            proc_in_block = next((p for p in proc_details if p["blockIndex"] == b), None)
            if proc_in_block:
                block_details.append({
                    "blockIndex": b,
                    "blockId": f"B{b + 1}",
                    "size": b_size,
                    "isUsed": True,
                    "processId": proc_in_block["processId"],
                    "processSize": proc_in_block["size"],
                    "internalFrag": proc_in_block["internalFrag"]
                })
            else:
                free_blocks_total += b_size
                block_details.append({
                    "blockIndex": b,
                    "blockId": f"B{b + 1}",
                    "size": b_size,
                    "isUsed": False,
                    "processId": None,
                    "processSize": 0,
                    "internalFrag": 0
                })

        result_item = {
            "name": name,
            "internalFrag": internal_frag,
            "unallocated": unallocated_count,
            "freeBlocksTotal": free_blocks_total,
            "processes": proc_details,
            "blocks": block_details
        }

        detailed_results[name] = result_item
        summary.append({
            "algorithm": name,
            "internalFrag": internal_frag,
            "unallocated": unallocated_count,
            "freeBlocksTotal": free_blocks_total
        })

    # Pick recommendation
    # Prioritize 0 unallocated, then least internal fragmentation
    sorted_summary = sorted(summary, key=lambda x: (x["unallocated"], x["internalFrag"]))
    best_algo = sorted_summary[0]["algorithm"]

    return {
        "blocks": blocks,
        "processes": procs,
        "summary": summary,
        "details": detailed_results,
        "recommendedAlgorithm": best_algo,
        "recommendationReason": f"{best_algo} yielded optimal partition utilization with minimal internal fragmentation ({sorted_summary[0]['internalFrag']} KB) and zero unallocated tasks."
    }
