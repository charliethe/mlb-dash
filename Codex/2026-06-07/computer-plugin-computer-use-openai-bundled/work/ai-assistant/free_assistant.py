from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from base64 import b64encode
from io import BytesIO
from pathlib import Path
from typing import Any

import pyautogui
from PIL import Image


ROOT = Path(__file__).parent
OLLAMA_URL = "http://127.0.0.1:11434/api/chat"
MODEL = "llama3.2:3b"
VISION_MODEL = "moondream"
QUIT_COMMANDS = {"/q", "/quit", "exit", "quit"}


def ensure_ollama() -> None:
    try:
        get_json("http://127.0.0.1:11434/api/tags")
        return
    except Exception:
        pass

    print("Starting Ollama...")
    subprocess.run(["open", "-a", "Ollama"], check=False)
    for _ in range(20):
        try:
            get_json("http://127.0.0.1:11434/api/tags")
            return
        except Exception:
            time.sleep(0.5)

    print("Ollama is not responding yet. Open Terminal and run: ollama serve")
    sys.exit(1)


def request_json(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def model_available(model_name: str) -> bool:
    try:
        data = get_json("http://127.0.0.1:11434/api/tags")
        names = {model.get("name") for model in data.get("models", [])}
        return model_name in names or f"{model_name}:latest" in names
    except Exception:
        return False


def pull_model(model_name: str) -> None:
    if model_available(model_name):
        return
    print(f"Downloading free local model {model_name}. This can take a few minutes...")
    subprocess.run(["ollama", "pull", model_name], check=True)


def web_search(query: str) -> str:
    try:
        from ddgs import DDGS
    except ImportError:
        return "Web search package is not installed yet. Run: .venv/bin/pip install -r requirements.txt"

    results = []
    with DDGS() as ddgs:
        for result in ddgs.text(query, max_results=5):
            title = result.get("title", "")
            url = result.get("href", "")
            body = result.get("body", "")
            results.append(f"- {title}\n  {url}\n  {body}")

    return "\n".join(results) if results else "No web results found."


def ask_ollama(messages: list[dict[str, Any]], model: str = MODEL) -> str:
    payload = {"model": model, "messages": messages, "stream": False}
    try:
        data = request_json(OLLAMA_URL, payload)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(exc.read().decode("utf-8", errors="ignore")) from exc
    return data.get("message", {}).get("content", "").strip()


def screenshot_image() -> Image.Image:
    try:
        shot = pyautogui.screenshot()
        if isinstance(shot, Image.Image):
            return shot
        return Image.frombytes("RGB", shot.size, shot.tobytes())
    except Exception as exc:
        raise RuntimeError(
            "macOS blocked screen capture. Open System Settings -> Privacy & Security -> "
            "Screen Recording, enable Terminal, then restart Terminal and run the assistant again."
        ) from exc


def screenshot_b64(max_width: int = 1280) -> str:
    shot = screenshot_image()
    if shot.width > max_width:
        height = int(shot.height * (max_width / shot.width))
        shot = shot.resize((max_width, height))
    buffer = BytesIO()
    shot.save(buffer, format="PNG")
    return b64encode(buffer.getvalue()).decode("utf-8")


def screen_size() -> tuple[int, int]:
    size = pyautogui.size()
    return int(size.width), int(size.height)


def look_at_screen(prompt: str = "Describe what is visible on this Mac screen.") -> str:
    pull_model(VISION_MODEL)
    message = {
        "role": "user",
        "content": prompt,
        "images": [screenshot_b64()],
    }
    return ask_ollama([message], model=VISION_MODEL)


def confirm(text: str) -> bool:
    answer = input(f"{text} [y/N] ").strip().lower()
    return answer in {"y", "yes"}


def do_click(args: str) -> None:
    parts = args.split()
    if len(parts) < 2:
        print("Usage: /click X Y")
        return
    x, y = int(float(parts[0])), int(float(parts[1]))
    if confirm(f"Click at ({x}, {y})?"):
        try:
            pyautogui.click(x, y)
            print("Clicked.")
        except Exception as exc:
            print(f"Click failed: {desktop_permission_help()}")
    else:
        print("Cancelled.")


def do_type(text: str) -> None:
    if not text:
        print("Usage: /type TEXT")
        return
    if confirm(f"Type {text!r}?"):
        try:
            pyautogui.write(text, interval=0.01)
            print("Typed.")
        except Exception:
            print(f"Typing failed: {desktop_permission_help()}")
    else:
        print("Cancelled.")


def do_press(keys_text: str) -> None:
    keys = [key.strip().lower() for key in keys_text.replace("+", " ").split() if key.strip()]
    if not keys:
        print("Usage: /press KEY or /press command space")
        return
    if confirm(f"Press {' + '.join(keys)}?"):
        try:
            if len(keys) == 1:
                pyautogui.press(keys[0])
            else:
                pyautogui.hotkey(*keys)
            print("Pressed.")
        except Exception:
            print(f"Key press failed: {desktop_permission_help()}")
    else:
        print("Cancelled.")


def desktop_permission_help() -> str:
    return (
        "Open System Settings -> Privacy & Security -> Accessibility, enable Terminal, "
        "then restart Terminal and run the assistant again."
    )


def action_prompt(task: str) -> str:
    width, height = screen_size()
    return (
        f"You are helping control a Mac screen. The full screen is {width}x{height}. "
        "Look at the screenshot and choose exactly one next safe action for this task. "
        "Return only JSON, no markdown. Valid actions:\n"
        '{"action":"click","x":123,"y":456,"reason":"why"}\n'
        '{"action":"type","text":"hello","reason":"why"}\n'
        '{"action":"press","keys":["command","space"],"reason":"why"}\n'
        '{"action":"wait","reason":"why"}\n'
        '{"action":"answer","text":"what to tell the user","reason":"why"}\n'
        "Do not handle passwords, payments, banking, medical/legal/financial tasks, deleting files, "
        "or messages to other people. If the task is unsafe or unclear, use answer. "
        f"Task: {task}"
    )


def extract_json(text: str) -> dict[str, Any] | None:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None


def describe_action(action: dict[str, Any]) -> str:
    action_type = action.get("action")
    if action_type == "click":
        return f"click at ({action.get('x')}, {action.get('y')})"
    if action_type == "type":
        text = str(action.get("text", ""))
        return f"type {text[:80]!r}"
    if action_type == "press":
        return f"press {' + '.join(action.get('keys', []))}"
    return str(action_type)


def execute_model_action(action: dict[str, Any]) -> bool:
    action_type = action.get("action")
    reason = action.get("reason")
    if reason:
        print(f"Reason: {reason}")

    if action_type == "answer":
        print(f"Assistant: {action.get('text', '')}")
        return False
    if action_type == "wait":
        if confirm("Wait one second?"):
            time.sleep(1)
            return True
        return False
    if action_type == "click":
        x, y = int(action.get("x", 0)), int(action.get("y", 0))
        if confirm(f"Proposed action: click at ({x}, {y}). Do it?"):
            try:
                pyautogui.click(x, y)
            except Exception:
                print(f"Click failed: {desktop_permission_help()}")
                return False
            return True
        return False
    if action_type == "type":
        text = str(action.get("text", ""))
        if confirm(f"Proposed action: type {text!r}. Do it?"):
            try:
                pyautogui.write(text, interval=0.01)
            except Exception:
                print(f"Typing failed: {desktop_permission_help()}")
                return False
            return True
        return False
    if action_type == "press":
        keys = [str(key).lower() for key in action.get("keys", [])]
        if confirm(f"Proposed action: press {' + '.join(keys)}. Do it?"):
            try:
                if len(keys) == 1:
                    pyautogui.press(keys[0])
                else:
                    pyautogui.hotkey(*keys)
            except Exception:
                print(f"Key press failed: {desktop_permission_help()}")
                return False
            return True
        return False

    print(f"Unsupported proposed action: {action}")
    return False


def run_screen_task(task: str) -> None:
    pull_model(VISION_MODEL)
    print("Screen-control mode. I will ask before every action.")
    print("Move the mouse to the top-left corner to emergency-stop pyautogui.")
    for step in range(8):
        raw = ask_ollama(
            [{"role": "user", "content": action_prompt(task), "images": [screenshot_b64()]}],
            model=VISION_MODEL,
        )
        action = extract_json(raw)
        if action is None:
            print(f"Could not parse an action. Model said:\n{raw}")
            return

        print(f"\nStep {step + 1}: {describe_action(action)}")
        should_continue = execute_model_action(action)
        if not should_continue:
            return
        time.sleep(0.5)
    print("Stopped after 8 approved actions. Run /screen again to continue.")


def build_messages(history: list[dict[str, str]], user_text: str) -> list[dict[str, str]]:
    system = (
        "You are a helpful local AI assistant running for free on the user's Mac. "
        "Be clear and practical. If web search results are provided, use them and cite URLs."
    )

    if user_text.lower().startswith("/web "):
        query = user_text[5:].strip()
        results = web_search(query)
        user_text = f"Answer this using the web results below.\n\nQuestion: {query}\n\nWeb results:\n{results}"

    return [{"role": "system", "content": system}, *history, {"role": "user", "content": user_text}]


def main() -> None:
    ensure_ollama()
    pull_model(MODEL)
    pyautogui.FAILSAFE = True

    print("Free local AI Assistant ready.")
    print("Type normally for local chat. Use /web QUESTION for web search.")
    print("Desktop commands: /look, /screen TASK, /click X Y, /type TEXT, /press KEY.")
    print("Use /quit to exit.")

    history: list[dict[str, str]] = []
    while True:
        user_text = input("\nYou: ").strip()
        if not user_text:
            continue
        if user_text.lower() in QUIT_COMMANDS:
            print("Goodbye.")
            break
        if user_text.lower() == "/look":
            try:
                print(f"\nAssistant: {look_at_screen()}")
            except Exception as exc:
                print(f"\nScreen error: {exc}")
            continue
        if user_text.lower().startswith("/screen "):
            task = user_text[len("/screen ") :].strip()
            if task:
                try:
                    run_screen_task(task)
                except Exception as exc:
                    print(f"\nScreen-control error: {exc}")
            continue
        if user_text.lower().startswith("/click "):
            do_click(user_text[len("/click ") :].strip())
            continue
        if user_text.lower().startswith("/type "):
            do_type(user_text[len("/type ") :])
            continue
        if user_text.lower().startswith("/press "):
            do_press(user_text[len("/press ") :])
            continue

        messages = build_messages(history, user_text)
        try:
            answer = ask_ollama(messages)
        except Exception as exc:
            print(f"\nError: {exc}")
            continue

        print(f"\nAssistant: {answer}")
        history.append({"role": "user", "content": user_text})
        history.append({"role": "assistant", "content": answer})
        history = history[-12:]


if __name__ == "__main__":
    main()
