/**
 * Frontend Application Controller for OS Multithreaded Simulator
 * Supports Dual Mode:
 *  1. Live REST Backend Mode (calls Python Threading server on /api/*)
 *  2. Seamless Client-Side Fallback Mode (works even if opened via file://)
 * 
 * Author: Aryan Shyam Phalke (RSCOE Pune)
 */

// Global State
const state = {
  isBackendConnected: false,
  tasks: [
    { id: 1, burst: 2, priority: 3, arrival: 0 },
    { id: 2, burst: 4, priority: 2, arrival: 0 },
    { id: 3, burst: 1, priority: 1, arrival: 0 }
  ],
  activeAlgoId: 3, // Priority by default
  quantum: 2,
  lastSchedule: null,
  bankersData: {
    n: 5,
    m: 3,
    resourceNames: ["A", "B", "C"],
    allocation: [
      [0, 1, 0],
      [2, 0, 0],
      [3, 0, 2],
      [2, 1, 1],
      [0, 0, 2]
    ],
    max: [
      [7, 5, 3],
      [3, 2, 2],
      [9, 0, 2],
      [2, 2, 2],
      [4, 3, 3]
    ],
    available: [3, 3, 2]
  },
  charts: {
    compareChart: null,
    speedupChart: null,
    utilizationChart: null
  }
};

// Colors for Process Gantt / UI
const PROCESS_COLORS = [
  { bg: '#06b6d4', text: '#082f49' }, // Cyan
  { bg: '#3b82f6', text: '#172554' }, // Blue
  { bg: '#10b981', text: '#022c22' }, // Emerald
  { bg: '#f59e0b', text: '#451a03' }, // Amber
  { bg: '#8b5cf6', text: '#2e1065' }, // Violet
  { bg: '#ec4899', text: '#500724' }, // Pink
  { bg: '#14b8a6', text: '#042f2e' }, // Teal
  { bg: '#f97316', text: '#431407' }  // Orange
];

function getProcessColor(id) {
  const idx = (id - 1) % PROCESS_COLORS.length;
  return PROCESS_COLORS[idx >= 0 ? idx : 0];
}

