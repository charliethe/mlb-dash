from __future__ import annotations

import os
import sys
from getpass import getpass
from pathlib import Path

from dotenv import load_dotenv, set_key
from openai import RateLimitError
from openai import OpenAI

from desktop_agent import run_task as run_desktop_task


ROOT = Path(__file__).parent
QUIT_COMMANDS = {"/q", "/quit", "exit", "quit"}


def load_instructions() -> str:
    return (ROOT / "instructions.txt").read_text(encoding="utf-8").strip()


def require_api_key() -> None:
    if not os.getenv("OPENAI_API_KEY"):
        api_key = getpass("Paste your OpenAI API key: ").strip()
        if not api_key:
            print("No API key entered. Exiting.")
            sys.exit(1)

        os.environ["OPENAI_API_KEY"] = api_key
        save_key = input("Save this key to .env for next time? [y/N] ").strip().lower()
        if save_key in {"y", "yes"}:
            set_key(str(ROOT / ".env"), "OPENAI_API_KEY", api_key)


def print_help() -> None:
    print(
        """
Commands:
  /screen TASK  Let the assistant see your screen and ask before controlling it.
  /chat TASK    Ask a normal question with web search available.
  /help         Show this help.
  /quit         Exit.

Examples:
  What's the latest news about OpenAI?
  /screen Open Notes and create a note called Grocery List.
""".strip()
    )


def chat_response(
    client: OpenAI,
    model: str,
    instructions: str,
    user_text: str,
    previous_response_id: str | None,
) -> str | None:
    response = client.responses.create(
        model=model,
        instructions=(
            f"{instructions}\n\n"
            "Use web search when the user asks about current events, recent facts, prices, "
            "recommendations, schedules, laws, or anything that could have changed. "
            "When web search is used, include source links in the answer."
        ),
        tools=[{"type": "web_search"}],
        previous_response_id=previous_response_id,
        input=user_text,
    )

    print(f"\nAssistant: {response.output_text}")
    return response.id


def main() -> None:
    load_dotenv(ROOT / ".env")
    require_api_key()

    client = OpenAI()
    chat_model = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")
    computer_model = os.getenv("OPENAI_COMPUTER_MODEL", "gpt-5.4-mini")
    instructions = load_instructions()
    previous_response_id: str | None = None

    print("Unified AI Assistant ready.")
    print("Normal messages can use web search. Start with /screen to let it see and control your screen.")
    print_help()

    while True:
        user_text = input("\nYou: ").strip()
        if not user_text:
            continue

        lowered = user_text.lower()
        if lowered in QUIT_COMMANDS:
            print("Goodbye.")
            break
        if lowered == "/help":
            print_help()
            continue

        if lowered.startswith("/screen "):
            task = user_text[len("/screen ") :].strip()
            if task:
                try:
                    run_desktop_task(client, computer_model, task)
                except RateLimitError:
                    print(
                        "\nYour OpenAI API account has no usable quota right now. "
                        "Add billing/credits in the OpenAI platform, then try again."
                    )
                except Exception as exc:
                    print(f"\nScreen-control error: {exc}")
            continue

        if lowered.startswith("/chat "):
            user_text = user_text[len("/chat ") :].strip()
            if not user_text:
                continue

        try:
            previous_response_id = chat_response(
                client=client,
                model=chat_model,
                instructions=instructions,
                user_text=user_text,
                previous_response_id=previous_response_id,
            )
        except RateLimitError:
            print(
                "\nYour OpenAI API account has no usable quota right now. "
                "Add billing/credits in the OpenAI platform, then try again."
            )
        except Exception as exc:
            print(f"\nError: {exc}")


if __name__ == "__main__":
    main()
