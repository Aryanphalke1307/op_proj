// ============================================================
// Multithreading-based Application for Resource Utilization
// and Task Execution   (OS Mini Project - PORTABLE VERSION)
//
// Works on Windows and Linux.
//
// CO1: Threads, CPU scheduling (FCFS, SJF Non-Preemptive,
//      Priority Non-Preemptive, Round Robin, SRTF Preemptive SJF,
//      Preemptive Priority), synchronization (mutex, cond. var)
// CO2: Deadlock handling (Banker's), memory management algorithms
// Resource utilization: worker-thread utilization measured with
//                       std::chrono (busy time / total time)
//
// Compile : g++ -std=c++11 -pthread main_portable.cpp -o osproj
// Run     : ./osproj      (Windows: osproj.exe)
// ============================================================
#include <iostream>
#include <cstdio>
#include <cstdlib>
#include <ctime>
#include <vector>
#include <queue>
#include <string>
#include <algorithm>
#include <numeric>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <atomic>
#include <chrono>
#include <functional>
using namespace std;
using namespace chrono;

// ------------------------------------------------------------
// Common data structures
// ------------------------------------------------------------
struct Task {
    int id;
    int burst;
    int priority;   // lower number = higher priority
    int arrival = 0; // arrival time (default 0)
};

struct Result {
    string name;
    vector<int> wt, tat;                 // per task (index = position in task list)
    double avgWT = 0, avgTAT = 0;
    vector<pair<int,int> > slices;       // (task id, duration) in execution order
};

struct ExecStats {
    double wallSec = 0;
    double utilization = 0;              // average worker utilization in %
    vector<long long> busyMs;            // busy time per worker
};

vector<Task> gTasks;
mutex printMtx;                          // protects console output between threads

// ============================================================
// Resource utilization monitor (thread-based)
// Shows how many worker threads are busy right now.
// ============================================================
void monitorLoop(atomic<bool> &run, atomic<int> &active, int workers) {
    while (run) {
        this_thread::sleep_for(milliseconds(500));
        if (!run) break;
        int a = active.load();
        lock_guard<mutex> lk(printMtx);
        printf("  [MONITOR] Active workers: %d/%d | CPU slots in use: %.0f%%\n",
               a, workers, 100.0 * a / workers);
    }
}

// ============================================================
// CPU Scheduling (Supports Arrival Times and Preemption)
//   algo: 1=FCFS, 2=SJF(Non-Preempt), 3=Priority(Non-Preempt),
//         4=Round Robin, 5=SRTF(Preempt SJF), 6=Priority(Preempt)
// ============================================================
string algoName(int a) {
    switch (a) {
        case 1: return "FCFS";
        case 2: return "SJF (Non-Preemptive)";
        case 3: return "Priority (Non-Preemptive)";
        case 4: return "Round Robin";
        case 5: return "SRTF (Preemptive SJF)";
        case 6: return "Priority (Preemptive)";
    }
    return "?";
}

