import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { Send, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatInterfaceProps {
  onBack: () => void;
  initialMessage?: string;
}

export const ChatInterface = ({ onBack, initialMessage }: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (initialMessage) {
      handleSendMessage(initialMessage);
    }
  }, [initialMessage]);

  const handleSendMessage = async (messageContent: string = input) => {
    if (!messageContent.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Simulate API call for now - replace with actual endpoint
      const response = await fetch('https://satvik-ai-railway-production.up.railway.app/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: messageContent })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.answer || "I'm sorry, I couldn't process that request. I'd recommend booking a call with Satvik to discuss this directly. Schedule at: [Calendly placeholder]",
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error:', error);
      
      // Fallback response for demo purposes
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: getDemoResponse(messageContent),
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, fallbackMessage]);
      
      toast({
        title: "Connection Issue",
        description: "Using demo responses. In production, this would connect to Satvik's AI.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getDemoResponse = (question: string): string => {
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes("company") || lowerQuestion.includes("value")) {
      return "I'd love to learn more about your company first! Could you tell me about your industry, stage, and key challenges? Based on that, I can explain how Satvik's experience in strategy, operations, and business development could create specific value for your organization. His track record includes scaling businesses, optimizing operations, and driving strategic initiatives.\n\nFor a detailed discussion tailored to your company's needs, I'd recommend booking a call with Satvik directly. Schedule at: [Calendly placeholder]";
    }
    
    if (lowerQuestion.includes("values")) {
      return "Satvik's core values center around:\n\n🎯 **Excellence & Growth**: Constantly pushing boundaries and striving for exceptional results\n💡 **Innovation**: Finding creative solutions to complex problems\n🤝 **Collaboration**: Building strong relationships and working effectively with diverse teams\n🔄 **Adaptability**: Thriving in dynamic environments and embracing change\n⚡ **Impact**: Focusing on work that creates meaningful value and drives real outcomes\n\nThese values guide his approach to every project and partnership.";
    }
    
    if (lowerQuestion.includes("not working") || lowerQuestion.includes("hobbies") || lowerQuestion.includes("free time")) {
      return "When Satvik isn't working, you'll find him:\n\n🏃‍♂️ **Staying Active**: Regular workouts, hiking, and exploring new fitness challenges\n📚 **Continuous Learning**: Reading business books, industry reports, and staying current with trends\n🌍 **Exploring**: Traveling to new places and experiencing different cultures\n🍳 **Cooking**: Experimenting with new recipes and cuisines\n👥 **Connecting**: Spending quality time with family and friends\n\nHe believes in maintaining a healthy work-life balance to bring fresh perspectives and energy to his professional endeavors.";
    }
    
    return "That's a great question! While I have extensive information about Satvik's professional background and experience, I'd recommend discussing this specific topic directly with him for the most comprehensive answer.\n\nI'd recommend booking a call with Satvik to discuss this directly. Schedule at: [Calendly placeholder]";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  return (
    <div className="min-h-screen bg-gradient-chat flex flex-col">
      {/* Header */}
      <div className="bg-card/80 backdrop-blur-sm border-b border-primary/10 px-4 py-4 shadow-chat">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="hover:bg-primary/10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Chat with Satvik's AI Assistant</h1>
            <p className="text-sm text-muted-foreground">Get instant answers about Satvik's experience and expertise</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <div className="bg-card/50 backdrop-blur-sm rounded-xl p-8 border border-primary/10">
                <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to the conversation!</h2>
                <p className="text-muted-foreground">Ask me anything about Satvik's experience, values, or how he can help your organization.</p>
              </div>
            </div>
          )}
          
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message.content}
              isUser={message.isUser}
              timestamp={message.timestamp}
            />
          ))}
          
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-card/80 backdrop-blur-sm border-t border-primary/10 px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Satvik's experience, values, or how he can help your company..."
              className="flex-1 border-primary/20 focus:border-primary"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              variant="chat" 
              size="icon"
              disabled={!input.trim() || isLoading}
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};
