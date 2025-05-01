"use client"; 
import { cn } from "../../lib/utils";
import { Avatar } from "../../components/ui/avatar";
import { Bot, User } from "lucide-react";  

type Message = {
  id: string
  content: string
  role: "user" | "assistant"
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"; 
  const processMessageContent = (content: string) => { 
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    const parts = [];
    let lastIndex = 0;
    let match; 
    while ((match = codeBlockRegex.exec(content)) !== null) { 
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: content.slice(lastIndex, match.index),
        });
      } 
      parts.push({
        type: "code",
        language: match[1] ?? "javascript",  
        content: match?.[2]?.trim(),
      });

      lastIndex = match.index + match[0].length;
    } 
    if (lastIndex < content.length) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex),
      });
    } 
    if (parts.length === 0) {
      parts.push({
        type: "text",
        content,
      });
    }

    return parts;
  };

  const messageParts = processMessageContent(message.content);

  return (
    <div className={cn("flex items-start gap-4 rounded-lg p-4", isUser ? "bg-muted/50" : "bg-background")}>
      <Avatar className={cn("h-8 w-8", !isUser && "bg-primary text-primary-foreground")}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </Avatar>
      <div className="flex-1 space-y-2">
        <div className="font-medium">{isUser ? "You" : "AI Assistant"}</div>
        <div className="prose prose-sm dark:prose-invert">
          {messageParts.map((part, index) => {
            if (part.type === "text") {
              return (
                <div key={index} className="whitespace-pre-wrap">
                  {part.content}
                </div>
              );
            }  
            return null;
          })}
        </div>
      </div>
    </div>
  );
} 