from __future__ import annotations

from typing import Any

from flask import Flask, jsonify, request
import pyautogui
import time

from free_assistant import (
    MODEL,
    action_prompt,
    ask_ollama,
    build_messages,
    ensure_ollama,
    extract_json,
    look_at_screen,
    pull_model,
    screenshot_b64,
    web_search,
)


app = Flask(__name__)
history: list[dict[str, str]] = []
pending_action: dict[str, Any] | None = None
pending_task: str | None = None
stop_requested = False

BLOCKED_TERMS = {
    "password",
    "passcode",
    "login",
    "bank",
    "banking",
    "payment",
    "pay ",
    "purchase",
    "buy ",
    "delete",
    "remove files",
    "trash",
    "erase",
    "medical",
    "legal",
    "tax",
    "email",
    "message",
    "send ",
    "post ",
    "upload",
}

PATH_HINTS = {"/users/", "~/", "./", "../"}


HTML = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Local AI Assistant</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #f4f6f8;
      --panel: #ffffff;
      --panel-2: #eef2f5;
      --text: #151719;
      --muted: #66707a;
      --line: #d9dee3;
      --accent: #1463b8;
      --accent-text: #ffffff;
      --danger: #a93434;
      --ok: #19734d;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #101214;
        --panel: #181b1f;
        --panel-2: #20252b;
        --text: #f1f3f5;
        --muted: #9aa3ad;
        --line: #30363d;
        --accent: #5ba7f7;
        --accent-text: #08111c;
        --danger: #ff8b8b;
        --ok: #65c99a;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .app {
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 18px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }
    h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 650;
      letter-spacing: 0;
    }
    .status {
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }
    main {
      overflow: auto;
      padding: 18px;
    }
    .workspace {
      max-width: 1120px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 14px;
      align-items: start;
    }
    .messages {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
    }
    .message {
      width: min(760px, 100%);
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .user { align-self: flex-end; border-color: color-mix(in srgb, var(--accent), var(--line) 55%); }
    .assistant { align-self: flex-start; }
    .system { align-self: center; color: var(--muted); font-size: 13px; width: auto; }
    .side {
      position: sticky;
      top: 18px;
      display: grid;
      gap: 10px;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--panel);
      padding: 12px;
    }
    .panel h2 {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 700;
    }
    .answerPanel {
      border-color: color-mix(in srgb, var(--accent), var(--line) 50%);
    }
    .answerText {
      min-height: 120px;
      padding: 12px;
      border-radius: 8px;
      background: var(--panel-2);
      font-size: 16px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .panel p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
    }
    .actionBox {
      display: grid;
      gap: 8px;
    }
    .actionLine {
      padding: 8px 10px;
      border-radius: 8px;
      background: var(--panel-2);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .empty {
      color: var(--muted);
      font-size: 13px;
    }
    .composer {
      border-top: 1px solid var(--line);
      background: var(--panel);
      padding: 12px 18px 16px;
    }
    .controls, form {
      max-width: 1120px;
      margin: 0 auto;
    }
    .controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    button {
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      padding: 0 12px;
      font: inherit;
      cursor: pointer;
    }
    button.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: var(--accent-text);
      font-weight: 650;
    }
    button.danger { border-color: var(--danger); color: var(--danger); }
    button.ok { border-color: var(--ok); color: var(--ok); }
    button.warn { border-color: #a86800; color: #a86800; }
    button:disabled { opacity: 0.5; cursor: wait; }
    form {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
    }
    textarea {
      width: 100%;
      min-height: 46px;
      max-height: 180px;
      resize: vertical;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      background: var(--bg);
      color: var(--text);
      font: inherit;
      line-height: 1.4;
    }
    @media (max-width: 640px) {
      header { align-items: flex-start; flex-direction: column; }
      .workspace { grid-template-columns: 1fr; }
      .side { position: static; }
      form { grid-template-columns: 1fr; }
      .composer { padding: 10px; }
      main { padding: 10px; }
      button { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <h1>Local AI Assistant</h1>
      <div class="status" id="status">Ollama local mode</div>
    </header>
    <main id="scroll">
      <div class="workspace">
        <div class="messages" id="messages">
          <div class="message system">Type a message, use web search, or ask the assistant to look at your screen.</div>
        </div>
        <aside class="side">
          <section class="panel answerPanel">
            <h2>Answer</h2>
            <div class="answerText" id="answerText">Ask something and the answer will show here.</div>
          </section>
          <section class="panel">
            <h2>Screen Action</h2>
            <div class="actionBox" id="actionBox">
              <div class="empty">No pending action.</div>
            </div>
          </section>
          <section class="panel">
            <h2>Good Tasks</h2>
            <p>Try: open Calculator, open Spotlight, click a visible button, type into the focused app, or tell me what is on screen. Use plain words, not file paths, unless you really mean to work with files.</p>
          </section>
        </aside>
      </div>
    </main>
    <section class="composer">
      <div class="controls">
        <button type="button" id="look">Look At Screen</button>
        <button type="button" id="screen">Plan Screen Action</button>
        <button type="button" id="auto" class="warn">Auto Run</button>
        <button type="button" id="stop" class="danger" disabled>Stop</button>
        <button type="button" id="continue" class="ok" disabled>Continue Task</button>
        <button type="button" id="approve" class="primary" disabled>Approve Action</button>
        <button type="button" id="deny" class="danger" disabled>Deny Action</button>
      </div>
      <form id="form">
        <textarea id="input" placeholder="Ask anything. For current info, start with /web. For screen tasks, type the task and press Plan Screen Action."></textarea>
        <button class="primary" id="send">Send</button>
      </form>
    </section>
  </div>
  <script>
    const messages = document.getElementById("messages");
    const scrollBox = document.getElementById("scroll");
    const input = document.getElementById("input");
    const status = document.getElementById("status");
    const approve = document.getElementById("approve");
    const deny = document.getElementById("deny");
    const continueButton = document.getElementById("continue");
    const autoButton = document.getElementById("auto");
    const stopButton = document.getElementById("stop");
    const actionBox = document.getElementById("actionBox");
    const answerText = document.getElementById("answerText");
    let busy = false;
    let hasPendingAction = false;
    let hasScreenTask = false;

    function addMessage(role, text) {
      const node = document.createElement("div");
      node.className = `message ${role}`;
      node.textContent = text;
      messages.appendChild(node);
      if (role === "assistant") {
        answerText.textContent = text;
      }
      scrollBox.scrollTop = scrollBox.scrollHeight;
    }

    function setBusy(value, label = "Ollama local mode") {
      busy = value;
      status.textContent = value ? label : "Ollama local mode";
      document.querySelectorAll("button, textarea").forEach((el) => {
        if (el.id === "approve" || el.id === "deny") return;
        if (el.id === "continue") return;
        if (el.id === "stop") return;
        el.disabled = value;
      });
      continueButton.disabled = !hasScreenTask || hasPendingAction || value;
      stopButton.disabled = !value;
    }

    function setPending(value) {
      hasPendingAction = value;
      approve.disabled = !value;
      deny.disabled = !value;
      continueButton.disabled = !hasScreenTask || value || busy;
    }

    function setScreenTask(value) {
      hasScreenTask = value;
      continueButton.disabled = !value || hasPendingAction || busy;
    }

    function renderAction(action, reason) {
      if (!action) {
        actionBox.innerHTML = '<div class="empty">No pending action.</div>';
        return;
      }
      const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[char]));
      actionBox.innerHTML = `
        <div class="actionLine"><strong>Action:</strong> ${safe(action.action)}</div>
        <div class="actionLine"><strong>Details:</strong> ${safe(JSON.stringify(action))}</div>
        <div class="actionLine"><strong>Reason:</strong> ${safe(reason || "No reason provided.")}</div>
      `;
    }

    async function callApi(path, body = {}) {
      const response = await fetch(path, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      return data;
    }

    document.getElementById("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || busy) return;
      input.value = "";
      addMessage("user", text);
      setBusy(true, "Thinking");
      try {
        const data = await callApi("/api/chat", {message: text});
        addMessage("assistant", data.reply);
      } catch (error) {
        addMessage("system", error.message);
      } finally {
        setBusy(false);
      }
    });

    document.getElementById("look").addEventListener("click", async () => {
      setBusy(true, "Looking at screen");
      try {
        const data = await callApi("/api/look");
        addMessage("assistant", data.reply);
        answerText.textContent = data.reply;
      } catch (error) {
        addMessage("system", error.message);
      } finally {
        setBusy(false);
      }
    });

    document.getElementById("screen").addEventListener("click", async () => {
      const task = input.value.trim();
      if (!task) {
        addMessage("system", "Type the screen task first, then press Plan Screen Action.");
        return;
      }
      addMessage("user", `Screen task: ${task}`);
      setBusy(true, "Planning screen action");
      try {
        const data = await callApi("/api/plan-screen", {task});
        addMessage("assistant", data.reply);
        answerText.textContent = data.reply;
        setPending(data.pending);
        setScreenTask(true);
        renderAction(data.action, data.reason);
      } catch (error) {
        addMessage("system", error.message);
      } finally {
        setBusy(false);
      }
    });

    approve.addEventListener("click", async () => {
      if (!hasPendingAction) return;
      setBusy(true, "Running approved action");
      try {
        const data = await callApi("/api/approve");
        addMessage("assistant", data.reply);
        answerText.textContent = data.reply;
        setPending(false);
        renderAction(null);
        setScreenTask(data.canContinue);
      } catch (error) {
        addMessage("system", error.message);
      } finally {
        setBusy(false);
      }
    });

    deny.addEventListener("click", async () => {
      try {
        const data = await callApi("/api/deny");
        addMessage("system", data.reply);
      } finally {
        setPending(false);
        renderAction(null);
        setScreenTask(false);
      }
    });

    continueButton.addEventListener("click", async () => {
      if (!hasScreenTask || hasPendingAction) return;
      setBusy(true, "Planning next action");
      try {
        const data = await callApi("/api/continue-screen");
        addMessage("assistant", data.reply);
        answerText.textContent = data.reply;
        setPending(data.pending);
        setScreenTask(data.canContinue);
        renderAction(data.action, data.reason);
      } catch (error) {
        addMessage("system", error.message);
      } finally {
        setBusy(false);
      }
    });

    autoButton.addEventListener("click", async () => {
      const task = input.value.trim();
      if (!task) {
        addMessage("system", "Type the computer-control task first, then press Auto Run.");
        return;
      }
      addMessage("user", `Auto task: ${task}`);
      setPending(false);
      renderAction(null);
      setBusy(true, "Auto running");
      try {
        const data = await callApi("/api/auto-screen", {task});
        addMessage("assistant", data.reply);
        answerText.textContent = data.reply;
        setScreenTask(false);
      } catch (error) {
        addMessage("system", error.message);
      } finally {
        setBusy(false);
      }
    });

    stopButton.addEventListener("click", async () => {
      try {
        await callApi("/api/stop");
        addMessage("system", "Stop requested.");
      } catch (error) {
        addMessage("system", error.message);
      }
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        document.getElementById("form").requestSubmit();
      }
    });
  </script>