Result schedule(int algo, const vector<Task> &tasks, int quantum) {
    int n = tasks.size();
    Result r;
    r.name = algoName(algo);
    r.wt.assign(n, 0);
    r.tat.assign(n, 0);

    if (algo == 1) {
        // FCFS with arrival times
        vector<int> order(n);
        iota(order.begin(), order.end(), 0);
        stable_sort(order.begin(), order.end(),
                    [&](int a, int b){ return tasks[a].arrival < tasks[b].arrival; });
        int t = 0;
        for (size_t k = 0; k < order.size(); k++) {
            int idx = order[k];
            if (t < tasks[idx].arrival) t = tasks[idx].arrival;
            r.wt[idx] = t - tasks[idx].arrival;
            r.slices.push_back(make_pair(tasks[idx].id, tasks[idx].burst));
            t += tasks[idx].burst;
            r.tat[idx] = t - tasks[idx].arrival;
        }
    } else if (algo == 2 || algo == 3) {
        // Non-preemptive SJF / Priority with arrival times
        vector<bool> done(n, false);
        int completed = 0, t = 0;
        while (completed < n) {
            int best = -1;
            for (int i = 0; i < n; i++) {
                if (!done[i] && tasks[i].arrival <= t) {
                    if (best == -1) best = i;
                    else if (algo == 2 && tasks[i].burst < tasks[best].burst) best = i;
                    else if (algo == 3 && tasks[i].priority < tasks[best].priority) best = i;
                }
            }
            if (best == -1) {
                int nextArr = 1e9;
                for (int i = 0; i < n; i++) if (!done[i]) nextArr = min(nextArr, tasks[i].arrival);
                t = nextArr;
                continue;
            }
            r.wt[best] = t - tasks[best].arrival;
            r.slices.push_back(make_pair(tasks[best].id, tasks[best].burst));
            t += tasks[best].burst;
            r.tat[best] = t - tasks[best].arrival;
            done[best] = true;
            completed++;
        }
    } else if (algo == 4) {
        // Round Robin with arrival times
        vector<int> rem(n);
        for (int i = 0; i < n; i++) rem[i] = tasks[i].burst;
        vector<int> order(n);
        iota(order.begin(), order.end(), 0);
        stable_sort(order.begin(), order.end(), [&](int a, int b){ return tasks[a].arrival < tasks[b].arrival; });

        queue<int> q;
        vector<bool> inQueue(n, false);
        int t = 0, completed = 0;

        auto pushArrived = [&](int curT) {
            for (int idx : order) {
                if (tasks[idx].arrival <= curT && !inQueue[idx] && rem[idx] > 0) {
                    q.push(idx);
                    inQueue[idx] = true;
                }
            }
        };

        pushArrived(t);

        while (completed < n) {
            if (q.empty()) {
                int nextArr = 1e9;
                for (int i = 0; i < n; i++) if (rem[i] > 0) nextArr = min(nextArr, tasks[i].arrival);
                t = nextArr;
                pushArrived(t);
                if (q.empty()) continue;
            }

            int idx = q.front(); q.pop();
            inQueue[idx] = false;

            int run = min(quantum, rem[idx]);
            r.slices.push_back(make_pair(tasks[idx].id, run));
            t += run;
            rem[idx] -= run;

            pushArrived(t);

            if (rem[idx] > 0) {
                q.push(idx);
                inQueue[idx] = true;
            } else {
                completed++;
                r.tat[idx] = t - tasks[idx].arrival;
                r.wt[idx]  = r.tat[idx] - tasks[idx].burst;
            }
        }
    } else if (algo == 5 || algo == 6) {
        // 5 = SRTF (Preemptive SJF), 6 = Preemptive Priority
        vector<int> rem(n);
        for (int i = 0; i < n; i++) rem[i] = tasks[i].burst;
        int completed = 0, t = 0, cur = -1, sliceStart = 0;

        while (completed < n) {
            int best = -1;
            for (int i = 0; i < n; i++) {
                if (tasks[i].arrival <= t && rem[i] > 0) {
                    if (best == -1) {
                        best = i;
                    } else if (algo == 5) {
                        if (rem[i] < rem[best] || (rem[i] == rem[best] && tasks[i].arrival < tasks[best].arrival))
                            best = i;
                    } else { // algo == 6
                        if (tasks[i].priority < tasks[best].priority || (tasks[i].priority == tasks[best].priority && tasks[i].arrival < tasks[best].arrival))
                            best = i;
                    }
                }
            }

            if (best == -1) {
                if (cur != -1) {
                    r.slices.push_back(make_pair(tasks[cur].id, t - sliceStart));
                    cur = -1;
                }
                int nextArr = 1e9;
                for (int i = 0; i < n; i++) if (rem[i] > 0) nextArr = min(nextArr, tasks[i].arrival);
                t = nextArr;
                sliceStart = t;
                continue;
            }

            if (best != cur) {
                if (cur != -1) {
                    r.slices.push_back(make_pair(tasks[cur].id, t - sliceStart));
                }
                cur = best;
                sliceStart = t;
            }

            rem[best]--;
            t++;

            if (rem[best] == 0) {
                completed++;
                r.tat[best] = t - tasks[best].arrival;
                r.wt[best] = r.tat[best] - tasks[best].burst;
                r.slices.push_back(make_pair(tasks[best].id, t - sliceStart));
                cur = -1;
                sliceStart = t;
            }
        }
    }

    double sw = 0, st = 0;
    for (int i = 0; i < n; i++) { sw += r.wt[i]; st += r.tat[i]; }
    r.avgWT  = sw / n;
    r.avgTAT = st / n;
    return r;
}

void printTasks() {
    printf("\n%-8s %-10s %-8s %-8s\n", "Task", "Arrival", "Burst", "Priority");
    for (size_t i = 0; i < gTasks.size(); i++)
        printf("T%-7d %-10d %-8d %-8d\n", gTasks[i].id, gTasks[i].arrival, gTasks[i].burst, gTasks[i].priority);
}

