# Multithreading-Based Application for Resource Utilization and Task Execution

**Operating Systems Mini Project (Experiment 9)**  
**Department of Computer Engineering**  
**JSPM's Rajarshi Shahu College of Engineering (RSCOE), Pune**  
*Affiliated to Savitribai Phule Pune University*

---

### Student Credentials
- **Name:** Aryan Shyam Phalke
- **PRN:** `RBT25CS111`
- **Roll No:** `CS2240`
- **Class:** SY B (B2)
- **Academic Year:** 2026 – 2027
- **Course Outcomes Mapped:** CO1, CO2, CO3

---

## 🌟 Project Architecture & Prototype Overview

This repository contains both the **complete enhanced C++ source code** and an **interactive full-stack web dashboard prototype** designed to demonstrate the core tenets of modern operating systems:

```
os-multithreading-simulator/
├── start_prototype.bat         # 1-Click Windows Launcher (Opens browser & starts backend)
├── start_prototype.ps1         # PowerShell Launcher
├── cpp/
│   ├── os_project.cpp          # Original C++ source code (std::thread, mutex, condition_var)
│   └── os_project_enhanced.cpp # Enhanced C++ with ANSI colors, tables & validation
├── backend/
│   ├── server.py               # Multithreaded Python HTTP Server (Zero external dependencies)
│   ├── scheduler.py            # CPU Scheduling: FCFS, SJF, Priority, Round Robin
│   ├── thread_executor.py      # Producer-Consumer queue with real concurrent worker threads
│   ├── utilization_analyzer.py # 1 to 4 worker threads speedup & Amdahl's Law benchmark
│   ├── bankers.py              # Banker's Deadlock Avoidance (Safe Sequence & Resource Request)
│   └── memory.py               # Memory Allocation: First Fit, Best Fit, Worst Fit
└── frontend/
    ├── index.html              # Modern, responsive single-page dashboard with Tailwind CSS
    ├── styles.css              # Glassmorphism, animations, Gantt chart, and dark styling
    └── app.js                  # Dynamic UI controller, live thread animation & Chart.js graphs
```

---

## 🚀 How to Run the Prototype

### Option 1: One-Click Run (Windows)
Double-click `start_prototype.bat` or run:
```powershell
.\start_prototype.ps1
```
This automatically starts the backend server and opens `http://localhost:8000` in your default browser.

### Option 2: Manual Terminal Launch
From the project folder:
```bash
python backend/server.py 8000
```
Then navigate to: **`http://localhost:8000/`**

### Option 3: Compiling the C++ Console Program
If you wish to run the console program on Linux or Windows (MinGW/GCC or Clang):
```bash
g++ -std=c++11 -pthread cpp/os_project_enhanced.cpp -o os_project
./os_project
```

---

## 🔬 Core Features & Laboratory Experiment Coverage

### 1. CPU Scheduling & Visual Gantt Chart (CO1)
- **6 Algorithms Implemented (Non-Preemptive & Preemptive):**
  - **FCFS** (First-Come First-Served with arrival time handling)
  - **SJF (Non-Preemptive)** (Shortest Job First)
  - **Priority (Non-Preemptive)** (Static priority assignment, lower number = higher priority)
  - **Round Robin** (Preemptive time-slicing with user-definable time quantum $q$)
  - **SRTF / Preemptive SJF** (Shortest Remaining Time First – dynamically preempts longer jobs when shorter bursts arrive)
  - **Preemptive Priority** (Preempts currently running job when a process with higher priority arrives)
- **Arrival Time ($AT$) Support:** Full support for zero and non-zero arrival times, illustrating real-world context switching and preemption.
- **Visual Gantt Chart:** Dynamic horizontal timeline with color-coded process blocks, preemption boundaries, and start/finish timestamps.
- **Metrics Calculated:** Waiting Time ($WT$), Turnaround Time ($TAT$), Completion Time ($CT$), and Average $WT$ / $TAT$.
- **Compare All 6 Feature:** Side-by-side comparative table and Chart.js bar graph comparing all 6 algorithms on the same task set.