</body>
</html>
"""


@app.get("/")
def index() -> str:
    return HTML


@app.post("/api/chat")
def chat() -> Any:
    global history
    message = (request.json or {}).get("message", "").strip()
    if not message:
        return jsonify(error="Message is empty."), 400

    if message.lower().startswith("/web "):
        query = message[5:].strip()
        results = web_search(query)
        message_for_model = f"Answer using these web results. Cite URLs.\n\nQuestion: {query}\n\n{results}"
        messages = build_messages(history, message_for_model)
    else:
        messages = build_messages(history, message)

    reply = ask_ollama(messages)
    history.append({"role": "user", "content": message})
    history.append({"role": "assistant", "content": reply})
    history = history[-12:]
    return jsonify(reply=reply)


@app.post("/api/look")
def look() -> Any:
    try:
        return jsonify(reply=look_at_screen())
    except Exception as exc:
        return jsonify(error=str(exc)), 500


def plan_screen_action(task: str) -> tuple[dict[str, Any] | None, str | None]:
    raw = ask_ollama(
        [{"role": "user", "content": action_prompt(task), "images": [screenshot_b64()]}],
        model="moondream",
    )
    return extract_json(raw), raw


def action_reply(action: dict[str, Any], prefix: str = "Proposed action") -> dict[str, Any]:
    reason = action.get("reason", "")
    action_type = action.get("action", "unknown")
    if action_type == "click":
        summary = f"{prefix}: click at ({action.get('x')}, {action.get('y')})"
    elif action_type == "type":
        summary = f"{prefix}: type {str(action.get('text', ''))[:80]!r}"
    elif action_type == "press":
        summary = f"{prefix}: press {' + '.join(action.get('keys', []))}"
    elif action_type == "answer":
        summary = str(action.get("text", ""))
    else:
        summary = f"{prefix}: {action_type}"

    if reason and action_type != "answer":
        summary = f"{summary}\n\nReason: {reason}"

    return {
        "reply": summary,
        "pending": action_type != "answer",
        "action": action if action_type != "answer" else None,
        "reason": reason,
        "canContinue": pending_task is not None and action_type != "answer",
    }


def blocked_reason(text: str) -> str | None:
    lowered = f" {text.lower()} "
    for term in BLOCKED_TERMS:
        if term in lowered:
            return f"Auto Run is blocked for tasks involving {term.strip()!r}."
    return None


def path_warning(text: str) -> str | None:
    lowered = text.lower()
    if any(hint in lowered for hint in PATH_HINTS):
        return (
            "That looks like a filesystem path. If you are trying to control the screen, "
            "use plain words like 'open a new tab' or 'open Calculator'."
        )
    return None


def action_summary(action: dict[str, Any]) -> str:
    action_type = action.get("action")
    if action_type == "click":
        return f"click ({action.get('x')}, {action.get('y')})"
    if action_type == "type":
        return f"type {str(action.get('text', ''))[:60]!r}"
    if action_type == "press":
        return f"press {' + '.join(action.get('keys', []))}"
    if action_type == "wait":
        return "wait"
    if action_type == "answer":
        return f"answer: {str(action.get('text', ''))[:120]}"
    return str(action)


@app.post("/api/plan-screen")
def plan_screen() -> Any:
    global pending_action
    global pending_task
    task = (request.json or {}).get("task", "").strip()
    if not task:
        return jsonify(error="Screen task is empty."), 400
    warning = path_warning(task)
    if warning:
        return jsonify(error=warning), 400

    try:
        action, raw = plan_screen_action(task)
    except Exception as exc:
        return jsonify(error=str(exc)), 500

    if action is None:
        return jsonify(
            reply=f"I could not turn that into a safe action. The model said:\n{raw}",
            pending=False,
            action=None,
            reason="",
            canContinue=False,
        )

    pending_task = task
    pending_action = action if action.get("action") != "answer" else None
    return jsonify(**action_reply(action))


@app.post("/api/auto-screen")
def auto_screen() -> Any:
    global pending_action
    global pending_task
    global stop_requested

    task = (request.json or {}).get("task", "").strip()
    if not task:
        return jsonify(error="Auto task is empty."), 400
    warning = path_warning(task)
    if warning:
        return jsonify(error=warning), 400

    reason = blocked_reason(task)
    if reason:
        return jsonify(error=f"{reason} Use Plan Screen Action and approve each step manually."), 400

    pending_action = None
    pending_task = None
    stop_requested = False
    logs: list[str] = []

    for step in range(6):
        if stop_requested:
            logs.append("Stopped by user.")
            break

        try:
            action, raw = plan_screen_action(task)
        except Exception as exc:
            return jsonify(error=str(exc)), 500

        if action is None:
            logs.append(f"Step {step + 1}: could not parse next action. Model said: {raw}")
            break

        action_reason = blocked_reason(json.dumps(action))
        if action_reason:
            logs.append(f"Step {step + 1}: blocked. {action_reason}")
            break

        logs.append(f"Step {step + 1}: {action_summary(action)}")

        if action.get("action") == "answer":
            break

        try:
            run_approved_action(action)
        except Exception as exc:
            logs.append(f"Step {step + 1} failed: {exc}")
            break

        time.sleep(0.8)

    if not logs:
        logs.append("No action was taken.")

    return jsonify(reply="Auto Run finished.\n\n" + "\n".join(logs))


@app.post("/api/stop")
def stop_auto() -> Any:
    global stop_requested
    stop_requested = True
    return jsonify(reply="Stop requested.")


@app.post("/api/continue-screen")
def continue_screen() -> Any:
    global pending_action
    if pending_task is None:
        return jsonify(error="There is no screen task to continue."), 400
    if pending_action is not None:
        return jsonify(error="Approve or deny the current action first."), 400

    try:
        action, raw = plan_screen_action(pending_task)
    except Exception as exc:
        return jsonify(error=str(exc)), 500

    if action is None:
        return jsonify(
            reply=f"I could not turn the next step into a safe action. The model said:\n{raw}",
            pending=False,
            action=None,
            reason="",
            canContinue=True,
        )

    pending_action = action if action.get("action") != "answer" else None
    return jsonify(**action_reply(action, prefix="Next action"))


@app.post("/api/approve")
def approve_action() -> Any:
    global pending_action
    if pending_action is None:
        return jsonify(error="There is no pending action."), 400

    action = pending_action
    pending_action = None
    try:
        run_approved_action(action)
    except Exception as exc:
        return jsonify(error=str(exc)), 500
    return jsonify(reply=f"Approved and ran: {action.get('action')}", canContinue=pending_task is not None)


@app.post("/api/deny")
def deny_action() -> Any:
    global pending_action
    global pending_task
    pending_action = None
    pending_task = None
    return jsonify(reply="Denied. No action was taken.")


def run_approved_action(action: dict[str, Any]) -> None:
    action_type = action.get("action")
    if action_type == "answer":
        return
    if action_type == "wait":
        import time

        time.sleep(1)
        return
    if action_type == "click":
        pyautogui.click(int(action.get("x", 0)), int(action.get("y", 0)))
        return
    if action_type == "type":
        pyautogui.write(str(action.get("text", "")), interval=0.01)
        return
    if action_type == "press":
        keys = [str(key).lower() for key in action.get("keys", [])]
        if len(keys) == 1:
            pyautogui.press(keys[0])
        elif keys:
            pyautogui.hotkey(*keys)
        return
    raise ValueError(f"Unsupported action: {action}")


def main() -> None:
    ensure_ollama()
    pull_model(MODEL)
    pull_model("moondream")
    app.run(host="127.0.0.1", port=8765, debug=False)


if __name__ == "__main__":
    main()