// -------------------------------------------------------------
// TAB NAVIGATION
// -------------------------------------------------------------
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.classList.add('text-slate-400');
  });

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.remove('hidden');

  const activeBtn = document.getElementById(`btn-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.classList.remove('text-slate-400');
  }

  if (tabId === 'tab-analysis') {
    setTimeout(() => {
      if (state.charts.speedupChart) state.charts.speedupChart.resize();
      if (state.charts.utilizationChart) state.charts.utilizationChart.resize();
    }, 100);
  }
}

// -------------------------------------------------------------
// TAB 1: CPU SCHEDULING
// -------------------------------------------------------------
function renderTaskTable() {
  const tbody = document.getElementById('taskTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  state.tasks.forEach((t, index) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition font-mono';
    tr.innerHTML = `
      <td class="py-2 px-4 font-bold text-cyan-400">T${t.id}</td>
      <td class="py-2 px-4">
        <input type="number" min="0" max="100" value="${t.arrival ?? 0}" 
          onchange="updateTaskField(${index}, 'arrival', this.value)" 
          class="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs">
      </td>
      <td class="py-2 px-4">
        <input type="number" min="1" max="50" value="${t.burst}" 
          onchange="updateTaskField(${index}, 'burst', this.value)" 
          class="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs">
      </td>
      <td class="py-2 px-4">
        <input type="number" min="1" max="20" value="${t.priority}" 
          onchange="updateTaskField(${index}, 'priority', this.value)" 
          class="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs">
      </td>
      <td class="py-2 px-4 text-center">
        <button onclick="removeTaskRow(${index})" class="text-rose-400 hover:text-rose-300 text-xs transition">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateTaskField(index, field, value) {
  const num = parseInt(value, 10);
  if (!isNaN(num)) {
    if (field === 'arrival' && num >= 0) {
      state.tasks[index][field] = num;
    } else if (num > 0) {
      state.tasks[index][field] = num;
    }
  }
}

function addTaskRow() {
  const newId = state.tasks.length > 0 ? Math.max(...state.tasks.map(t => t.id)) + 1 : 1;
  state.tasks.push({ id: newId, burst: 3, priority: 2, arrival: 0 });
  renderTaskTable();
}

function removeTaskRow(index) {
  if (state.tasks.length <= 1) {
    alert("Must maintain at least 1 task.");
    return;
  }
  state.tasks.splice(index, 1);
  renderTaskTable();
}

function loadSampleTasksPreset(type) {
  if (type === 'rscoe') {
    state.tasks = [
      { id: 1, burst: 2, priority: 3, arrival: 0 },
      { id: 2, burst: 4, priority: 2, arrival: 0 },
      { id: 3, burst: 1, priority: 1, arrival: 0 }
    ];
    document.getElementById('algoSelect').value = '3'; // Priority
  } else if (type === 'preemptive_demo') {
    state.tasks = [
      { id: 1, burst: 8, priority: 3, arrival: 0 },
      { id: 2, burst: 4, priority: 1, arrival: 1 },
      { id: 3, burst: 9, priority: 4, arrival: 2 },
      { id: 4, burst: 5, priority: 2, arrival: 3 }
    ];
    document.getElementById('algoSelect').value = '5'; // SRTF
  } else if (type === 'random') {
    state.tasks = [];
    const count = 5;
    for (let i = 1; i <= count; i++) {
      state.tasks.push({
        id: i,
        burst: Math.floor(Math.random() * 8) + 2,
        priority: Math.floor(Math.random() * 5) + 1,
        arrival: Math.floor(Math.random() * 4)
      });
    }
  }
  renderTaskTable();
  toggleQuantumInput();
  runScheduling();
}

function toggleQuantumInput() {
  const algo = parseInt(document.getElementById('algoSelect').value, 10);
  const qContainer = document.getElementById('quantumContainer');
  if (algo === 4) {
    qContainer.classList.remove('hidden');
  } else {
    qContainer.classList.add('hidden');
  }
}

// Local scheduling calculation (supports all 6 algorithms)
function localSchedule(algoId, tasks, quantum) {
  const n = tasks.length;
  const names = {
    1: "FCFS",
    2: "SJF (Non-Preemptive)",
    3: "Priority (Non-Preemptive)",
    4: "Round Robin",
    5: "SJF Preemptive (SRTF)",
    6: "Priority Preemptive"
  };
  const name = names[algoId] || "Unknown";

  let wt = new Array(n).fill(0);
  let tat = new Array(n).fill(0);
  let ct = new Array(n).fill(0);
  let slices = [];

  if (algoId === 1) {
    // FCFS with arrival time
    const order = Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => (tasks[a].arrival || 0) - (tasks[b].arrival || 0) || tasks[a].id - tasks[b].id);
    let currentTime = 0;
    for (let k = 0; k < order.length; k++) {
      let idx = order[k];
      let t = tasks[idx];
      let arr = t.arrival || 0;
      if (currentTime < arr) currentTime = arr;
      let start_t = currentTime;
      let end_t = currentTime + t.burst;
      currentTime = end_t;
      ct[idx] = currentTime;
      tat[idx] = ct[idx] - arr;
      wt[idx] = tat[idx] - t.burst;

      slices.push({
        taskId: t.id,
        taskIndex: idx,
        start: start_t,
        end: end_t,
        duration: t.burst
      });
    }
  } else if (algoId === 2) {
    // SJF Non-Preemptive
    let completed = 0;
    let currentTime = 0;
    let isDone = new Array(n).fill(false);

    while (completed < n) {
      let ready = [];
      for (let i = 0; i < n; i++) {
        if (!isDone[i] && (tasks[i].arrival || 0) <= currentTime) ready.push(i);
      }
      if (ready.length === 0) {
        let nextArr = Infinity;
        for (let i = 0; i < n; i++) {
          if (!isDone[i] && (tasks[i].arrival || 0) < nextArr) nextArr = tasks[i].arrival || 0;
        }
        currentTime = nextArr;
        continue;
      }
      ready.sort((a, b) => tasks[a].burst - tasks[b].burst || (tasks[a].arrival || 0) - (tasks[b].arrival || 0) || tasks[a].id - tasks[b].id);
      let best = ready[0];
      let t = tasks[best];
      let start_t = currentTime;
      let end_t = currentTime + t.burst;
      currentTime = end_t;
      ct[best] = currentTime;
      tat[best] = ct[best] - (t.arrival || 0);
      wt[best] = tat[best] - t.burst;
      isDone[best] = true;
      completed++;

      slices.push({
        taskId: t.id,
        taskIndex: best,
        start: start_t,
        end: end_t,
        duration: t.burst
      });
    }
  } else if (algoId === 3) {
    // Priority Non-Preemptive
    let completed = 0;
    let currentTime = 0;
    let isDone = new Array(n).fill(false);

    while (completed < n) {
      let ready = [];
      for (let i = 0; i < n; i++) {
        if (!isDone[i] && (tasks[i].arrival || 0) <= currentTime) ready.push(i);
      }
      if (ready.length === 0) {
        let nextArr = Infinity;
        for (let i = 0; i < n; i++) {
          if (!isDone[i] && (tasks[i].arrival || 0) < nextArr) nextArr = tasks[i].arrival || 0;
        }
        currentTime = nextArr;
        continue;
      }
      ready.sort((a, b) => tasks[a].priority - tasks[b].priority || (tasks[a].arrival || 0) - (tasks[b].arrival || 0) || tasks[a].id - tasks[b].id);
      let best = ready[0];
      let t = tasks[best];
      let start_t = currentTime;
      let end_t = currentTime + t.burst;
      currentTime = end_t;
      ct[best] = currentTime;
      tat[best] = ct[best] - (t.arrival || 0);
      wt[best] = tat[best] - t.burst;
      isDone[best] = true;
      completed++;

      slices.push({
        taskId: t.id,
        taskIndex: best,
        start: start_t,
        end: end_t,
        duration: t.burst
      });
    }
  } else if (algoId === 4) {
    // Round Robin with arrival time
    const qVal = Math.max(1, quantum);
    let rem = tasks.map(t => t.burst);
    let order = Array.from({ length: n }, (_, i) => i).sort((a, b) => (tasks[a].arrival || 0) - (tasks[b].arrival || 0));
    let queue = [];
    let inQueue = new Array(n).fill(false);
    let currentTime = 0;

    const pushArrived = (tLim) => {
      for (let idx of order) {
        if ((tasks[idx].arrival || 0) <= tLim && !inQueue[idx] && rem[idx] > 0) {
          queue.push(idx);
          inQueue[idx] = true;
        }
      }
    };

    pushArrived(currentTime);

    while (queue.length > 0 || rem.some(r => r > 0)) {
      if (queue.length === 0) {
        let nextArr = Infinity;
        for (let i = 0; i < n; i++) {
          if (rem[i] > 0 && (tasks[i].arrival || 0) < nextArr) nextArr = tasks[i].arrival || 0;
        }
        currentTime = nextArr;
        pushArrived(currentTime);
        if (queue.length === 0) continue;
      }

      let idx = queue.shift();
      inQueue[idx] = false;

      let run = Math.min(qVal, rem[idx]);
      let start_t = currentTime;
      let end_t = currentTime + run;
      currentTime = end_t;
      rem[idx] -= run;

      slices.push({
        taskId: tasks[idx].id,
        taskIndex: idx,
        start: start_t,
        end: end_t,
        duration: run
      });

      pushArrived(currentTime);

      if (rem[idx] > 0) {
        queue.push(idx);
        inQueue[idx] = true;
      } else {
        ct[idx] = currentTime;
        tat[idx] = ct[idx] - (tasks[idx].arrival || 0);
        wt[idx] = tat[idx] - tasks[idx].burst;
      }
    }
  } else if (algoId === 5 || algoId === 6) {
    // 5 = SRTF, 6 = Preemptive Priority
    let rem = tasks.map(t => t.burst);
    let completed = 0;
    let minArr = Math.min(...tasks.map(t => t.arrival || 0));
    let currentTime = minArr;
    let currentProc = -1;
    let sliceStart = currentTime;

    while (completed < n) {
      let ready = [];
      for (let i = 0; i < n; i++) {
        if ((tasks[i].arrival || 0) <= currentTime && rem[i] > 0) ready.push(i);
      }

      if (ready.length === 0) {
        if (currentProc !== -1) {
          slices.push({
            taskId: tasks[currentProc].id,
            taskIndex: currentProc,
            start: sliceStart,
            end: currentTime,
            duration: currentTime - sliceStart
          });
          currentProc = -1;
        }
        let nextArr = Infinity;
        for (let i = 0; i < n; i++) {
          if (rem[i] > 0 && (tasks[i].arrival || 0) < nextArr) nextArr = tasks[i].arrival || 0;
        }
        currentTime = nextArr;
        sliceStart = currentTime;
        continue;
      }

      let bestIdx;
      if (algoId === 5) {
        // SRTF: min remaining time
        ready.sort((a, b) => rem[a] - rem[b] || (tasks[a].arrival || 0) - (tasks[b].arrival || 0) || tasks[a].id - tasks[b].id);
        bestIdx = ready[0];
      } else {
        // Priority Preemptive: min priority value
        ready.sort((a, b) => tasks[a].priority - tasks[b].priority || (tasks[a].arrival || 0) - (tasks[b].arrival || 0) || tasks[a].id - tasks[b].id);
        bestIdx = ready[0];
      }

      if (bestIdx !== currentProc) {
        if (currentProc !== -1) {
          slices.push({
            taskId: tasks[currentProc].id,
            taskIndex: currentProc,
            start: sliceStart,
            end: currentTime,
            duration: currentTime - sliceStart
          });
        }
        currentProc = bestIdx;
        sliceStart = currentTime;
      }

      rem[bestIdx]--;
      currentTime++;

      if (rem[bestIdx] === 0) {
        completed++;
        ct[bestIdx] = currentTime;
        tat[bestIdx] = ct[bestIdx] - (tasks[bestIdx].arrival || 0);
        wt[bestIdx] = tat[bestIdx] - tasks[bestIdx].burst;

        slices.push({
          taskId: tasks[bestIdx].id,
          taskIndex: bestIdx,
          start: sliceStart,
          end: currentTime,
          duration: currentTime - sliceStart
        });
        currentProc = -1;
        sliceStart = currentTime;
      }
    }
  }

  const avgWT = wt.reduce((a, b) => a + b, 0) / n;
  const avgTAT = tat.reduce((a, b) => a + b, 0) / n;
  const totalDuration = slices.length > 0 ? Math.max(...slices.map(s => s.end)) : 0;

  const taskStats = tasks.map((t, i) => ({
    id: t.id,
    burst: t.burst,
    priority: t.priority,
    arrival: t.arrival || 0,
    waiting: wt[i],
    turnaround: tat[i],
    completion: ct[i]
  }));

  return {
    algoId,
    name,
    quantum: algoId === 4 ? quantum : null,
    avgWT: parseFloat(avgWT.toFixed(2)),
    avgTAT: parseFloat(avgTAT.toFixed(2)),
    totalDuration,
    taskStats,
    slices
  };
}

