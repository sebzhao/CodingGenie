interface OptionBubbleProps {
  tag: string;
  full_prompt: string;
  onEnter: any;
}

export const OptionBubble = ({
  tag,
  full_prompt,
  onEnter,
}: OptionBubbleProps) => {
  let json = {
    content: [
      { content: [{ type: "text", text: full_prompt }], type: "paragraph" },
    ],
    type: "doc",
  };

  let params = {
    noContext: true,
    useCodebase: false,
  };

  return (
    <div className="p-1 ml-2 w-8/12">
      <button onClick={() => onEnter(json, params)}>{tag}</button>
    </div>
  );
};
