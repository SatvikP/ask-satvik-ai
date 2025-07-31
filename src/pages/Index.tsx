import { useState } from "react";
import { HeroSection } from "@/components/HeroSection";
import { ChatInterface } from "@/components/ChatInterface";

const Index = () => {
  const [showChat, setShowChat] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string>();

  const handleStartChat = (message?: string) => {
    setInitialMessage(message);
    setShowChat(true);
  };

  const handleBackToHero = () => {
    setShowChat(false);
    setInitialMessage(undefined);
  };

  if (showChat) {
    return (
      <ChatInterface 
        onBack={handleBackToHero} 
        initialMessage={initialMessage}
      />
    );
  }

  return <HeroSection onStartChat={handleStartChat} />;
};

export default Index;
