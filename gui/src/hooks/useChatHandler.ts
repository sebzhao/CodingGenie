import { Dispatch } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/react";
import {
  ChatHistory,
  ChatHistoryItem,
  ChatMessage,
  ContextItemWithId,
  InputModifiers,
  MessageContent,
  PromptLog,
  RangeInFile,
  SlashCommandDescription,
} from "core";
import { constructMessages } from "core/llm/constructMessages";
import { stripImages } from "core/llm/images";
import { getBasename, getRelativePath } from "core/util";
import { usePostHog } from "posthog-js/react";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import resolveEditorContent, {
  hasSlashCommandOrContextProvider,
} from "../components/mainInput/resolveInput";
import { IIdeMessenger } from "../context/IdeMessenger";
import { defaultModelSelector } from "../redux/selectors/modelSelectors";
import {
  addContextItems,
  addPromptCompletionPair,
  clearLastResponse,
  initNewActiveMessage,
  resubmitAtIndex,
  setInactive,
  setIsGatheringContext,
  setMessageAtIndex,
  setProactiveConfig,
  streamUpdate,
} from "../redux/slices/stateSlice";
import { resetNextCodeBlockToApplyIndex } from "../redux/slices/uiStateSlice";
import { RootState } from "../redux/store";
import { useWebviewListener } from "./useWebviewListener";

