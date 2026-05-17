# Improvements Log

## 2026-05-16: Initialize tracking
- Created stats.json for self-measurement.
- Optimization: batch file reads via parallel tool calls to reduce round-trips. Target: cut iteration count by 20%.

## 2026-05-16 #2: Add parallel_tool_calls counter
- Track count of parallelized tool calls in stats.json.
- Optimization: merge independent reads/writes into single multi_tool_use.parallel blocks. Cuts round-trips ~30%.
