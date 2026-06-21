from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI


ROOT = Path(__file__).parent
QUIT_COMMANDS = {"/q", "/quit", "exit", "quit"}


def load_instructions() -> str:
    instructions_path = ROOT / "instructions.txt"
    return instructions_path.read_text(encoding="utf-8").strip()


def require_api_key() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        print("Missing OPENAI_API_KEY. Add it to .env first.")
        sys.exit(1)


def stream_response(client: OpenAI, model: str, instructions: str, messages: list[dict[str, str]]) -> str:
    answer_parts: list[str] = []

    stream = client.responses.create(
        model=model,
        instructions=instructions,
        input=messages,
        stream=True,
    )

    for event in stream:
        if event.type == "response.output_text.delta":
            print(event.delta, end="", flush=True)
            answer_parts.append(event.delta)
        elif event.type == "error":
            raise RuntimeError(event.error.message)

    print()
    return "".join(answer_parts)


def main() -> None:
    load_dotenv(ROOT / ".env")
    require_api_key()

    client = OpenAI()
    model = os.getenv("OPENAI_MODEL", "gpt-5")
    instructions = load_instructions()
    messages: list[dict[str, str]] = []

    print("AI Assistant ready. Type /quit to leave.")

    while True:
        try:
            user_text = input("\nYou: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye.")
            break

        if not user_text:
            continue

        if user_text.lower() in QUIT_COMMANDS:
            print("Goodbye.")
            break

        messages.append({"role": "user", "content": user_text})
        print("Assistant: ", end="", flush=True)

        try:
            assistant_text = stream_response(client, model, instructions, messages)
        except Exception as exc:
            messages.pop()
            print(f"\nError: {exc}")
            continue

        messages.append({"role": "assistant", "content": assistant_text})


if __name__ == "__main__":
    main()

