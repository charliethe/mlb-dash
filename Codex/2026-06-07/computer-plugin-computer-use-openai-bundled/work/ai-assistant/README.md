# AI Assistant Starter

A tiny AI assistant using the OpenAI Responses API. It has chat, web search, and optional screen control.

## Setup

```bash
cd work/ai-assistant
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```bash
OPENAI_API_KEY=sk-your-key-here
```

## Run Everything Together

```bash
python unified_assistant.py
```

Normal messages can use web search automatically. To let it see and control your screen, start a task with `/screen`:

```text
What's the latest news about OpenAI?
/screen Open Notes and create a note called Grocery List.
```

## Run Only The Chat Assistant

```bash
python assistant.py
```

Type your message and press Enter. Use `/quit` to exit. This version does not include screen control.

## Run Only The Screen-Control Assistant

This version can look at your screen and suggest mouse/keyboard actions. It asks before every action.

```bash
python desktop_agent.py
```

On macOS, you may need to allow your Terminal app in:

- System Settings -> Privacy & Security -> Screen Recording
- System Settings -> Privacy & Security -> Accessibility

Use small, specific tasks, like:

```text
Open Notes and create a note called Grocery List.
```

Do not use it for banking, passwords, medical/legal tasks, deleting files, or anything high-stakes.

## Customize

Change the assistant personality in `instructions.txt`.

## Free Local Version

This version uses Ollama instead of the OpenAI API, so normal chat is free after the model download.

```bash
python free_assistant.py
```

Use `/web QUESTION` for free web search.

Desktop commands:

```text
/look
/screen TASK
/click X Y
/type TEXT
/press KEY
```

For `/look` and `/screen`, enable Terminal in System Settings -> Privacy & Security -> Screen Recording.

For `/click`, `/type`, `/press`, and `/screen`, enable Terminal in System Settings -> Privacy & Security -> Accessibility.