async function runScheduling() {
  const algoId = parseInt(document.getElementById('algoSelect').value, 10);
  const quantum = parseInt(document.getElementById('quantumInput').value, 10) || 2;

  try {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algoId, tasks: state.tasks, quantum })
    });
    if (!res.ok) throw new Error("API call failed");
    const data = await res.json();
    state.lastSchedule = data;
    renderSchedulingResults(data);
  } catch (err) {
    // Client-side fallback mode
    const data = localSchedule(algoId, state.tasks, quantum);
    state.lastSchedule = data;
    renderSchedulingResults(data);
  }
}

function renderSchedulingResults(data) {
  document.getElementById('kpiAvgWT').innerText = `${data.avgWT.toFixed(2)} units`;
  document.getElementById('kpiAvgTAT').innerText = `${data.avgTAT.toFixed(2)} units`;
  document.getElementById('kpiTotalDuration').innerText = `${data.totalDuration} units`;
  document.getElementById('kpiSlicesCount').innerText = `${data.slices.length} slices`;

  document.getElementById('activeAlgoBadge').innerText = `Algorithm: ${data.name}${data.quantum ? ` (Q=${data.quantum})` : ''}`;
  document.getElementById('ganttEndLabel').innerText = `Total Duration: ${data.totalDuration} units`;

  // Render Gantt Slices
  const timeline = document.getElementById('ganttTimeline');
  timeline.innerHTML = '';

  data.slices.forEach(s => {
    const color = getProcessColor(s.taskId);
    const sliceEl = document.createElement('div');
    sliceEl.className = 'gantt-slice rounded shadow-sm text-xs select-none';
    sliceEl.style.backgroundColor = color.bg;
    sliceEl.style.color = color.text;
    sliceEl.style.flex = `${s.duration} 0 auto`;
    sliceEl.innerHTML = `
      <div class="font-bold text-sm">T${s.taskId}</div>
      <div class="text-[10px] opacity-85 font-mono">${s.start} - ${s.end} (${s.duration}u)</div>
    `;
    timeline.appendChild(sliceEl);
  });

  // Render Metrics Table
  const tbody = document.getElementById('metricsTableBody');
  tbody.innerHTML = '';
  data.taskStats.forEach(ts => {
    const color = getProcessColor(ts.id);
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';
    tr.innerHTML = `
      <td class="py-2.5 px-4 font-bold flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color: ${color.bg}"></span>
        <span>T${ts.id}</span>
      </td>
      <td class="py-2.5 px-4 text-slate-300">${ts.arrival ?? 0}</td>
      <td class="py-2.5 px-4">${ts.burst}</td>
      <td class="py-2.5 px-4">${ts.priority}</td>
      <td class="py-2.5 px-4 text-cyan-300 font-semibold">${ts.waiting}</td>
      <td class="py-2.5 px-4 text-blue-300 font-semibold">${ts.turnaround}</td>
      <td class="py-2.5 px-4 text-slate-300">${ts.completion}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function compareAllAlgorithms() {
  const quantum = parseInt(document.getElementById('quantumInput').value, 10) || 2;
  try {
    const res = await fetch('/api/schedule/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: state.tasks, quantum })
    });
    if (!res.ok) throw new Error("API call failed");
    const data = await res.json();
    renderCompareResults(data);
  } catch (err) {
    // Client-side fallback for all 6 algorithms
    const algorithms = [];
    let bestWT = Infinity;
    let bestAlgo = "";

    for (let a = 1; a <= 6; a++) {
      const r = localSchedule(a, state.tasks, quantum);
      algorithms.push({
        algoId: a,
        name: r.name,
        avgWT: r.avgWT,
        avgTAT: r.avgTAT,
        slicesCount: r.slices.length
      });
      if (r.avgWT < bestWT) {
        bestWT = r.avgWT;
        bestAlgo = r.name;
      }
    }
    const data = {
      algorithms,
      bestAlgorithm: bestAlgo,
      bestAvgWT: bestWT,
      conclusion: `${bestAlgo} gives the lowest average waiting time (${bestWT.toFixed(2)}) for this task set.`
    };
    renderCompareResults(data);
  }
}

function renderCompareResults(data) {
  const container = document.getElementById('compareAllContainer');
  container.classList.remove('hidden');

  document.getElementById('compareConclusionText').innerHTML = `
    <i class="fa-solid fa-trophy mr-1 text-amber-400"></i> ${data.conclusion}
  `;

  const tbody = document.getElementById('compareTableBody');
  tbody.innerHTML = '';

  data.algorithms.forEach(a => {
    const isBest = a.name === data.bestAlgorithm;
    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-800/40 transition ${isBest ? 'bg-emerald-950/40 text-emerald-300 font-bold' : ''}`;
    tr.innerHTML = `
      <td class="py-2.5 px-4 flex items-center gap-2">
        ${isBest ? '<i class="fa-solid fa-crown text-amber-400 text-xs"></i>' : ''}
        <span>${a.name}</span>
      </td>
      <td class="py-2.5 px-4">${a.avgWT.toFixed(2)}</td>
      <td class="py-2.5 px-4">${a.avgTAT.toFixed(2)}</td>
      <td class="py-2.5 px-4">${a.slicesCount}</td>
    `;
    tbody.appendChild(tr);
  });

  const ctx = document.getElementById('compareChart').getContext('2d');
  if (state.charts.compareChart) state.charts.compareChart.destroy();

  state.charts.compareChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.algorithms.map(a => a.name),
      datasets: [
        {
          label: 'Avg Waiting Time',
          data: data.algorithms.map(a => a.avgWT),
          backgroundColor: 'rgba(6, 182, 212, 0.75)',
          borderColor: '#06b6d4',
          borderWidth: 1
        },
        {
          label: 'Avg Turnaround Time',
          data: data.algorithms.map(a => a.avgTAT),
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          borderColor: '#3b82f6',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#cbd5e1', font: { size: 11 } } },
        title: { display: true, text: 'Algorithm Performance Comparison (units)', color: '#94a3b8' }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' }, beginAtZero: true }
      }
    }
  });

  container.scrollIntoView({ behavior: 'smooth' });
}

function forwardToMultithreadedPool() {
  if (!state.lastSchedule || !state.lastSchedule.slices || state.lastSchedule.slices.length === 0) {
    runScheduling();
  }
  switchTab('tab-multithreading');
  prepareWorkerCards();
}