void printResult(const Result &r) {
    printf("\n=== %s ===\nGantt chart: ", r.name.c_str());
    int t = 0;
    for (size_t i = 0; i < r.slices.size(); i++) {
        printf("| T%d (%d-%d) ", r.slices[i].first, t, t + r.slices[i].second);
        t += r.slices[i].second;
    }
    printf("|\n\n%-8s %-10s %-8s %-10s %-12s\n", "Task", "Arrival", "Burst", "Waiting", "Turnaround");
    for (size_t i = 0; i < gTasks.size(); i++)
        printf("T%-7d %-10d %-8d %-10d %-12d\n", gTasks[i].id, gTasks[i].arrival, gTasks[i].burst, r.wt[i], r.tat[i]);
    printf("\nAverage Waiting Time    = %.2f\nAverage Turnaround Time = %.2f\n", r.avgWT, r.avgTAT);
}

// ------------------------------------------------------------
// Real multithreaded execution
// Producer-consumer with mutex + condition_variable.
// Producer pushes scheduled slices into a shared queue,
// worker threads pick them up and "execute" them.
// Each worker measures its own busy time -> utilization.
// ------------------------------------------------------------
ExecStats executeSlices(const vector<pair<int,int> > &slices, int workers,
                        int msPerUnit, bool verbose) {
    queue<pair<int,int> > q;
    mutex qm;
    condition_variable cv;
    bool done = false;
    int completed = 0;
    atomic<int> active(0);

    ExecStats st;
    st.busyMs.assign(workers, 0);        // each worker writes only its own index

    atomic<bool> monRun(true);
    thread monitor;
    if (verbose) monitor = thread(monitorLoop, ref(monRun), ref(active), workers);
    steady_clock::time_point t0 = steady_clock::now();

    vector<thread> pool;
    for (int w = 0; w < workers; w++) {
        pool.push_back(thread([&, w]() {
            while (true) {
                pair<int,int> s;
                {
                    unique_lock<mutex> lk(qm);
                    cv.wait(lk, [&]{ return !q.empty() || done; });
                    if (q.empty() && done) return;
                    s = q.front();
                    q.pop();
                }
                if (verbose) {
                    lock_guard<mutex> pl(printMtx);
                    printf("  [Worker %d] START Task T%d for %d units\n", w + 1, s.first, s.second);
                }
                steady_clock::time_point b0 = steady_clock::now();
                active++;
                this_thread::sleep_for(milliseconds(s.second * msPerUnit));   // simulate work
                active--;
                st.busyMs[w] += duration_cast<milliseconds>(steady_clock::now() - b0).count();
                if (verbose) {
                    lock_guard<mutex> pl(printMtx);
                    printf("  [Worker %d] END   Task T%d\n", w + 1, s.first);
                }
                {
                    lock_guard<mutex> lk(qm);
                    completed++;
                }
            }
        }));
    }

    thread producer([&]() {
        for (size_t i = 0; i < slices.size(); i++) {
            {
                lock_guard<mutex> lk(qm);
                q.push(slices[i]);
            }
            cv.notify_one();
            this_thread::sleep_for(milliseconds(20));
        }
        {
            lock_guard<mutex> lk(qm);
            done = true;
        }
        cv.notify_all();
    });

    producer.join();
    for (size_t i = 0; i < pool.size(); i++) pool[i].join();
    monRun = false;
    if (monitor.joinable()) monitor.join();

    st.wallSec = duration<double>(steady_clock::now() - t0).count();
    double busyTotal = 0;
    for (int w = 0; w < workers; w++) busyTotal += st.busyMs[w];
    st.utilization = 100.0 * (busyTotal / 1000.0) / (workers * st.wallSec);

    if (verbose) {
        printf("\nAll %d slices executed by %d worker threads in %.2f s\n", completed, workers, st.wallSec);
        printf("%-10s %-14s %-14s\n", "Worker", "Busy time(ms)", "Utilization");
        for (int w = 0; w < workers; w++)
            printf("W%-9d %-14lld %.1f%%\n", w + 1, st.busyMs[w],
                   100.0 * (st.busyMs[w] / 1000.0) / st.wallSec);
        printf("Average utilization: %.1f%%\n", st.utilization);
    }
    return st;
}

