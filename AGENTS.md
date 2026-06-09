# Codex Project Notes

This repository is the "Novel Sandbox" interactive fiction tool. It has two supported runtime paths:

- Claude Code mode: Vite bridge plus `scripts/claude-worker.js`.
- Codex mode: Vite bridge plus `scripts/codex-worker.js`.

Do not change shared bridge request or response shapes in a way that breaks either mode. The browser sends requests through `/api/bridge/pending` and polls `/api/bridge/queue`; workers push JSON responses back through the same queue contract.

## When the user asks to use the novel tool

If the user says something like "使用小說工具", "開啟小說工具", or "讓我試用小說工具", start the Codex-ready environment:

Preferred cold-start path:

1. From `/Users/wujingfu/Downloads/novel-sandbox`, run:
   `./start-codex.sh`
2. Use the URL printed by the script. It is usually:
   `http://127.0.0.1:3000/novel-sandbox/`
   but may differ if another service already owns port 3000.
3. Tell the user to choose engine `Codex` on the setup page and press `開幕`.

The launcher is designed for the user's normal workflow: they open Codex after a fresh computer session and ask to start the tool. It stops stale Novel Sandbox Vite/worker/Codex child processes for this project, clears `/tmp/novel-sandbox-pending.json` and `/tmp/novel-sandbox-queue.json`, starts one Vite bridge and one Codex worker, prints the actual URL, and monitors both processes.

Fallback manual path:

1. From `/Users/wujingfu/Downloads/novel-sandbox`, run the Vite bridge server:
   `NOVEL_SANDBOX_ENGINE=local npm run dev -- --host 127.0.0.1`
2. Start the Codex worker with a longer timeout and enough permissions for `codex exec` to access `~/.codex/sessions`:
   `NOVEL_SANDBOX_CODEX_TIMEOUT_MS=120000 npm run codex-worker`
3. Give the user the actual Vite URL from the terminal, commonly:
   `http://127.0.0.1:3000/novel-sandbox/`
4. Tell the user to choose engine `Codex` on the setup page and press `開幕`.

In the Codex desktop sandbox, `./start-codex.sh` or the worker may still need escalation because the worker calls `codex exec`.

## Runtime notes

- Codex worker must usually run outside the restricted sandbox. If it fails with permission errors for `/Users/wujingfu/.codex/sessions`, restart it with escalated permissions.
- Use `NOVEL_SANDBOX_CODEX_TIMEOUT_MS=120000` or higher. The default 30 seconds can be too short for `codex exec`.
- Keep Claude Code mode available. If you change startup scripts or bridge APIs, verify `npm run claude-worker` still has a compatible path.
- Local mode is only for UI flow testing; it should remain selectable and should not require external AI workers.