// -------------------------------------------------------------
// TAB 2: LIVE MULTITHREADED WORKER POOL
// -------------------------------------------------------------
function prepareWorkerCards() {
  const workerCount = parseInt(document.getElementById('threadWorkerCount').value, 10) || 2;
  const grid = document.getElementById('workerCardsGrid');
  grid.innerHTML = '';

  for (let w = 1; w <= workerCount; w++) {
    const card = document.createElement('div');
    card.id = `worker-card-${w}`;
    card.className = 'glass-panel p-4 border border-slate-700/60 transition-all duration-300';
    card.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center space-x-2">
          <div class="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
            W${w}
          </div>
          <span class="text-xs font-bold text-slate-200">Worker Thread ${w}</span>
        </div>
        <span id="worker-status-${w}" class="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">IDLE</span>
      </div>

      <div class="space-y-2 mt-3">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span>Current Task:</span>
          <span id="worker-task-${w}" class="font-bold text-white font-mono">None</span>
        </div>

        <div class="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
          <div id="worker-prog-${w}" class="bg-emerald-500 h-2 rounded-full transition-all duration-200" style="width: 0%"></div>
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span>Busy Time: <strong id="worker-busy-${w}" class="text-cyan-400 font-mono">0 ms</strong></span>
          <span>Utilization: <strong id="worker-util-${w}" class="text-emerald-400 font-mono">0%</strong></span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  }
}

document.getElementById('threadWorkerCount').addEventListener('change', prepareWorkerCards);

function clearTerminalLogs() {
  document.getElementById('terminalLogBox').innerHTML = '<div class="text-slate-500 italic">// Terminal stream reset.</div>';
}

function appendTerminalLog(text, colorClass = 'text-slate-300') {
  const box = document.getElementById('terminalLogBox');
  const div = document.createElement('div');
  div.className = `${colorClass} text-xs font-mono leading-relaxed`;
  div.innerText = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// Client-side simulation of producer-consumer multithreading if backend offline
function simulateThreadExecution(slices, workers, msPerUnit) {
  const events = [];
  const busyMs = new Array(workers).fill(0);
  const workerAvailableAt = new Array(workers).fill(0);
  let currentTimeMs = 0;

  // Monitor start
  events.push({
    type: 'MONITOR',
    message: `  [MONITOR] Active workers: 0/${workers} | CPU slots in use: 0%`,
    meta: { active: 0, total: workers, utilizationPct: 0 }
  });

  slices.forEach((s, idx) => {
    // Producer enqueues
    currentTimeMs += 15;
    events.push({
      type: 'PRODUCER_ENQUEUE',
      message: `[Producer] Queued slice Task T${s.taskId} (${s.duration} units)`,
      meta: { taskId: s.taskId, units: s.duration }
    });

    // Find earliest available worker
    let chosenWorker = 0;
    let minAvail = workerAvailableAt[0];
    for (let w = 1; w < workers; w++) {
      if (workerAvailableAt[w] < minAvail) {
        minAvail = workerAvailableAt[w];
        chosenWorker = w;
      }
    }

    const startWorkTime = Math.max(currentTimeMs, minAvail);
    const durationMs = s.duration * msPerUnit;
    const endWorkTime = startWorkTime + durationMs;

    workerAvailableAt[chosenWorker] = endWorkTime;
    busyMs[chosenWorker] += durationMs;

    events.push({
      type: 'WORKER_START',
      message: `  [Worker ${chosenWorker + 1}] START Task T${s.taskId} for ${s.duration} units`,
      meta: { workerId: chosenWorker + 1, taskId: s.taskId, units: s.duration }
    });

    events.push({
      type: 'MONITOR',
      message: `  [MONITOR] Active workers: ${Math.min(workers, idx + 1)}/${workers} | CPU slots in use: ${(100 * Math.min(workers, idx + 1) / workers).toFixed(0)}%`,
      meta: { active: Math.min(workers, idx + 1), total: workers, utilizationPct: (100 * Math.min(workers, idx + 1) / workers) }
    });

    events.push({
      type: 'WORKER_END',
      message: `  [Worker ${chosenWorker + 1}] END   Task T${s.taskId}`,
      meta: { workerId: chosenWorker + 1, taskId: s.taskId, busyMs: durationMs }
    });
  });

  const wallSec = Math.max(0.1, Math.max(...workerAvailableAt) / 1000.0);
  const totalBusy = busyMs.reduce((a, b) => a + b, 0);
  const avgUtil = 100.0 * (totalBusy / 1000.0) / (workers * wallSec);

  const workersSummary = busyMs.map((b, i) => ({
    workerId: i + 1,
    busyMs: b,
    tasksCompleted: Math.ceil(slices.length / workers),
    utilizationPct: parseFloat((100.0 * (b / 1000.0) / wallSec).toFixed(1))
  }));

  return {
    wallSec: parseFloat(wallSec.toFixed(2)),
    workerCount: workers,
    totalSlices: slices.length,
    totalBusyMs: totalBusy,
    averageUtilizationPct: parseFloat(avgUtil.toFixed(1)),
    workers: workersSummary,
    events
  };
}

async function runMultithreadedExecution() {
  if (!state.lastSchedule || !state.lastSchedule.slices || state.lastSchedule.slices.length === 0) {
    await runScheduling();
  }

  const slices = state.lastSchedule.slices;
  const workers = parseInt(document.getElementById('threadWorkerCount').value, 10) || 2;
  const msPerUnit = parseInt(document.getElementById('threadTimeScale').value, 10) || 50;

  prepareWorkerCards();
  clearTerminalLogs();
  appendTerminalLog(`=== Starting multithreaded task execution (${workers} worker threads) ===`, 'text-cyan-400 font-bold');

  const btn = document.getElementById('btnRunThreads');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Executing Threads...';

  document.getElementById('producerBadge').innerText = 'PUSHING';
  document.getElementById('producerBadge').className = 'text-[11px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono animate-pulse';

  try {
    const res = await fetch('/api/thread-exec/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slices, workers, msPerUnit })
    });
    if (!res.ok) throw new Error("Backend call failed");
    const data = await res.json();
    playLiveExecutionEvents(data, workers);
  } catch (err) {
    // Client-side fallback execution
    const data = simulateThreadExecution(slices, workers, msPerUnit);
    playLiveExecutionEvents(data, workers);
  }
}

function playLiveExecutionEvents(data, workerCount) {
  const events = data.events || [];
  let idx = 0;
  const visualQueue = document.getElementById('visualQueueContainer');
  visualQueue.innerHTML = '';

  const interval = setInterval(() => {
    if (idx >= events.length) {
      clearInterval(interval);
      finishExecutionPlayback(data);
      return;
    }

    const evt = events[idx];
    idx++;

    if (evt.type === 'MONITOR') {
      appendTerminalLog(evt.message, 'text-yellow-400 font-semibold');
      const active = evt.meta.active;
      const pct = evt.meta.utilizationPct;
      document.getElementById('liveActiveWorkersText').innerText = `${active} / ${workerCount}`;
      document.getElementById('liveCpuSlotPercent').innerText = `${pct.toFixed(0)}%`;
      document.getElementById('liveCpuProgressBar').style.width = `${pct}%`;
    } 
    else if (evt.type === 'PRODUCER_ENQUEUE') {
      appendTerminalLog(evt.message, 'text-blue-300');
      const pill = document.createElement('span');
      pill.id = `q-slice-${evt.meta.taskId}`;
      pill.className = 'px-2 py-1 rounded bg-slate-800 text-[11px] text-cyan-300 font-mono border border-slate-700 whitespace-nowrap';
      pill.innerText = `T${evt.meta.taskId} (${evt.meta.units}u)`;
      visualQueue.appendChild(pill);
      document.getElementById('queueCountBadge').innerText = `${visualQueue.children.length} slices`;
    } 
    else if (evt.type === 'WORKER_START') {
      appendTerminalLog(evt.message, 'text-emerald-400');
      const wId = evt.meta.workerId;
      const tId = evt.meta.taskId;

      const card = document.getElementById(`worker-card-${wId}`);
      if (card) card.classList.add('worker-busy');

      const st = document.getElementById(`worker-status-${wId}`);
      if (st) {
        st.innerText = 'RUNNING';
        st.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold';
      }

      const taskLabel = document.getElementById(`worker-task-${wId}`);
      if (taskLabel) taskLabel.innerText = `Task T${tId} (${evt.meta.units}u)`;

      const prog = document.getElementById(`worker-prog-${wId}`);
      if (prog) prog.style.width = '100%';

      const qItem = document.getElementById(`q-slice-${tId}`);
      if (qItem) qItem.remove();
      document.getElementById('queueCountBadge').innerText = `${visualQueue.children.length} slices`;
    } 
    else if (evt.type === 'WORKER_END') {
      appendTerminalLog(evt.message, 'text-violet-300');
      const wId = evt.meta.workerId;
      const card = document.getElementById(`worker-card-${wId}`);
      if (card) card.classList.remove('worker-busy');

      const st = document.getElementById(`worker-status-${wId}`);
      if (st) {
        st.innerText = 'IDLE';
        st.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400';
      }

      const prog = document.getElementById(`worker-prog-${wId}`);
      if (prog) prog.style.width = '0%';
    }
  }, 40);
}

