from __future__ import annotations

import base64
import io
import os
import sys
import time
from pathlib import Path
from typing import Any

import pyautogui
from dotenv import load_dotenv
from openai import OpenAI
from PIL import Image


ROOT = Path(__file__).parent
QUIT_COMMANDS = {"/q", "/quit", "exit", "quit"}


def require_api_key() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        print("Missing OPENAI_API_KEY. Add it to .env first.")
        sys.exit(1)


def screen_size() -> tuple[int, int]:
    size = pyautogui.size()
    return int(size.width), int(size.height)


def screenshot_base64() -> str:
    shot = pyautogui.screenshot()
    if not isinstance(shot, Image.Image):
        shot = Image.frombytes("RGB", shot.size, shot.tobytes())

    buffer = io.BytesIO()
    shot.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def action_field(action: Any, name: str, default: Any = None) -> Any:
    if isinstance(action, dict):
        return action.get(name, default)
    return getattr(action, name, default)


def describe_action(action: Any) -> str:
    action_type = action_field(action, "type", "unknown")

    if action_type in {"click", "double_click"}:
        return f"{action_type} at ({action_field(action, 'x')}, {action_field(action, 'y')})"
    if action_type == "scroll":
        return (
            f"scroll at ({action_field(action, 'x')}, {action_field(action, 'y')}) "
            f"by ({action_field(action, 'scroll_x', 0)}, {action_field(action, 'scroll_y', 0)})"
        )
    if action_type == "type":
        text = str(action_field(action, "text", ""))
        preview = text if len(text) <= 80 else f"{text[:77]}..."
        return f"type {preview!r}"
    if action_type == "keypress":
        return f"press {action_field(action, 'keys', [])}"
    if action_type == "drag":
        return f"drag through {action_field(action, 'path', [])}"
    return action_type


def confirm_action(action: Any, safety_checks: list[Any]) -> bool:
    if safety_checks:
        print("\nSafety checks from the API:")
        for check in safety_checks:
            code = action_field(check, "code", "unknown")
            message = action_field(check, "message", "")
            print(f"- {code}: {message}")

    print(f"\nProposed action: {describe_action(action)}")
    answer = input("Do it? [y/N] ").strip().lower()
    return answer in {"y", "yes"}


def execute_action(action: Any) -> None:
    action_type = action_field(action, "type")
    held_keys = [normalize_key(key) for key in action_field(action, "keys", [])]

    for key in held_keys:
        pyautogui.keyDown(key)

    try:
        if action_type == "click":
            pyautogui.click(
                int(action_field(action, "x", 0)),
                int(action_field(action, "y", 0)),
                button=action_field(action, "button", "left"),
            )
        elif action_type == "double_click":
            pyautogui.doubleClick(int(action_field(action, "x", 0)), int(action_field(action, "y", 0)))
        elif action_type == "move":
            pyautogui.moveTo(int(action_field(action, "x", 0)), int(action_field(action, "y", 0)))
        elif action_type == "scroll":
            pyautogui.moveTo(int(action_field(action, "x", 0)), int(action_field(action, "y", 0)))
            scroll_y = action_field(action, "scroll_y", action_field(action, "scrollY", 0))
            pyautogui.scroll(-int(scroll_y))
        elif action_type == "type":
            pyautogui.write(str(action_field(action, "text", "")), interval=0.01)
        elif action_type == "keypress":
            for key in action_field(action, "keys", []):
                pyautogui.press(normalize_key(key))
        elif action_type == "drag":
            path = normalize_drag_path(action_field(action, "path", []))
            if path:
                pyautogui.moveTo(path[0][0], path[0][1])
                pyautogui.mouseDown()
                for x, y in path[1:]:
                    pyautogui.moveTo(x, y, duration=0.15)
                pyautogui.mouseUp()
        elif action_type in {"wait", "screenshot"}:
            time.sleep(1)
        else:
            raise ValueError(f"Unsupported action type: {action_type}")
    finally:
        for key in reversed(held_keys):
            pyautogui.keyUp(key)


