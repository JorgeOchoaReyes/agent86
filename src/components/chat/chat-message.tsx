import { useState, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { Avatar } from "../../components/ui/avatar";
import { Bot, User } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { type Message } from "~/types"; 
import rehypeRaw from "rehype-raw";

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isNewAssistantMessage = !isUser && message.isNew;
  const [displayedContent, setDisplayedContent] = useState(isNewAssistantMessage ? "" : message.content);
  const [isTyping, setIsTyping] = useState(isNewAssistantMessage);
  const fullContentRef = useRef(message.content);
 
  useEffect(() => {
    if (!isNewAssistantMessage) return;

    let currentIndex = 0;
    const fullContent = message.content;  
    const typingInterval = setInterval(() => { 
      if (currentIndex <= fullContent.length) {
        setDisplayedContent(fullContent.substring(0, currentIndex+10));
        currentIndex += 10;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false);
      }
    }, 1); 

    return () => clearInterval(typingInterval);
  }, [isNewAssistantMessage, message.content, message.isNew, fullContentRef]);

  const processMessageContent = (content: string) => {
    const parts: { type: string; content: string }[] = [];
    content.split("\n").forEach((part) => {
      if(part.length > 150) {
        const subParts = part.match(/.{1,150}/g) ?? []; 
        subParts.forEach((subPart) => {
          parts.push({ type: "text", content: subPart });
          parts.push({ type: "break", content: "\n" });
        });
        return;
      }
      parts.push({ type: "text", content: part });
      parts.push({ type: "break", content: "\n" });
    });
    return parts;
  };

  const messageParts = processMessageContent(isUser ? message.content : displayedContent);

  return (
    <div className={cn("flex items-start gap-4 rounded-lg p-4", isUser ? "bg-muted/50" : "bg-background")}>
      <Avatar className={cn("h-8 w-8", !isUser && "bg-primary text-primary-foreground")}>
        {isUser ? <User className="h-full w-full" /> : <Bot className="h-full w-full" />}
      </Avatar>
      <div className="flex-1 space-y-2">
        <div className="font-medium">
          {isUser ? "You" : "AI Assistant"}
          {isTyping && <span className="ml-2 inline-block animate-pulse">...</span>}
        </div>
        <div className="markdown prose prose-sm dark:prose-invert overflow-auto sm:max-w-[60vw] 3xl:max-w-[80vw] break-words rounded-md bg-muted/50 p-2">
          <Markdown rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]}>{`${message.content ?? ""}`}</Markdown> 
        </div>
      </div>
    </div>
  );
}