function finishExecutionPlayback(data) {
  const btn = document.getElementById('btnRunThreads');
  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-play"></i> Start Thread Execution';

  document.getElementById('producerBadge').innerText = 'COMPLETED';
  document.getElementById('producerBadge').className = 'text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono';

  document.getElementById('liveActiveWorkersText').innerText = `0 / ${data.workerCount}`;
  document.getElementById('liveCpuSlotPercent').innerText = `0%`;
  document.getElementById('liveCpuProgressBar').style.width = '0%';

  const summary = document.getElementById('threadExecSummaryContainer');
  summary.classList.remove('hidden');

  document.getElementById('summaryWallSec').innerText = `${data.wallSec.toFixed(2)} s`;
  document.getElementById('summaryAvgUtil').innerText = `${data.averageUtilizationPct.toFixed(1)}%`;
  document.getElementById('summaryTotalBusy').innerText = `${data.totalBusyMs.toFixed(0)} ms`;
  document.getElementById('summaryCompletedSlices').innerText = `${data.totalSlices} slices`;

  data.workers.forEach(w => {
    const busyEl = document.getElementById(`worker-busy-${w.workerId}`);
    if (busyEl) busyEl.innerText = `${w.busyMs.toFixed(0)} ms`;

    const utilEl = document.getElementById(`worker-util-${w.workerId}`);
    if (utilEl) utilEl.innerText = `${w.utilizationPct.toFixed(1)}%`;

    const st = document.getElementById(`worker-status-${w.workerId}`);
    if (st) {
      st.innerText = 'DONE';
      st.className = 'text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300';
    }
  });

  appendTerminalLog(`\nAll ${data.totalSlices} slices executed by ${data.workerCount} worker threads in ${data.wallSec.toFixed(2)} s`, 'text-white font-bold');
  appendTerminalLog(`Average worker utilization: ${data.averageUtilizationPct.toFixed(1)}%`, 'text-emerald-400 font-bold');
}

// -------------------------------------------------------------
// TAB 3: SCALABILITY & SPEEDUP ANALYSIS
// -------------------------------------------------------------
async function runScalabilityBenchmark() {
  if (!state.lastSchedule || !state.lastSchedule.slices || state.lastSchedule.slices.length === 0) {
    await runScheduling();
  }

  const slices = state.lastSchedule.slices;
  try {
    const res = await fetch('/api/thread-exec/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slices, maxWorkers: 4, msPerUnit: 30 })
    });
    if (!res.ok) throw new Error("Benchmark API error");
    const data = await res.json();
    renderScalabilityResults(data);
  } catch (err) {
    // Client-side benchmark calculation matching RSCOE lab report
    const results = [];
    let baseTime = null;
    for (let w = 1; w <= 4; w++) {
      const exec = simulateThreadExecution(slices, w, 40);
      if (w === 1) baseTime = exec.wallSec;
      const speedup = parseFloat((baseTime / exec.wallSec).toFixed(2));
      results.push({
        workers: w,
        wallSec: exec.wallSec,
        averageUtilizationPct: exec.averageUtilizationPct,
        speedup: speedup,
        idealSpeedup: parseFloat(w.toFixed(1))
      });
    }
    renderScalabilityResults({ analysisTable: results });
  }
}

function renderScalabilityResults(data) {
  const tbody = document.getElementById('scalabilityTableBody');
  tbody.innerHTML = '';

  const labels = [];
  const speedups = [];
  const idealSpeedups = [];
  const utilizations = [];

  data.analysisTable.forEach(row => {
    labels.push(`${row.workers} Worker${row.workers > 1 ? 's' : ''}`);
    speedups.push(row.speedup);
    idealSpeedups.push(row.idealSpeedup);
    utilizations.push(row.averageUtilizationPct);

    const eff = (row.speedup / row.workers) * 100;
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';
    tr.innerHTML = `
      <td class="py-2.5 px-4 font-bold text-cyan-400">W = ${row.workers}</td>
      <td class="py-2.5 px-4">${row.wallSec.toFixed(2)}</td>
      <td class="py-2.5 px-4 text-emerald-400 font-semibold">${row.averageUtilizationPct.toFixed(1)}%</td>
      <td class="py-2.5 px-4 text-cyan-300 font-bold">${row.speedup.toFixed(2)}x</td>
      <td class="py-2.5 px-4 text-slate-300">${eff.toFixed(1)}%</td>
    `;
    tbody.appendChild(tr);
  });

  // Speedup Curve
  const ctxSpeedup = document.getElementById('speedupChart').getContext('2d');
  if (state.charts.speedupChart) state.charts.speedupChart.destroy();

  state.charts.speedupChart = new Chart(ctxSpeedup, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Measured Speedup',
          data: speedups,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.2)',
          tension: 0.2,
          fill: true,
          pointBackgroundColor: '#06b6d4',
          pointRadius: 5
        },
        {
          label: 'Ideal Linear Speedup (S = W)',
          data: idealSpeedups,
          borderColor: '#64748b',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#cbd5e1' } },
        title: { display: true, text: 'Speedup vs Worker Threads', color: '#94a3b8' }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' }, beginAtZero: true }
      }
    }
  });

  // Utilization Chart
  const ctxUtil = document.getElementById('utilizationChart').getContext('2d');
  if (state.charts.utilizationChart) state.charts.utilizationChart.destroy();

  state.charts.utilizationChart = new Chart(ctxUtil, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Avg Worker Utilization %',
          data: utilizations,
          backgroundColor: [
            'rgba(16, 185, 129, 0.8)',
            'rgba(6, 182, 212, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ],
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Resource Efficiency Drop-off (%)', color: '#94a3b8' }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' }, max: 100, beginAtZero: true }
      }
    }
  });
}

// -------------------------------------------------------------
// TAB 4: BANKER'S DEADLOCK AVOIDANCE
// -------------------------------------------------------------
function initBankers() {
  renderBankersInputs();
  runBankersSafetyCheck();
}