def normalize_key(key: Any) -> str:
    key_map = {
        "ENTER": "enter",
        "RETURN": "enter",
        "ESC": "escape",
        "ESCAPE": "escape",
        "TAB": "tab",
        "SPACE": "space",
        "BACKSPACE": "backspace",
        "DELETE": "delete",
        "DEL": "delete",
        "HOME": "home",
        "END": "end",
        "PAGEUP": "pageup",
        "PAGEDOWN": "pagedown",
        "UP": "up",
        "DOWN": "down",
        "LEFT": "left",
        "RIGHT": "right",
        "ARROWUP": "up",
        "ARROWDOWN": "down",
        "ARROWLEFT": "left",
        "ARROWRIGHT": "right",
        "CTRL": "ctrl",
        "CONTROL": "ctrl",
        "SHIFT": "shift",
        "OPTION": "alt",
        "ALT": "alt",
        "META": "command",
        "CMD": "command",
        "COMMAND": "command",
    }
    return key_map.get(str(key).upper(), str(key).lower())


def normalize_drag_path(path: Any) -> list[tuple[int, int]]:
    normalized: list[tuple[int, int]] = []
    for point in path or []:
        if isinstance(point, (list, tuple)) and len(point) >= 2:
            normalized.append((int(point[0]), int(point[1])))
        else:
            normalized.append((int(action_field(point, "x", 0)), int(action_field(point, "y", 0))))
    return normalized


def print_text_output(response: Any) -> None:
    for item in response.output:
        if item.type == "message":
            for content in item.content:
                if content.type == "output_text":
                    print(f"\nAssistant: {content.text}")


def computer_calls(response: Any) -> list[Any]:
    return [item for item in response.output if item.type == "computer_call"]


def actions_from_call(call: Any) -> list[Any]:
    actions = action_field(call, "actions", None)
    if actions is not None:
        return list(actions)
    action = action_field(call, "action", None)
    return [action] if action is not None else []


def acknowledged_checks(call: Any) -> list[dict[str, str]]:
    checks = action_field(call, "pending_safety_checks", []) or []
    return [
        {
            "id": action_field(check, "id", ""),
            "code": action_field(check, "code", ""),
            "message": action_field(check, "message", ""),
        }
        for check in checks
    ]


def run_task(client: OpenAI, model: str, task: str) -> None:
    width, height = screen_size()
    tools = [{"type": "computer"}]

    response = client.responses.create(
        model=model,
        tools=tools,
        input=(
            "You are controlling my local Mac through screenshots and UI actions. "
            f"The screen is {width} by {height}. "
            "Use the computer tool for UI interaction. Do not handle passwords, payments, "
            "account permissions, deleting files, medical/legal/financial tasks, or messages "
            f"to other people. My task: {task}"
        ),
    )

    for _ in range(30):
        calls = computer_calls(response)
        if not calls:
            print_text_output(response)
            return

        call = calls[0]
        safety_checks = action_field(call, "pending_safety_checks", []) or []

        for action in actions_from_call(call):
            if not confirm_action(action, safety_checks):
                print("Stopped before taking that action.")
                return

            execute_action(action)
        time.sleep(1)

        output_item = {
            "type": "computer_call_output",
            "call_id": call.call_id,
            "output": {
                "type": "computer_screenshot",
                "image_url": f"data:image/png;base64,{screenshot_base64()}",
                "detail": "original",
            },
        }
        checks = acknowledged_checks(call)
        if checks:
            output_item["acknowledged_safety_checks"] = checks

        response = client.responses.create(
            model=model,
            previous_response_id=response.id,
            tools=tools,
            input=[output_item],
        )

    print("Stopped after 30 actions. Start a new task if you want to continue.")


def main() -> None:
    load_dotenv(ROOT / ".env")
    require_api_key()
    pyautogui.FAILSAFE = True

    client = OpenAI()
    model = os.getenv("OPENAI_COMPUTER_MODEL", "gpt-5.5")

    print("Desktop AI Assistant ready.")
    print("It can see screenshots and ask before clicking, typing, scrolling, or pressing keys.")
    print("Move the mouse to the top-left corner to emergency-stop pyautogui.")

    while True:
        task = input("\nTask (/quit to leave): ").strip()
        if not task:
            continue
        if task.lower() in QUIT_COMMANDS:
            print("Goodbye.")
            break
        run_task(client, model, task)


if __name__ == "__main__":
    main()
