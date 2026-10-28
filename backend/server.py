"""
Backend REST Server for OS Multithreading & Resource Utilization Simulator
Built with Python's ThreadingHTTPServer (zero external dependencies required).
"""

import sys
import os
import json
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

# Add current directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from scheduler import Task, schedule, compare_all
from thread_executor import ThreadExecutor
from utilization_analyzer import analyze_thread_scalability
from bankers import BankersAlgorithm, get_default_bankers_sample
from memory import allocate_memory

FRONTEND_DIR = os.path.abspath(os.path.join(current_dir, "..", "frontend"))


class OSProjectHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def _send_json_response(self, status_code: int, data: dict):
        response_bytes = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_bytes)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(response_bytes)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _read_json_body(self) -> dict:
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            return {}
        raw_body = self.rfile.read(content_len).decode("utf-8")
        return json.loads(raw_body)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            self._send_json_response(200, {
                "status": "healthy",
                "system": "OS Multithreaded Simulator",
                "author": "Aryan Shyam Phalke",
                "college": "RSCOE Pune"
            })
            return

        if path == "/api/bankers/sample":
            self._send_json_response(200, get_default_bankers_sample())
            return

        # Serve static frontend files
        if path == "/" or path == "":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        try:
            body = self._read_json_body()

            # 1. CPU Scheduling Endpoint
            if path == "/api/schedule":
                algo_id = int(body.get("algoId", 1))
                quantum = int(body.get("quantum", 2))
                raw_tasks = body.get("tasks", [])
                tasks = [Task(t.get("id", i + 1), t.get("burst", 2), t.get("priority", 1), t.get("arrival", 0))
                         for i, t in enumerate(raw_tasks)]
                result = schedule(algo_id, tasks, quantum)
                self._send_json_response(200, result)
                return

            # 2. Compare All Scheduling Algorithms Endpoint
            if path == "/api/schedule/compare":
                quantum = int(body.get("quantum", 2))
                raw_tasks = body.get("tasks", [])
                tasks = [Task(t.get("id", i + 1), t.get("burst", 2), t.get("priority", 1), t.get("arrival", 0))
                         for i, t in enumerate(raw_tasks)]
                result = compare_all(tasks, quantum)
                self._send_json_response(200, result)
                return

            # 3. Real Multithreaded Worker Execution Endpoint
            if path == "/api/thread-exec/run":
                slices = body.get("slices", [])
                workers = int(body.get("workers", 2))
                ms_per_unit = int(body.get("msPerUnit", 40))
                executor = ThreadExecutor(slices, workers=workers, ms_per_unit=ms_per_unit, verbose=True)
                stats = executor.run()
                self._send_json_response(200, stats)
                return

            # 4. Resource Utilization & Scalability Benchmark Endpoint (1-4 workers)
            if path == "/api/thread-exec/analysis":
                slices = body.get("slices", [])
                max_workers = int(body.get("maxWorkers", 4))
                ms_per_unit = int(body.get("msPerUnit", 30))
                analysis = analyze_thread_scalability(slices, max_workers=max_workers, ms_per_unit=ms_per_unit)
                self._send_json_response(200, analysis)
                return

            # 5. Banker's Algorithm Safety Check Endpoint
            if path == "/api/bankers/safety":
                alloc = body.get("allocation", [])
                mx = body.get("max", [])
                avail = body.get("available", [])
                bankers = BankersAlgorithm(alloc, mx, avail)
                is_safe, seq, trace = bankers.check_safety()
                self._send_json_response(200, {
                    "isSafe": is_safe,
                    "safeSequence": seq,
                    "safeSequenceStr": " -> ".join(f"P{x}" for x in seq) if is_safe else "UNSAFE",
                    "need": bankers.need,
                    "trace": trace
                })
                return

            # 6. Banker's Algorithm Resource Request Test Endpoint
            if path == "/api/bankers/request":
                alloc = body.get("allocation", [])
                mx = body.get("max", [])
                avail = body.get("available", [])
                proc_id = int(body.get("processId", 0))
                request = body.get("request", [])
                bankers = BankersAlgorithm(alloc, mx, avail)
                res = bankers.process_request(proc_id, request)
                self._send_json_response(200, res)
                return

            # 7. Memory Management (First / Best / Worst Fit) Endpoint
            if path == "/api/memory/allocate":
                blocks = body.get("blocks", [100, 500, 200, 300, 600])
                procs = body.get("processes", [212, 417, 112, 426])
                res = allocate_memory(blocks, procs)
                self._send_json_response(200, res)
                return

            self._send_json_response(404, {"error": f"Endpoint {path} not found"})

        except Exception as e:
            self._send_json_response(500, {"error": str(e)})


def run_server(port: int = 8000):
    server_address = ("127.0.0.1", port)
    httpd = ThreadingHTTPServer(server_address, OSProjectHandler)
    print(f"============================================================")
    print(f" OS MULTITHREADING SIMULATOR BACKEND ACTIVE")
    print(f" Server running at: http://localhost:{port}/")
    print(f" Frontend served from: {FRONTEND_DIR}")
    print(f" Press Ctrl+C to terminate.")
    print(f"============================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server cleanly...")
        httpd.server_close()


if __name__ == "__main__":
    port_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port_arg)
