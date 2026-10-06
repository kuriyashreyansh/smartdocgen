from app.services.llm_client import ask_json, ask_text

print(ask_json("Reply with JSON only.", 'Return {"hello": "world"}'))
print(ask_text("You are concise.", "Say hi in five words."))