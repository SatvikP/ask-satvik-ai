import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, Sparkles } from "lucide-react";

interface HeroSectionProps {
  onStartChat: (message?: string) => void;
}

const starterQuestions = [
  {
    text: "Tell me something about Satvik",
    icon: "💼",
  },
  {
    text: "What are Satvik's values?",
    icon: "⭐",
  },
  {
    text: "What does Satvik like to do when he is not working?",
    icon: "🌟",
  },
];

export const HeroSection = ({ onStartChat }: HeroSectionProps) => {
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="max-w-4xl mx-auto text-center">
        {/* Hero Content */}
        <div className="mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-card/20 backdrop-blur-sm rounded-full px-6 py-3 mb-8 border border-primary-foreground/20">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
            <span className="text-primary-foreground font-medium">AI-Powered Professional Assistant</span>
          </div>
          
          <div className="flex items-center justify-center gap-6 mb-6">
            <Avatar className="w-20 h-20 md:w-24 md:h-24 border-2 border-primary-foreground/30">
              <AvatarImage 
                src="/lovable-uploads/f5679b52-2922-4b12-8388-934ab719d6ee.png" 
                alt="Satvik Puti" 
                className="object-cover"
              />
              <AvatarFallback className="text-2xl font-bold bg-primary-foreground/20 text-primary-foreground">
                SP
              </AvatarFallback>
            </Avatar>
            <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground leading-tight">
              Ask Satvik
              <span className="block text-4xl md:text-6xl">Anything</span>
            </h1>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-8">
            <MessageCircle className="w-6 h-6 text-primary-foreground/80" />
            <p className="text-xl md:text-2xl text-primary-foreground/90 max-w-3xl">
              Get instant answers about Satvik's experience, values, and how he can create value for your company
            </p>
          </div>
          
          <Button
            variant="hero"
            size="lg"
            onClick={() => onStartChat()}
            className="text-lg px-8 py-6 bg-card/20 backdrop-blur-sm text-primary-foreground border border-primary-foreground/30 hover:bg-card/30"
          >
            <MessageCircle className="w-5 h-5" />
            Start Conversation
          </Button>
        </div>

        {/* Starter Questions */}
        <div className="animate-slide-up">
          <h2 className="text-2xl font-semibold text-primary-foreground/90 mb-8">
            Or try these popular questions:
          </h2>
          
          <div className="grid gap-4 md:gap-6 max-w-5xl mx-auto">
            {starterQuestions.map((question, index) => (
              <Button
                key={index}
                variant="starter"
                size="lg"
                onClick={() => onStartChat(question.text)}
                className="p-6 text-base md:text-lg h-auto min-h-[80px] bg-card/10 backdrop-blur-sm text-primary-foreground border border-primary-foreground/20 hover:bg-card/20 hover:border-primary-foreground/40"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <span className="text-2xl mr-4" role="img" aria-hidden="true">
                  {question.icon}
                </span>
                <span className="flex-1 text-left leading-relaxed">
                  {question.text}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-16 text-primary-foreground/70 text-sm">
          <p>Professional AI Assistant • Designed for VCs & HR Professionals</p>
        </div>
      </div>
    </div>
  );
};