function useChatHandler(dispatch: Dispatch, ideMessenger: IIdeMessenger) {
  const posthog = usePostHog();

  const defaultModel = useSelector(defaultModelSelector);
  const defaultContextProviders = useSelector(
    (store: RootState) => store.state.config.experimental?.defaultContext ?? [],
  );

  const slashCommands = useSelector(
    (store: RootState) => store.state.config.slashCommands || [],
  );

  const contextItems = useSelector(
    (state: RootState) => state.state.contextItems,
  );

  const history = useSelector((store: RootState) => store.state.history);
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);


  const active = useSelector((store: RootState) => store.state.active);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const taskDescriptionRef = useRef("");

  useWebviewListener("setTaskDescription", async (data) => {
    taskDescriptionRef.current = data;
  });

  async function getChatResponse(messages: ChatMessage[]) {
    try {
      const abortController = new AbortController();
      const cancelToken = abortController.signal;
      const completion = ideMessenger.llmChat(
        defaultModel.title,
        cancelToken,
        messages,
      );
      return completion;
    } catch (e) {
      console.log(e);
      console.log("Request response failed");
    }
  }

  async function _streamNormalInput(messages: ChatMessage[]) {
    const abortController = new AbortController();
    const cancelToken = abortController.signal;

    try {
      if (!defaultModel) {
        throw new Error("Default model not defined");
      }
      const gen = ideMessenger.llmStreamChat(
        defaultModel.title,
        cancelToken,
        messages,
      );
      let next = await gen.next();

      while (!next.done) {
        if (!activeRef.current) {
          abortController.abort();
          break;
        }
        dispatch(
          streamUpdate(stripImages((next.value as ChatMessage).content)),
        );
        next = await gen.next();
      }

      let returnVal = next.value as PromptLog;
      if (returnVal) {
        dispatch(addPromptCompletionPair([returnVal]));
      }
    } catch (e) {
      // If there's an error, we should clear the response so there aren't two input boxes
      dispatch(clearLastResponse());
    }
  }

  

  const getSlashCommandForInput = (
    input: MessageContent,
  ): [SlashCommandDescription, string] | undefined => {
    let slashCommand: SlashCommandDescription | undefined;
    let slashCommandName: string | undefined;

    let lastText =
      typeof input === "string"
        ? input
        : input.filter((part) => part.type === "text").slice(-1)[0]?.text || "";

    if (lastText.startsWith("/")) {
      slashCommandName = lastText.split(" ")[0].substring(1);
      slashCommand = slashCommands.find(
        (command) => command.name === slashCommandName,
      );
    }
    if (!slashCommand || !slashCommandName) {
      return undefined;
    }

    // Convert to actual slash command object with runnable function
    return [slashCommand, stripImages(input)];
  };

  async function _streamSlashCommand(
    messages: ChatMessage[],
    slashCommand: SlashCommandDescription,
    input: string,
    historyIndex: number,
    selectedCode: RangeInFile[],
    contextItems: ContextItemWithId[],
  ) {
    const abortController = new AbortController();
    const cancelToken = abortController.signal;

    if (!defaultModel) {
      throw new Error("Default model not defined");
    }

    const modelTitle = defaultModel.title;

    const checkActiveInterval = setInterval(() => {
      if (!activeRef.current) {
        abortController.abort();
        clearInterval(checkActiveInterval);
      }
    }, 100);

    for await (const update of ideMessenger.streamRequest(
      "command/run",
      {
        input,
        history: messages,
        modelTitle,
        slashCommandName: slashCommand.name,
        contextItems,
        params: slashCommand.params,
        historyIndex,
        selectedCode,
      },
      cancelToken,
    )) {
      if (!activeRef.current) {
        abortController.abort();
        break;
      }
      if (typeof update === "string") {
        dispatch(streamUpdate(update));
      }
    }
    clearInterval(checkActiveInterval);
  }

  async function streamResponse(
    editorState: JSONContent,
    modifiers: InputModifiers,
    ideMessenger: IIdeMessenger,
    index?: number,
  ) {
    try {
      if (typeof index === "number") {
        console.log("Calls resubmitAtIndex");
        dispatch(resubmitAtIndex({ index, editorState }));
      } else {
        dispatch(initNewActiveMessage({ editorState }));
      }

      // Reset current code block index
      dispatch(resetNextCodeBlockToApplyIndex());

      const shouldGatherContext =
        modifiers.useCodebase || hasSlashCommandOrContextProvider(editorState);

      if (shouldGatherContext) {
        dispatch(setIsGatheringContext(true));
      }

      // Resolve context providers and construct new history
      const [selectedContextItems, selectedCode, content] =
        await resolveEditorContent(
          editorState,
          modifiers,
          ideMessenger,
          defaultContextProviders,
        );

      dispatch(setIsGatheringContext(false));

      // Automatically use currently open file
      if (!modifiers.noContext) {
        const usingFreeTrial = defaultModel?.provider === "free-trial";

        const currentFilePath = await ideMessenger.ide.getCurrentFile();
        if (typeof currentFilePath === "string") {
          let currentFileContents = await ideMessenger.ide.readFile(
            currentFilePath,
          );
          if (usingFreeTrial) {
            currentFileContents = currentFileContents
              .split("\n")
              .slice(0, 1000)
              .join("\n");
          }
          selectedContextItems.unshift({
            content: `The following file is currently open. Don't reference it if it's not relevant to the user's message.\n\n\`\`\`${getRelativePath(
              currentFilePath,
              await ideMessenger.ide.getWorkspaceDirs(),
            )}\n${currentFileContents}\n\`\`\``,
            name: `Active file: ${getBasename(currentFilePath)}`,
            description: currentFilePath,
            id: {
              itemId: currentFilePath,
              providerTitle: "file",
            },
            uri: {
              type: "file",
              value: currentFilePath,
            },
          });
        }
      }

      dispatch(addContextItems(contextItems));

      const message: ChatMessage = {
        role: "user",
        content,
      };

      const historyItem: ChatHistoryItem = {
        message,
        contextItems: selectedContextItems,
        editorState,
      };

      console.log("HISTORY IN STREAMRESPONSE", history);
      let newHistory: ChatHistory = [...history.slice(0, index), historyItem];
      console.log(history);
      console.log(newHistory);
      const historyIndex = index || newHistory.length - 1;
      dispatch(
        setMessageAtIndex({
          message,
          index: historyIndex,
          contextItems: selectedContextItems,
        }),
      );

      // TODO: hacky way to allow rerender
      await new Promise((resolve) => setTimeout(resolve, 0));

      posthog.capture("step run", {
        step_name: "User Input",
        params: {},
      });
      posthog.capture("userInput", {});

      const messages = constructMessages(newHistory, defaultModel.model);

      // Determine if the input is a slash command
      let commandAndInput = getSlashCommandForInput(content);

      if (!commandAndInput) {
        await _streamNormalInput(messages);
      } else {
        const [slashCommand, commandInput] = commandAndInput;
        let updatedContextItems = [];
        posthog.capture("step run", {
          step_name: slashCommand.name,
          params: {},
        });

        // For edit and comment slash commands, including the selected code in the context from store and for other commands, including the selected context alone
        if (slashCommand.name === "edit" || slashCommand.name === "comment") {
          updatedContextItems = [...contextItems];
        } else {
          updatedContextItems = [...selectedContextItems];
        }

        await _streamSlashCommand(
          messages,
          slashCommand,
          commandInput,
          historyIndex,
          selectedCode,
          updatedContextItems,
        );
      }
    } catch (e: any) {
      console.debug("Error streaming response: ", e);
      ideMessenger.post("showToast", [
        "error",
        `Error streaming response: ${e.message}`,
      ]);
    } finally {
      dispatch(setInactive());
    }
  }


  async function getProactiveSuggestions(
    editorState: JSONContent,
    modifiers: InputModifiers,
    ideMessenger: IIdeMessenger,
    proactiveConfig: any,
    index?: number,
  ) {
    try {
      let currentFileContents = "";
      // Automatically use currently open file

      const currentFilePath = await ideMessenger.ide.getCurrentFile();
      
      if (typeof currentFilePath === "string") {
        console.log("Before getting file contents");
        currentFileContents =
          await ideMessenger.ide.readFileWithCursor(currentFilePath);
        console.log(currentFileContents);
      }

      const enabledSuggestions = Object.keys(proactiveConfig)
      .filter(key => proactiveConfig[key]) 
      .join(", "); 

      let messageContent = "";
      if (taskDescriptionRef.current != "") {
        messageContent = `Task:\n${taskDescriptionRef.current}\nCode:\n\`\`\`\n${currentFileContents}\n\`\`\`\Provide suggestions based on the code context and task description. Tailor all suggestions to the task description, and do not provided suggestions that are not relevant to the task unless there are no relevant suggestions for the code context. Include \`function name\` in suggestion title if it is mentioned in the suggestion. Use one of the following formats depending on suggestion type, provide 3 suggestions:\n1. {suggestion type: short title}\n{explaining provided code or brainstorming high-level ideas}\nOR\n1. {suggestion type: short title}\n\`\`\`\{language}\n{one or more suggested code snippets}\n\`\`\`\n{clear and detailed explanation for each code snippet in bullet point format. if code is very straightforward then don't explain}\n"suggestion type" can be one of (${enabledSuggestions}) or something else. If there are multiple functions or classes in the code, provide references to the specific function or class that the suggestion pertains to in the explanation.`
      } else {
        messageContent = `Code:\n\`\`\`\n${currentFileContents}\n\`\`\`\Provide suggestions based on the code context. Include \`function name\` in suggestion title if it is mentioned in the suggestion. Use one of the following formats depending on suggestion type, provide 3 suggestions:\n1. {suggestion type: short title}\n{explaining provided code or brainstorming high-level ideas}\nOR\n1. {suggestion type: short title}\n\`\`\`\{language}\n{one or more suggested code snippets}\n\`\`\`\n{clear and detailed explanation for each code snippet in bullet point format. if code is very straightforward then don't explain}\n"suggestion type" can be one of (${enabledSuggestions}) or something else. If there are multiple functions or classes in the code, provide references to the specific function or class that the suggestion pertains to in the explanation.`
      }

      const message: ChatMessage = {
        role: "user",
        content: messageContent,

      };

      const historyItem: ChatHistoryItem = {
        message,
        contextItems,
        editorState,
      };

      let newHistory: ChatHistory = [...historyRef.current.slice(0, index), historyItem];

      // TODO: hacky way to allow rerender
      await new Promise((resolve) => setTimeout(resolve, 0));
      
      const messages = constructMessages(newHistory, defaultModel.title);

      console.log("Messages in getProactiveSuggestions", messages);
      let response = await getChatResponse(messages);
      return response;
    } catch (e: any) {
      console.debug("Error streaming response: ", e);
      ideMessenger.post("showToast", [
        "error",
        `Error streaming response: ${e.message}`,
      ]);
    } finally {
      dispatch(setInactive());
    }
  }

  return { streamResponse,  getProactiveSuggestions};
}

export default useChatHandler;