void createTasks() {
    int n, mode, hasArrival = 0;
    cout << "Number of tasks: ";
    cin >> n;
    cout << "Include custom Arrival Times? (1 = yes, 0 = all arrive at 0): ";
    cin >> hasArrival;
    cout << "1 = Enter manually, 2 = Random: ";
    cin >> mode;
    gTasks.clear();
    srand((unsigned)time(0));
    for (int i = 1; i <= n; i++) {
        Task t;
        t.id = i;
        if (mode == 1) {
            if (hasArrival == 1) {
                cout << "Task " << i << " -> arrival time, burst time and priority (1 = highest): ";
                cin >> t.arrival >> t.burst >> t.priority;
            } else {
                t.arrival = 0;
                cout << "Task " << i << " -> burst time and priority (1 = highest): ";
                cin >> t.burst >> t.priority;
            }
        } else {
            t.arrival = (hasArrival == 1) ? (rand() % 4) : 0;
            t.burst = rand() % 8 + 2;
            t.priority = rand() % 5 + 1;
        }
        gTasks.push_back(t);
    }
    printTasks();
}

void runScheduling() {
    if (gTasks.empty()) { cout << "Create tasks first (option 1).\n"; return; }
    int a, q = 2;
    cout << "\nChoose Algorithm:\n";
    cout << "1. FCFS\n2. SJF (Non-Preemptive)\n3. Priority (Non-Preemptive)\n4. Round Robin\n5. SRTF (Preemptive SJF)\n6. Priority (Preemptive)\nChoice (1-6): ";
    cin >> a;
    if (a < 1 || a > 6) { cout << "Invalid choice.\n"; return; }
    if (a == 4) { cout << "Time quantum: "; cin >> q; if (q < 1) q = 1; }
    Result r = schedule(a, gTasks, q);
    printResult(r);
    int ex;
    cout << "\nExecute these tasks with real threads? (1 = yes, 0 = no): ";
    cin >> ex;
    if (ex == 1) executeSlices(r.slices, 2, 100, true);
}

void compareAll() {
    if (gTasks.empty()) { cout << "Create tasks first (option 1).\n"; return; }
    int q;
    cout << "Time quantum for Round Robin: ";
    cin >> q;
    if (q < 1) q = 1;
    printTasks();
    printf("\n%-26s %-18s %-20s\n", "Algorithm", "Avg Waiting Time", "Avg Turnaround Time");
    printf("-----------------------------------------------------------------\n");
    double bestWT = 1e18; string best;
    for (int a = 1; a <= 6; a++) {
        Result r = schedule(a, gTasks, q);
        printf("%-26s %-18.2f %-20.2f\n", r.name.c_str(), r.avgWT, r.avgTAT);
        if (r.avgWT < bestWT) { bestWT = r.avgWT; best = r.name; }
    }
    printf("\nConclusion: %s gives the lowest average waiting time (%.2f) for this task set.\n",
           best.c_str(), bestWT);
}

// ------------------------------------------------------------
// Resource utilization analysis: same tasks, 1..4 worker threads
// ------------------------------------------------------------
void utilizationAnalysis() {
    if (gTasks.empty()) { cout << "Create tasks first (option 1).\n"; return; }
    Result r = schedule(1, gTasks, 2);   // FCFS order
    printf("\nRunning the same task set with 1 to 4 worker threads...\n");
    printf("\n%-10s %-14s %-18s %-10s\n", "Workers", "Total time(s)", "Avg utilization", "Speedup");
    printf("-----------------------------------------------------\n");
    double base = 0;
    for (int w = 1; w <= 4; w++) {
        ExecStats s = executeSlices(r.slices, w, 100, false);
        if (w == 1) base = s.wallSec;
        char u[32]; snprintf(u, sizeof(u), "%.1f%%", s.utilization);
        printf("%-10d %-14.2f %-18s %-10.2f\n", w, s.wallSec, u, base / s.wallSec);
    }
    printf("\nObservation: more threads reduce total time (speedup), but utilization per thread\n");
    printf("drops once threads outnumber the available work.\n");
}

// ============================================================
// Deadlock handling - Banker's Algorithm
// ============================================================
bool isSafe(int n, int m, vector<int> work,
            const vector<vector<int> > &alloc,
            const vector<vector<int> > &need,
            vector<int> &seq) {
    vector<bool> fin(n, false);
    seq.clear();
    for (int cnt = 0; cnt < n;) {
        bool found = false;
        for (int i = 0; i < n; i++) {
            if (fin[i]) continue;
            bool ok = true;
            for (int j = 0; j < m; j++)
                if (need[i][j] > work[j]) { ok = false; break; }
            if (ok) {
                for (int j = 0; j < m; j++) work[j] += alloc[i][j];
                fin[i] = true;
                seq.push_back(i);
                cnt++;
                found = true;
            }
        }
        if (!found) return false;   // no process can proceed -> unsafe
    }
    return true;
}

