import anthropic
from tools import TOOLS, run_tool

MODEL = "claude-haiku-5-5"
client = anthropic.Anthropic()

messages = [{"role": "user", "content": "Make me another note called Visit to the Zoo with a random, 3 line sentences about zoo."}]

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

print(response.content[0].text)