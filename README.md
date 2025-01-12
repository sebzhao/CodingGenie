# CodingGenie

Implementation of [CodingGenie: A Proactive LLM-Powered Programming Assistant]

## Overview

CodingGenie is an open-source implementation of a proactive assistant integrated into the chat window of Continue, a VSCode coding LLM extension. Proactive suggestions are chat-based suggestions which are suggested autonomously without user prompting, triggered after code changes or chat messages. CodingGenie suggests chat completions based upon several factors, including the code context, optional task description, enabled suggestion types, and previous conversation history. 

<p align="center">
    <img src="./img/interface_diagram.png" width=700px/>
</p>
<p align="center">
    UI and components of prompting. (A) is a proactive suggestion, (B) is the accept button, (C) is the normal chat interface, and (D) is the normal editor interface.
</p>

<p align="center">
  <img src="./img/system_diagram.png" width=500px/>
</p>
<p align="center">
    System design
</p>

## Getting Started

CodingGenie requires building the package for your target architecture, with minimal changes to the installation instructions of Continue. Currently, this extension is only compatible with VSCode.

### VS Code

1. Open the VS Code command pallet (`cmd/ctrl+shift+p`) and select `Tasks: Run Task` and then select `install-all-dependencies`

2. Find the newly generated file, `extensions/vscode/build/continue-{VERSION}.vsix`. Then, navigate to the Extensions icon in VSCode, click on the ... icon in the top right of the opened tab, and select "Install from VSIX". Select the newly generated file.

## Functionality and Commands

### Triggering Proactive Suggestions

Proactive suggestions may be triggered in multiple ways. With the Continue tab open, either
1. Make a code change
2. Ask a question in code chat
3. Manually request proactive suggestions by (`cmd/ctrl+shift+p`) and search for and select `Continue: Request proactive suggestions`

### Configuring Task Description

Configure task description to get suggestions directed towards a specific goal. 
1. (`cmd/ctrl+shift+p`) and search for and select `Continue: Configure Task Description`. 
2. Enter task description and press enter.

### Configuring Suggestion Types

Configure suggestion types shown. 
1. (`cmd/ctrl+shift+p`) and search for and select `Continue: Configure Proactive Config`
2. Select/unselect suggestion types to enable/disable. By default all suggestions are shown.
3. Select OK.


## Citation
(TODO)

## Contribution
We welcome contributions from the community, feel free to submit a PR or open an issue.

## License
This code is released under the MIT license.