void printSeq(const vector<int> &seq) {
    for (size_t i = 0; i < seq.size(); i++)
        printf("P%d%s", seq[i], i + 1 < seq.size() ? " -> " : "\n");
}

void bankers() {
    int n, m, sample;
    cout << "Use sample data? (1 = yes, 0 = enter own): ";
    cin >> sample;
    vector<vector<int> > alloc, mx;
    vector<int> avail;
    if (sample == 1) {
        n = 5; m = 3;
        int A[5][3] = {{0,1,0},{2,0,0},{3,0,2},{2,1,1},{0,0,2}};
        int M[5][3] = {{7,5,3},{3,2,2},{9,0,2},{2,2,2},{4,3,3}};
        int V[3] = {3,3,2};
        alloc.assign(n, vector<int>(m));
        mx.assign(n, vector<int>(m));
        for (int i = 0; i < n; i++)
            for (int j = 0; j < m; j++) { alloc[i][j] = A[i][j]; mx[i][j] = M[i][j]; }
        avail.assign(V, V + m);
    } else {
        cout << "Number of processes and resource types: ";
        cin >> n >> m;
        alloc.assign(n, vector<int>(m));
        mx.assign(n, vector<int>(m));
        avail.assign(m, 0);
        cout << "Allocation matrix (" << n << "x" << m << "):\n";
        for (int i = 0; i < n; i++) for (int j = 0; j < m; j++) cin >> alloc[i][j];
        cout << "Max matrix (" << n << "x" << m << "):\n";
        for (int i = 0; i < n; i++) for (int j = 0; j < m; j++) cin >> mx[i][j];
        cout << "Available vector (" << m << "):\n";
        for (int j = 0; j < m; j++) cin >> avail[j];
    }
    vector<vector<int> > need(n, vector<int>(m));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++) need[i][j] = mx[i][j] - alloc[i][j];

    printf("\n%-6s %-12s %-12s %-12s\n", "Proc", "Allocation", "Max", "Need");
    for (int i = 0; i < n; i++) {
        printf("P%-5d ", i);
        for (int j = 0; j < m; j++) printf("%d ", alloc[i][j]);
        printf("   ");
        for (int j = 0; j < m; j++) printf("%d ", mx[i][j]);
        printf("   ");
        for (int j = 0; j < m; j++) printf("%d ", need[i][j]);
        printf("\n");
    }
    printf("Available: ");
    for (int j = 0; j < m; j++) printf("%d ", avail[j]);
    printf("\n");

    vector<int> seq;
    if (isSafe(n, m, avail, alloc, need, seq)) {
        printf("\nSystem is in a SAFE state.\nSafe sequence: ");
        printSeq(seq);
    } else {
        printf("\nSystem is in an UNSAFE state (deadlock possible).\n");
        return;
    }

    int req;
    cout << "\nMake a resource request? (1 = yes, 0 = no): ";
    cin >> req;
    if (req == 1) {
        int p;
        cout << "Process number (0-" << n - 1 << "): ";
        cin >> p;
        if (p < 0 || p >= n) { cout << "Invalid process.\n"; return; }
        vector<int> rq(m);
        cout << "Request vector (" << m << " values): ";
        for (int j = 0; j < m; j++) cin >> rq[j];
        for (int j = 0; j < m; j++)
            if (rq[j] > need[p][j]) { cout << "Error: request exceeds maximum claim.\n"; return; }
        for (int j = 0; j < m; j++)
            if (rq[j] > avail[j]) { cout << "Resources not available, P" << p << " must wait.\n"; return; }
        // pretend to allocate
        for (int j = 0; j < m; j++) { avail[j] -= rq[j]; alloc[p][j] += rq[j]; need[p][j] -= rq[j]; }
        if (isSafe(n, m, avail, alloc, need, seq)) {
            printf("Request can be GRANTED. New safe sequence: ");
            printSeq(seq);
        } else {
            printf("Request DENIED (would lead to an unsafe state).\n");
        }
    }
}

