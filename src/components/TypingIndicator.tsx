import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot } from "lucide-react";

export const TypingIndicator = () => {
  return (
    <div className="flex gap-3 mb-6 animate-fade-in">
      <Avatar className="w-10 h-10 shadow-chat">
        <AvatarFallback className="bg-card text-foreground border border-primary/20">
          <Bot className="w-5 h-5" />
        </AvatarFallback>
      </Avatar>
      
      <div className="max-w-[80%] flex flex-col items-start">
        <div className="rounded-2xl px-4 py-3 shadow-chat bg-card text-foreground border border-primary/10 rounded-bl-sm">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing"></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-muted-foreground rounded-full animate-typing" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};