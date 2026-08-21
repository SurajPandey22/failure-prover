import re
from typing import List
from .domain import FailureContext

class Parser:
    @staticmethod
    def parse(raw_log: str) -> FailureContext:
        failed_tests: List[str] = []
        stack_trace: List[str] = []
        failure_location = None
        failure_reason = None

        lines = raw_log.split('\n')
        in_failures = False

        for line in lines:
            if "=== FAILURES ===" in line:
                in_failures = True
                continue
            if "=== short test summary info ===" in line:
                in_failures = False
                continue

            if in_failures:
                # Capture test function headers
                match_fn = re.match(r'^_{3,}\s+(\w+)\s+_{3,}$', line.strip())
                if match_fn:
                    failed_tests.append(match_fn.group(1))

                # Capture stack trace locations like file.py:line
                match_loc = re.match(r'^([\w\/\.\-]+:\d+):?\s*(.*)$', line.strip())
                if match_loc and not failure_location:
                    failure_location = match_loc.group(1)

                # Capture Error lines like E   ValueError: ...
                if line.strip().startswith("E "):
                    failure_reason = line.strip()[2:].strip()

                stack_trace.append(line)

            # Fallback capture from short test summary
            if line.startswith("FAILED "):
                parts = line.split(" - ")
                if len(parts) > 0 and not failed_tests:
                    failed_tests.append(parts[0].replace("FAILED ", "").strip())
                if len(parts) > 1 and not failure_reason:
                    failure_reason = parts[1].strip()

        return FailureContext(
            raw_log=raw_log,
            failed_tests=failed_tests,
            failure_location=failure_location or "unknown:0",
            failure_reason=failure_reason or "Unknown test failure",
            stack_trace=stack_trace
        )
