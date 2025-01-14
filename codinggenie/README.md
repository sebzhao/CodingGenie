## CodingGenie

Several important components of CodingGenie are pointed to for further info and to enable further development.

### Prompting
Where the prompt is specified and the LLM completion request is made:

`getProactiveSuggestions` function of codinggenie/gui/src/hooks/useChatHandler.ts

### Proactive Suggestion Component
Where proactive suggestion components live:

codinggenie/gui/src/pages/gui/Chat.tsx

### VSCode Commands
Where the VSCode commands are registered and refresh logic is implemented:

`commandsMap` function of codinggenie/extensions/vscode/src/commands.ts 