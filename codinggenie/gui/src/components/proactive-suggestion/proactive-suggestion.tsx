import { useContext, useEffect, useState } from "react";
import { Accordian } from "../accordian/accordian";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { setMessageAtIndex } from "../../redux/slices/stateSlice";
import { useDispatch } from "react-redux";
import { ChatMessage } from "core";

export interface Suggestion {
  tag: string;
  expanded_text: string;
  code: string;
}

export interface SuggestionSet {
  suggestions: Suggestion[];
  predecessorHistoryIdx: number;
  uuid: string;
}

interface ProactiveSuggestionProps {
  suggestions: Suggestion[];
  setProactiveSuggestions: any;
  onAccept: any;
  suggestionIdx: number;
  uuid: string;
}

export const ProactiveSuggestion = ({
  suggestions,
  setProactiveSuggestions,
  onAccept,
  suggestionIdx,
  uuid,
}: ProactiveSuggestionProps) => {
  const dispatch = useDispatch();
  const [openIdx, setOpenIdx] = useState(-1);

  useEffect(() => {
    console.log(openIdx);
  }, [openIdx]);

  const ideMessenger: any = useContext(IdeMessengerContext);

  const suggTypeRegex = /([^:\n]+):([^\n]+)/;

  // Curried function
  const handleAccept = (
    userMessage: ChatMessage,
    botMessage: ChatMessage,
    index,
    innerSuggestionIdx,
  ) => {
    return () => {
      console.log("CALLED OCNE");
      onAccept();

      dispatch(
        setMessageAtIndex({
          message: userMessage,
          index: index,
          contextItems: null,
        }),
      );
      dispatch(
        setMessageAtIndex({
          message: botMessage,
          index: index + 1,
          contextItems: null,
        }),
      );

      setProactiveSuggestions((suggestions) => {
        console.log(
          suggestions[suggestionIdx],
          suggestionIdx,
          innerSuggestionIdx,
        );

        const newSuggestions = suggestions.map((suggestion) => ({
          ...suggestion,
          suggestions: [...suggestion.suggestions],
        }));

        newSuggestions[suggestionIdx].suggestions = newSuggestions[
          suggestionIdx
        ].suggestions.filter(
          (_, listIndex) => listIndex !== innerSuggestionIdx,
        );

        if (newSuggestions[suggestionIdx].suggestions.length == 0) {
          newSuggestions.splice(suggestionIdx, 1);
          return newSuggestions;
        }

        // Adjust the pred index here because it is accepted.
        if (suggestionIdx == suggestions.length - 1) {
          // We don't want to make the suggestions move down unless it's actually on the bottom.
          newSuggestions[suggestionIdx].predecessorHistoryIdx += 2;
        }

        return newSuggestions;
      });

      setOpenIdx(-1);
    };
  };

  return (
    suggestions && (
      <div className="mx-0.5 my-1 rounded-sm">
        {suggestions.map((suggestion, index) => {
          const suggType = suggestion.tag.match(suggTypeRegex)[1];
          return (
            <Accordian
              uuid={uuid}
              suggType={suggType}
              key={index}
              index={index}
              tag={suggestion.tag}
              code={suggestion.code}
              expanded_text={suggestion.expanded_text}
              open={openIdx === index}
              onClick={() => {
                if (openIdx === index) setOpenIdx(-1);
                else setOpenIdx(index);
              }}
              handleAccept={handleAccept}
            ></Accordian>
          );
        })}
      </div>
    )
  );
};
