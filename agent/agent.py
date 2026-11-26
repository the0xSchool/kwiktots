import anthropic
from tools import TOOLS, run_tool

MODEL = "claude-haiku-5-5"
client = anthropic.Anthropic()


def run_agent(prompt: str) -> str:
    # Each call starts a new conversation: the agent does not remember earlier ones.
    messages = [{"role": "user", "content": prompt}]

    while True:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            tools=TOOLS,
            messages=messages,
        )
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            break

        results = []
        for block in response.content:
            if block.type == "tool_use":
                output = run_tool(block.name, block.input)
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": output,
                    "is_error": output.startswith("Error"),
                })
        messages.append({"role": "user", "content": results})

    # A reply is a list of blocks, and the first one is not always text.
    return "".join(block.text for block in response.content if block.type == "text")