### 2. Real-Time Multithreaded Worker Pool (CO1, CO3)
- **Producer-Consumer Model:**
  - **Producer Thread:** Feeds scheduled CPU task slices into a shared queue.
  - **Shared Queue Buffer:** Synchronized using mutex locks (`std::mutex` / `threading.Lock`) and condition variables (`std::condition_variable` / `threading.Condition`).
  - **Worker Thread Pool:** Configurable pool ($1$ to $8$ worker threads) that pop slices and execute them concurrently.
  - **Monitor Thread:** Concurrently checks the active worker counter (`std::atomic<int> active`) every interval and streams live CPU utilization % (`Active Workers: A / W | CPU Slots: X%`).
- **Live Visual Dashboard:** Animated worker cards with pulsing RUNNING glows, real-time progress bars, per-worker accumulated busy times, and real-time terminal logging.

### 3. Resource Utilization & Scalability Benchmark (CO1, CO3)
- Executes the identical task workload across $1, 2, 3,$ and $4$ worker threads.
- Computes:
  $$\text{Utilization} = \frac{\sum \text{Worker Busy Time}}{W \times \text{Wall Time}} \times 100\%$$
  $$\text{Speedup } S = \frac{T_1}{T_W}$$
- **Amdahl's Law Observation:** Explains why scaling from 1 to 2 workers gives a substantial speedup ($1.69\times$), while 3 and 4 workers saturate because the longest task slice ($T_2 = 4$ units) cannot be split, causing worker utilization to drop from $83.8\%$ down to $41.9\%$.

### 4. Deadlock Avoidance: Banker's Algorithm (CO2)
- **Safety Algorithm:** Computes the dynamic $Need$ matrix ($Need = Max - Allocation$) and generates the safe sequence:
  $$P_1 \longrightarrow P_3 \longrightarrow P_4 \longrightarrow P_0 \longrightarrow P_2$$
- **Dynamic Resource Request:** Validates $Request \le Need$ and $Request \le Available$, performs a pretend allocation, checks system safety, and instantly grants or rolls back denied requests with clear step-by-step diagnostic reasoning.
- **Preloaded RSCOE Syllabus Dataset:** 5 Processes $\times$ 3 Resource types ($A, B, C$).

### 5. Memory Management: Fixed Partition Allocation (CO2)
- Compares **First Fit**, **Best Fit**, and **Worst Fit** on contiguous memory partitions.
- **Visual Memory Map:** Displays each memory partition with allocated process footprint, internal fragmentation striped pattern, and completely free blocks.
- **Comparative Metrics:** Measures internal fragmentation, unallocated processes, and total free block capacity.

---

## 📊 Sample Experimental Benchmark Data (From Lab Report)

| Metric | Task Set: $T_1 (BT=2, P=3)$, $T_2 (BT=4, P=2)$, $T_3 (BT=1, P=1)$ |
| :--- | :--- |
| **Priority Gantt** | $\| T_3 (0-1) \| T_2 (1-5) \| T_1 (5-7) \|$ |
| **Priority Metrics** | Avg Waiting Time = **2.00**, Avg Turnaround Time = **4.33** |
| **SJF (Best)** | Avg Waiting Time = **1.33**, Avg Turnaround Time = **3.67** |
| **FCFS** | Avg Waiting Time = **2.67**, Avg Turnaround Time = **5.00** |
| **Worker Threads** | 1 Worker: $0.72\text{s}$ (99.6% util) $\rightarrow$ 2 Workers: $0.43\text{s}$ (83.8% util, **1.69x speedup**) |
| **Banker's Sequence** | Safe Sequence: $P_1 \rightarrow P_3 \rightarrow P_4 \rightarrow P_0 \rightarrow P_2$ |
| **Memory Allocation** | First Fit: Frag = 280 KB \| Best Fit: Frag = 280 KB \| Worst Fit: Frag = 680 KB |

---

## 🎓 Academic Course Outcome (CO) Mapping

| Course Outcome | Focus Area | Demonstrated in Project |
| :--- | :--- | :--- |
| **CO1** | Process management, CPU scheduling & synchronization | FCFS, SJF, Priority, RR scheduling; Producer-Consumer synchronization with mutex and condition variables. |
| **CO2** | Deadlock handling & memory management | Banker's safety state determination, request validation, and First/Best/Worst Fit memory allocation. |
| **CO3** | Multithreading & system calls | OS kernel thread-backed execution (`std::thread`), condition variable wait/notify, and real-time wall-clock benchmarking. |

---
*Created for OS Lab Experiment 9, SPPU Pune University Curriculum.*