function loadBankersPreset(type) {
  if (type === 'rscoe') {
    state.bankersData = {
      n: 5,
      m: 3,
      resourceNames: ["A", "B", "C"],
      allocation: [
        [0, 1, 0],
        [2, 0, 0],
        [3, 0, 2],
        [2, 1, 1],
        [0, 0, 2]
      ],
      max: [
        [7, 5, 3],
        [3, 2, 2],
        [9, 0, 2],
        [2, 2, 2],
        [4, 3, 3]
      ],
      available: [3, 3, 2]
    };
  }
  renderBankersInputs();
  runBankersSafetyCheck();
}

function renderBankersInputs() {
  const b = state.bankersData;

  const availContainer = document.getElementById('availableInputsContainer');
  availContainer.innerHTML = '';
  b.available.forEach((val, j) => {
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center space-x-1.5';
    wrap.innerHTML = `
      <span class="text-xs font-bold text-cyan-400">${b.resourceNames[j]}:</span>
      <input type="number" min="0" value="${val}" 
        onchange="updateBankersAvailable(${j}, this.value)" 
        class="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono">
    `;
    availContainer.appendChild(wrap);
  });

  const allocContainer = document.getElementById('allocTableContainer');
  let allocHtml = '<table class="w-full text-xs font-mono text-center"><thead><tr class="text-slate-400 border-b border-slate-800"><th class="py-1">P#</th>';
  b.resourceNames.forEach(rn => allocHtml += `<th class="py-1">${rn}</th>`);
  allocHtml += '</tr></thead><tbody>';
  for (let i = 0; i < b.n; i++) {
    allocHtml += `<tr class="border-b border-slate-800/40"><td class="py-1.5 font-bold text-slate-300">P${i}</td>`;
    for (let j = 0; j < b.m; j++) {
      allocHtml += `<td><input type="number" min="0" value="${b.allocation[i][j]}" onchange="updateBankersAlloc(${i}, ${j}, this.value)" class="w-10 bg-slate-800/80 border border-slate-700/60 rounded text-center text-xs text-white py-0.5"></td>`;
    }
    allocHtml += '</tr>';
  }
  allocHtml += '</tbody></table>';
  allocContainer.innerHTML = allocHtml;

  const maxContainer = document.getElementById('maxTableContainer');
  let maxHtml = '<table class="w-full text-xs font-mono text-center"><thead><tr class="text-slate-400 border-b border-slate-800"><th class="py-1">P#</th>';
  b.resourceNames.forEach(rn => maxHtml += `<th class="py-1">${rn}</th>`);
  maxHtml += '</tr></thead><tbody>';
  for (let i = 0; i < b.n; i++) {
    maxHtml += `<tr class="border-b border-slate-800/40"><td class="py-1.5 font-bold text-slate-300">P${i}</td>`;
    for (let j = 0; j < b.m; j++) {
      maxHtml += `<td><input type="number" min="0" value="${b.max[i][j]}" onchange="updateBankersMax(${i}, ${j}, this.value)" class="w-10 bg-slate-800/80 border border-slate-700/60 rounded text-center text-xs text-white py-0.5"></td>`;
    }
    maxHtml += '</tr>';
  }
  maxHtml += '</tbody></table>';
  maxContainer.innerHTML = maxHtml;

  const reqContainer = document.getElementById('requestVectorInputs');
  reqContainer.innerHTML = '';
  b.resourceNames.forEach((rn, j) => {
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center space-x-1';
    wrap.innerHTML = `
      <span class="text-xs text-slate-400">${rn}:</span>
      <input type="number" id="req-val-${j}" min="0" value="${j === 0 ? 1 : (j === 2 ? 2 : 0)}" class="w-12 bg-slate-800 border border-slate-700 rounded px-1.5 py-1 text-xs text-white font-mono">
    `;
    reqContainer.appendChild(wrap);
  });
}

function updateBankersAvailable(j, val) {
  state.bankersData.available[j] = parseInt(val, 10) || 0;
  runBankersSafetyCheck();
}

function updateBankersAlloc(i, j, val) {
  state.bankersData.allocation[i][j] = parseInt(val, 10) || 0;
  runBankersSafetyCheck();
}

function updateBankersMax(i, j, val) {
  state.bankersData.max[i][j] = parseInt(val, 10) || 0;
  runBankersSafetyCheck();
}

// Local Banker's Algorithm
function localBankersSafetyCheck(alloc, max, avail) {
  const n = alloc.length;
  const m = avail.length;
  const need = [];
  for (let i = 0; i < n; i++) {
    need.push(max[i].map((v, j) => v - alloc[i][j]));
  }

  let work = [...avail];
  let finish = new Array(n).fill(false);
  let safeSeq = [];
  let trace = [];

  let count = 0;
  while (count < n) {
    let found = false;
    for (let i = 0; i < n; i++) {
      if (!finish[i]) {
        let canProceed = need[i].every((needVal, j) => needVal <= work[j]);
        if (canProceed) {
          let prevWork = [...work];
          for (let j = 0; j < m; j++) {
            work[j] += alloc[i][j];
          }
          finish[i] = true;
          safeSeq.push(i);
          count++;
          found = true;

          trace.push({
            step: count,
            process: i,
            processName: `P${i}`,
            need: [...need[i]],
            workBefore: prevWork,
            workAfter: [...work],
            allocatedReleased: [...alloc[i]]
          });
        }
      }
    }
    if (!found) break;
  }

  const isSafe = (count === n);
  return {
    isSafe,
    safeSequence: safeSeq,
    safeSequenceStr: isSafe ? safeSeq.map(p => `P${p}`).join(' -> ') : 'UNSAFE',
    need,
    trace
  };
}

async function runBankersSafetyCheck() {
  const b = state.bankersData;
  try {
    const res = await fetch('/api/bankers/safety', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocation: b.allocation, max: b.max, available: b.available })
    });
    if (!res.ok) throw new Error("Safety check API failed");
    const data = await res.json();
    renderBankersSafetyResults(data);
  } catch (err) {
    const data = localBankersSafetyCheck(b.allocation, b.max, b.available);
    renderBankersSafetyResults(data);
  }
}

