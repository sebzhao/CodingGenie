import { MouseEventHandler, useContext, useEffect, useRef } from "react";
import "./accordian.css";
import { ChatMessage } from "core";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import StyledMarkdownPreview from "../markdown/StyledMarkdownPreview";
import ReactMarkdown from "react-markdown";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../redux/store";

export interface AccordianProps {
  tag: string;
  expanded_text: string;
  code: string;
  open: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  index: number;
  handleAccept: any;
  suggType: string;
  uuid: string;
}

export const Accordian = ({
  tag,
  expanded_text,
  code,
  open,
  onClick,
  index,
  handleAccept,
  suggType,
  uuid,
}: AccordianProps) => {
  const panelRef = useRef<HTMLDivElement>(null);

  const ideMessenger: any = useContext(IdeMessengerContext);

  const sessionState = useSelector((state: RootState) => state.state);

  useEffect(() => {
    if (open) {
      panelRef.current.style.display = "block";
      panelRef.current.style.maxHeight = panelRef.current.scrollHeight + "px";
    } else {
      panelRef.current.style.maxHeight = "0";
    }
  }, [open]);

  const botMessage: ChatMessage = {
    role: "assistant",
    content: String(code) + "\n\n" + String(expanded_text),
  };

  const userMessage: ChatMessage = {
    role: "user",
    content: String(tag),
  };

  return (
    <div
      className="px-3 py-0.5"
      onClick={() => {
        ideMessenger.post("updateChatTimer", null);
      }}
    >
      <button
        className={"accordion rounded-sm" + (open ? " active" : "")}
        onClick={onClick}
      >
        <ReactMarkdown>{tag}</ReactMarkdown>
      </button>
      <div className="panel" ref={panelRef}>
        <StyledMarkdownPreview source={code} showCodeBorder={true} />
        <ReactMarkdown>{expanded_text}</ReactMarkdown>
        <div className="flex justify-end pb-3">
          <button
            onClick={() => {
              handleAccept(
                userMessage,
                botMessage,
                sessionState.history.length,
                index,
              )();
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
