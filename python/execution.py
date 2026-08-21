import os
import time
import subprocess
from typing import Dict, Any

class ExperimentRunner:
    def __init__(self, repo_path: str, max_steps: int = 8, max_runtime_seconds: int = 60):
        self.repo_path = repo_path
        self.max_steps = max_steps
        self.max_runtime_seconds = max_runtime_seconds
        self.step_count = 0
        self.start_time = time.time()

    def run_experiment(self, command: str) -> Dict[str, Any]:
        self.step_count += 1
        if self.step_count > self.max_steps:
            return {"success": False, "output": "Max investigation steps exceeded."}

        if time.time() - self.start_time > self.max_runtime_seconds:
            return {"success": False, "output": "Max runtime exceeded."}

        cmd_lower = command.lower().strip()

        # 1. Read file
        if cmd_lower.startswith("read file") or cmd_lower.startswith("cat "):
            file_name = command.replace("read file", "").replace("cat ", "").strip()
            target_path = os.path.join(self.repo_path, file_name)
            if os.path.exists(target_path) and os.path.isfile(target_path):
                with open(target_path, "r", encoding="utf-8", errors="replace") as f:
                    return {"success": True, "output": f.read()}
            return {"success": False, "output": f"File not found: {file_name}"}

        # 2. Search / grep
        if cmd_lower.startswith("search") or cmd_lower.startswith("git grep"):
            pattern = command.replace("search", "").replace("git grep", "").strip().strip('"').strip("'")
            matches = []
            for root, _, files in os.walk(self.repo_path):
                for file in files:
                    if file.endswith(('.py', '.json', '.txt', '.md', '.yml', '.yaml')):
                        p = os.path.join(root, file)
                        try:
                            with open(p, 'r', encoding='utf-8', errors='ignore') as f:
                                for line_no, line in enumerate(f, 1):
                                    if pattern in line:
                                        rel = os.path.relpath(p, self.repo_path)
                                        matches.append(f"{rel}:{line_no}: {line.strip()}")
                        except:
                            pass
            return {"success": True, "output": "\n".join(matches) if matches else "No matches found."}

        # 3. Git Diff
        if "git diff" in cmd_lower:
            try:
                res = subprocess.run(["git", "diff"], cwd=self.repo_path, capture_output=True, text=True, timeout=10)
                return {"success": True, "output": res.stdout or "No changes detected."}
            except Exception as e:
                return {"success": False, "output": str(e)}

        # 4. Pytest
        if "pytest" in cmd_lower:
            try:
                res = subprocess.run(["pytest"], cwd=self.repo_path, capture_output=True, text=True, timeout=15)
                return {"success": True, "output": res.stdout or res.stderr}
            except Exception as e:
                return {"success": False, "output": str(e)}

        return {"success": False, "output": f"Unsupported sandboxed command: {command}"}