function renderBankersSafetyResults(data) {
  const b = state.bankersData;

  const needContainer = document.getElementById('needTableContainer');
  let needHtml = '<table class="w-full text-xs font-mono text-center"><thead><tr class="text-slate-400 border-b border-slate-800"><th class="py-1">P#</th>';
  b.resourceNames.forEach(rn => needHtml += `<th class="py-1">${rn}</th>`);
  needHtml += '</tr></thead><tbody>';
  for (let i = 0; i < b.n; i++) {
    needHtml += `<tr class="border-b border-slate-800/40"><td class="py-1.5 font-bold text-slate-300">P${i}</td>`;
    for (let j = 0; j < b.m; j++) {
      const nVal = data.need[i][j];
      needHtml += `<td class="text-amber-300 py-1 font-semibold">${nVal}</td>`;
    }
    needHtml += '</tr>';
  }
  needHtml += '</tbody></table>';
  needContainer.innerHTML = needHtml;

  const badge = document.getElementById('safeStateBadge');
  if (data.isSafe) {
    badge.innerText = 'SAFE STATE';
    badge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800';
  } else {
    badge.innerText = 'UNSAFE STATE (DEADLOCK IMMINENT)';
    badge.className = 'px-3 py-1 text-xs font-bold rounded-full bg-rose-950 text-rose-400 border border-rose-800 animate-pulse';
  }

  const flowContainer = document.getElementById('safeSequenceFlow');
  flowContainer.innerHTML = '';

  if (data.isSafe && data.safeSequence.length > 0) {
    data.safeSequence.forEach((pIdx, i) => {
      const node = document.createElement('div');
      node.className = 'flex items-center space-x-2';
      node.innerHTML = `
        <div class="px-3.5 py-1.5 rounded-lg bg-emerald-600/30 border border-emerald-500 text-emerald-300 font-bold font-mono text-sm shadow-sm">
          P${pIdx}
        </div>
        ${i < data.safeSequence.length - 1 ? '<i class="fa-solid fa-arrow-right text-slate-600 text-xs"></i>' : ''}
      `;
      flowContainer.appendChild(node);
    });
  } else {
    flowContainer.innerHTML = '<span class="text-rose-400 font-semibold text-xs"><i class="fa-solid fa-triangle-exclamation mr-1"></i> No safe sequence exists. Circular wait / deadlock detected.</span>';
  }

  const traceContainer = document.getElementById('bankersTraceContainer');
  traceContainer.innerHTML = '';
  if (data.trace && data.trace.length > 0) {
    data.trace.forEach(step => {
      const div = document.createElement('div');
      div.className = 'bg-slate-900/60 p-2.5 rounded border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-2';
      div.innerHTML = `
        <div class="flex items-center space-x-2">
          <span class="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono font-bold">Step ${step.step}</span>
          <span class="font-bold text-white">${step.processName}</span>
          <span class="text-slate-400">Need [${step.need.join(', ')}] &le; Work [${step.workBefore.join(', ')}]</span>
        </div>
        <div class="text-emerald-400 font-mono">
          Work &larr; Work + Alloc &rArr; [${step.workAfter.join(', ')}]
        </div>
      `;
      traceContainer.appendChild(div);
    });
  }
}

async function testResourceRequest() {
  const b = state.bankersData;
  const procId = parseInt(document.getElementById('requestProcSelect').value, 10);
  const request = [];
  for (let j = 0; j < b.m; j++) {
    request.push(parseInt(document.getElementById(`req-val-${j}`).value, 10) || 0);
  }

  const alertBox = document.getElementById('requestResultAlert');
  alertBox.classList.remove('hidden');

  try {
    const res = await fetch('/api/bankers/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allocation: b.allocation,
        max: b.max,
        available: b.available,
        processId: procId,
        request: request
      })
    });
    if (!res.ok) throw new Error("Request API error");
    const data = await res.json();
    renderRequestAlert(data);
  } catch (err) {
    // Local verification
    const needP = b.max[procId].map((mx, j) => mx - b.allocation[procId][j]);
    let ok = true;
    let reason = "";

    for (let j = 0; j < b.m; j++) {
      if (request[j] > needP[j]) {
        ok = false;
        reason = `Request exceeds maximum claim! Need of P${procId} is [${needP}], requested [${request}]`;
        break;
      }
      if (request[j] > b.available[j]) {
        ok = false;
        reason = `Resources not available! Available is [${b.available}], requested [${request}]. P${procId} must wait.`;
        break;
      }
    }

    if (ok) {
      let pretendAvail = b.available.map((av, j) => av - request[j]);
      let pretendAlloc = b.allocation.map((row, i) => i === procId ? row.map((v, j) => v + request[j]) : [...row]);
      let pretendMax = b.max.map(row => [...row]);

      let pretendRes = localBankersSafetyCheck(pretendAlloc, pretendMax, pretendAvail);
      if (pretendRes.isSafe) {
        renderRequestAlert({
          granted: true,
          reason: `Request can be safely GRANTED. Safe sequence: ${pretendRes.safeSequenceStr}`,
          safeSequenceStr: pretendRes.safeSequenceStr
        });
      } else {
        renderRequestAlert({
          granted: false,
          reason: "Request DENIED. Allocating this request causes an UNSAFE state (deadlock possible)."
        });
      }
    } else {
      renderRequestAlert({ granted: false, reason });
    }
  }
}

function renderRequestAlert(data) {
  const alertBox = document.getElementById('requestResultAlert');
  alertBox.classList.remove('hidden');

  if (data.granted) {
    alertBox.className = 'mt-4 p-4 rounded-lg text-xs font-medium bg-emerald-950/80 border border-emerald-800 text-emerald-300 space-y-1';
    alertBox.innerHTML = `
      <div class="font-bold text-sm flex items-center gap-1.5"><i class="fa-solid fa-circle-check"></i> Request GRANTED</div>
      <p>${data.reason}</p>
      <p class="text-[11px] text-emerald-400/80 font-mono">New Safe Sequence: ${data.safeSequenceStr}</p>
    `;
  } else {
    alertBox.className = 'mt-4 p-4 rounded-lg text-xs font-medium bg-rose-950/80 border border-rose-800 text-rose-300 space-y-1';
    alertBox.innerHTML = `
      <div class="font-bold text-sm flex items-center gap-1.5"><i class="fa-solid fa-circle-xmark"></i> Request DENIED</div>
      <p>${data.reason || data.error}</p>
    `;
  }
}

function loadSampleRequest() {
  document.getElementById('requestProcSelect').value = '1';
  document.getElementById('req-val-0').value = 1;
  document.getElementById('req-val-1').value = 0;
  document.getElementById('req-val-2').value = 2;
  testResourceRequest();
}

// -------------------------------------------------------------
// TAB 5: MEMORY ALLOCATION
// -------------------------------------------------------------
function initMemory() {
  runMemoryAllocation();
}

function loadMemoryPreset(type) {
  if (type === 'preset1') {
    document.getElementById('memoryBlocksInput').value = '100, 500, 200, 300, 600';
    document.getElementById('memoryProcsInput').value = '212, 417, 112, 426';
  } else if (type === 'preset2') {
    document.getElementById('memoryBlocksInput').value = '100, 200, 300, 400, 500';
    document.getElementById('memoryProcsInput').value = '150, 220, 300, 50';
  }
  runMemoryAllocation();
}

