import { useState } from "react";
import { Navigate } from "react-router-dom";
import { HeroSection } from "@/components/HeroSection";
import { ChatInterface } from "@/components/ChatInterface";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, loading } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string>();

  // Redirect to auth if not authenticated
  if (!loading && !user) {
    return <Navigate to="/auth" replace />;
  }

  const handleStartChat = (message?: string) => {
    setInitialMessage(message);
    setShowChat(true);
  };

  const handleBackToHero = () => {
    setShowChat(false);
    setInitialMessage(undefined);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground font-serif">Loading...</div>
      </div>
    );
  }

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