// ============================================================
// Memory management - First / Best / Worst Fit
// (fixed partitions: one process per block)
// ============================================================
void memoryAlloc() {
    vector<int> blocks, procs;
    int sample;
    cout << "Use sample data? (1 = yes, 0 = enter own): ";
    cin >> sample;
    if (sample == 1) {
        int B[5] = {100, 500, 200, 300, 600};
        int P[4] = {212, 417, 112, 426};
        blocks.assign(B, B + 5);
        procs.assign(P, P + 4);
    } else {
        int nb, np;
        cout << "Number of memory blocks: ";
        cin >> nb;
        blocks.resize(nb);
        cout << "Block sizes: ";
        for (int i = 0; i < nb; i++) cin >> blocks[i];
        cout << "Number of processes: ";
        cin >> np;
        procs.resize(np);
        cout << "Process sizes: ";
        for (int i = 0; i < np; i++) cin >> procs[i];
    }

    const char *names[] = {"First Fit", "Best Fit", "Worst Fit"};
    struct Sum { string name; int internalFrag, unalloc, freeBlocksTotal; };
    vector<Sum> summary;

    for (int st = 0; st < 3; st++) {
        vector<bool> used(blocks.size(), false);
        vector<int> alloc(procs.size(), -1);
        for (size_t i = 0; i < procs.size(); i++) {
            int pick = -1;
            for (size_t b = 0; b < blocks.size(); b++) {
                if (used[b] || blocks[b] < procs[i]) continue;
                if (st == 0) { pick = (int)b; break; }
                if (st == 1 && (pick == -1 || blocks[b] < blocks[pick])) pick = (int)b;
                if (st == 2 && (pick == -1 || blocks[b] > blocks[pick])) pick = (int)b;
            }
            if (pick != -1) { used[pick] = true; alloc[i] = pick; }
        }
        printf("\n=== %s ===\n%-10s %-12s %-12s\n", names[st], "Process", "Size", "Block");
        int internal = 0, unalloc = 0, freeTotal = 0;
        for (size_t i = 0; i < procs.size(); i++) {
            if (alloc[i] != -1) {
                printf("P%-9d %-12d B%d (%d)\n", (int)i + 1, procs[i], alloc[i] + 1, blocks[alloc[i]]);
                internal += blocks[alloc[i]] - procs[i];
            } else {
                printf("P%-9d %-12d NOT ALLOCATED\n", (int)i + 1, procs[i]);
                unalloc++;
            }
        }
        for (size_t b = 0; b < blocks.size(); b++) if (!used[b]) freeTotal += blocks[b];
        printf("Internal fragmentation: %d | Unallocated processes: %d | Free (unused) blocks total: %d\n",
               internal, unalloc, freeTotal);
        Sum s; s.name = names[st]; s.internalFrag = internal; s.unalloc = unalloc; s.freeBlocksTotal = freeTotal;
        summary.push_back(s);
    }

    printf("\n=========== COMPARISON ===========\n");
    printf("%-26s %-20s %-14s %-18s\n", "Algorithm", "Internal Frag.", "Unallocated", "Free blocks total");
    for (size_t i = 0; i < summary.size(); i++)
        printf("%-26s %-20d %-14d %-18d\n", summary[i].name.c_str(), summary[i].internalFrag,
               summary[i].unalloc, summary[i].freeBlocksTotal);
}

// ============================================================
// Main menu
// ============================================================
int main() {
    int ch;
    do {
        printf("\n=======================================================\n");
        printf(" OS MINI PROJECT: Multithreaded Task & Resource Manager\n");
        printf("=======================================================\n");
        printf(" 1. Create tasks (supports Arrival Times)\n");
        printf(" 2. Run scheduling (FCFS, SJF Non-Preempt/Preempt, Priority Non-Preempt/Preempt, RR)\n");
        printf(" 3. Compare all 6 scheduling algorithms\n");
        printf(" 4. Deadlock handling (Banker's Algorithm)\n");
        printf(" 5. Memory allocation (First/Best/Worst Fit)\n");
        printf(" 6. Resource utilization analysis (1-4 worker threads)\n");
        printf(" 0. Exit\n");
        printf("Choice: ");
        if (!(cin >> ch)) break;
        switch (ch) {
            case 1: createTasks();          break;
            case 2: runScheduling();        break;
            case 3: compareAll();           break;
            case 4: bankers();              break;
            case 5: memoryAlloc();          break;
            case 6: utilizationAnalysis();  break;
            case 0: printf("Bye!\n");       break;
            default: printf("Invalid choice.\n");
        }
    } while (ch != 0);
    return 0;
}