function localMemoryAllocation(blocks, procs) {
  const algoNames = ["First Fit", "Best Fit", "Worst Fit"];
  const summary = [];
  const detailedResults = {};

  algoNames.forEach((name, st) => {
    let used = new Array(blocks.length).fill(false);
    let alloc = new Array(procs.length).fill(-1);

    procs.forEach((pSize, i) => {
      let pick = -1;
      blocks.forEach((bSize, b) => {
        if (used[b] || bSize < pSize) return;
        if (st === 0) { // First Fit
          if (pick === -1) pick = b;
        } else if (st === 1) { // Best Fit
          if (pick === -1 || bSize < blocks[pick]) pick = b;
        } else if (st === 2) { // Worst Fit
          if (pick === -1 || bSize > blocks[pick]) pick = b;
        }
      });
      if (pick !== -1) {
        used[pick] = true;
        alloc[i] = pick;
      }
    });

    let internalFrag = 0;
    let unallocatedCount = 0;
    let procDetails = [];

    procs.forEach((pSize, i) => {
      let bIdx = alloc[i];
      if (bIdx !== -1) {
        let frag = blocks[bIdx] - pSize;
        internalFrag += frag;
        procDetails.push({
          processIndex: i,
          processId: `P${i + 1}`,
          size: pSize,
          allocated: true,
          blockIndex: bIdx,
          blockId: `B${bIdx + 1}`,
          blockSize: blocks[bIdx],
          internalFrag: frag
        });
      } else {
        unallocatedCount++;
        procDetails.push({
          processIndex: i,
          processId: `P${i + 1}`,
          size: pSize,
          allocated: false,
          blockIndex: null,
          blockId: null,
          blockSize: null,
          internalFrag: 0
        });
      }
    });

    let freeBlocksTotal = 0;
    let blockDetails = blocks.map((bSize, b) => {
      let proc = procDetails.find(p => p.blockIndex === b);
      if (proc) {
        return {
          blockIndex: b,
          blockId: `B${b + 1}`,
          size: bSize,
          isUsed: true,
          processId: proc.processId,
          processSize: proc.size,
          internalFrag: proc.internalFrag
        };
      } else {
        freeBlocksTotal += bSize;
        return {
          blockIndex: b,
          blockId: `B${b + 1}`,
          size: bSize,
          isUsed: false,
          processId: null,
          processSize: 0,
          internalFrag: 0
        };
      }
    });

    detailedResults[name] = {
      name,
      internalFrag,
      unallocated: unallocatedCount,
      freeBlocksTotal,
      processes: procDetails,
      blocks: blockDetails
    };

    summary.push({
      algorithm: name,
      internalFrag,
      unallocated: unallocatedCount,
      freeBlocksTotal
    });
  });

  const sortedSummary = [...summary].sort((a, b) => a.unallocated - b.unallocated || a.internalFrag - b.internalFrag);
  const bestAlgo = sortedSummary[0].algorithm;

  return {
    blocks,
    processes: procs,
    summary,
    details: detailedResults,
    recommendedAlgorithm: bestAlgo,
    recommendationReason: `${bestAlgo} yielded optimal partition utilization with minimal internal fragmentation (${sortedSummary[0].internalFrag} KB) and zero unallocated jobs.`
  };
}

async function runMemoryAllocation() {
  const blocksRaw = document.getElementById('memoryBlocksInput').value;
  const procsRaw = document.getElementById('memoryProcsInput').value;

  const blocks = blocksRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
  const procs = procsRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);

  try {
    const res = await fetch('/api/memory/allocate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks, processes: procs })
    });
    if (!res.ok) throw new Error("Memory API error");
    const data = await res.json();
    renderMemoryResults(data);
  } catch (err) {
    const data = localMemoryAllocation(blocks, procs);
    renderMemoryResults(data);
  }
}

function renderMemoryResults(data) {
  const tbody = document.getElementById('memorySummaryTableBody');
  tbody.innerHTML = '';

  data.summary.forEach(s => {
    const isRec = s.algorithm === data.recommendedAlgorithm;
    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-800/40 transition ${isRec ? 'bg-emerald-950/40 text-emerald-300 font-bold' : ''}`;
    tr.innerHTML = `
      <td class="py-2.5 px-4 flex items-center gap-2">
        ${isRec ? '<i class="fa-solid fa-award text-amber-400"></i>' : ''}
        <span>${s.algorithm}</span>
      </td>
      <td class="py-2.5 px-4">${s.internalFrag} KB</td>
      <td class="py-2.5 px-4 ${s.unallocated > 0 ? 'text-rose-400' : 'text-slate-300'}">${s.unallocated}</td>
      <td class="py-2.5 px-4">${s.freeBlocksTotal} KB</td>
      <td class="py-2.5 px-4 text-cyan-400 font-semibold">${s.unallocated === 0 ? '100% (All Jobs Placed)' : 'Incomplete'}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('memoryWinnerBadge').innerText = `Best: ${data.recommendedAlgorithm}`;
  document.getElementById('memoryRecommendationText').innerHTML = `
    <i class="fa-solid fa-circle-info text-cyan-400 mr-1.5"></i> ${data.recommendationReason}
  `;

  renderAlgorithmBlocks('First Fit', data.details['First Fit'], 'ffBlocksContainer', 'ffFragBadge');
  renderAlgorithmBlocks('Best Fit', data.details['Best Fit'], 'bfBlocksContainer', 'bfFragBadge');
  renderAlgorithmBlocks('Worst Fit', data.details['Worst Fit'], 'wfBlocksContainer', 'wfFragBadge');
}

function renderAlgorithmBlocks(name, details, containerId, fragBadgeId) {
  document.getElementById(fragBadgeId).innerText = `Frag: ${details.internalFrag} KB`;
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  details.blocks.forEach(b => {
    const card = document.createElement('div');
    card.className = 'p-3 rounded-lg border border-slate-800 bg-slate-900/80 space-y-2';

    if (b.isUsed) {
      const procPct = Math.min(100, Math.max(10, ((b.processSize / b.size) * 100))).toFixed(0);
      const fragPct = 100 - procPct;
      card.innerHTML = `
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-white font-mono">${b.blockId} (${b.size} KB)</span>
          <span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] font-bold">Allocated to ${b.processId}</span>
        </div>
        <div class="w-full flex rounded h-6 overflow-hidden border border-slate-800 text-[10px] font-mono font-bold text-center">
          <div class="bg-emerald-600 flex items-center justify-center text-white" style="width: ${procPct}%" title="${b.processId} (${b.processSize} KB)">
            ${b.processId} (${b.processSize}k)
          </div>
          <div class="bg-frag-stripes flex items-center justify-center text-amber-200 border-l border-amber-500/40" style="width: ${fragPct}%" title="Internal Frag (${b.internalFrag} KB)">
            ${b.internalFrag > 0 ? `Frag ${b.internalFrag}k` : ''}
          </div>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-slate-400 font-mono">${b.blockId} (${b.size} KB)</span>
          <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-500 font-mono text-[10px]">FREE</span>
        </div>
        <div class="w-full bg-slate-950 rounded h-6 flex items-center justify-center text-[10px] font-mono text-slate-500 border border-slate-800/80">
          Unallocated Space (${b.size} KB)
        </div>
      `;
    }
    container.appendChild(card);
  });
}

// -------------------------------------------------------------
// EXPORT SESSION DATA
// -------------------------------------------------------------
function exportSessionJSON() {
  const exportPayload = {
    project: "MULTITHREADING-BASED APPLICATION FOR RESOURCE UTILIZATION AND TASK EXECUTION",
    student: {
      name: "Aryan Shyam Phalke",
      prn: "RBT25CS111",
      rollNo: "CS2240",
      college: "JSPM's Rajarshi Shahu College of Engineering, Pune"
    },
    timestamp: new Date().toISOString(),
    tasks: state.tasks,
    lastSchedule: state.lastSchedule,
    bankersData: state.bankersData
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `OS_Mini_Project_Aryan_Phalke_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------
// ON LOAD
// -------------------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  renderTaskTable();
  prepareWorkerCards();
  runScheduling();
  initBankers();
  initMemory();

  // Test backend connectivity
  fetch('/api/health')
    .then(r => r.json())
    .then(data => {
      state.isBackendConnected = true;
      const badge = document.getElementById('connectionStatus');
      if (badge) {
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span><span>Backend Connected (Python Threading Server)</span>';
        badge.className = 'flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800';
      }
    })
    .catch(() => {
      state.isBackendConnected = false;
      const badge = document.getElementById('connectionStatus');
      if (badge) {
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-cyan-400"></span><span>Client Interactive Mode (Run server.py for Live Multithreading)</span>';
        badge.className = 'flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-950/80 text-cyan-300 border border-cyan-800';
      }
    });
});
