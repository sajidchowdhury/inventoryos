"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Send, Sparkles, Bot, User, Loader2,
  RotateCcw, MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/auth-store";
import { useNavStore } from "@/lib/nav-store";
import { cn } from "@/lib/utils";

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  timestamp: string;
}

const suggestedQuestions = [
  "How is my business doing today?",
  "What products should I reorder?",
  "Show me products expiring soon",
  "What are my top selling products?",
  "How much money do customers owe me?",
  "What's my profit this month?",
];

export function AIChat() {
  const session = useAuthStore((s) => s.session);
  const setActiveView = useNavStore((s) => s.setActiveView);
  const businessId = session?.business?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!businessId || !text.trim()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/api/businesses/${businessId}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();

      if (data.success) {
        const aiMessage: ChatMessage = {
          role: "ai",
          content: data.response,
          timestamp: data.timestamp,
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        throw new Error(data.error || "Failed");
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: "ai",
        content: "Sorry, I couldn't process that. Please try again.",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [businessId, messages]);

  const handleSend = () => {
    if (input.trim() && !loading) {
      sendMessage(input);
    }
  };

  const handleSuggested = (question: string) => {
    sendMessage(question);
  };

  const handleReset = () => {
    setMessages([]);
  };

  return (
    <motion.div {...fadeIn} className="space-y-4 pb-4 flex flex-col" style={{ minHeight: "70vh" }}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setActiveView("dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold flex-1 flex items-center gap-1.5">
          <Sparkles className="h-5 w-5 text-primary" /> AI Assistant
        </h1>
        {messages.length > 0 && (
          <Button variant="ghost" size="icon" onClick={handleReset} title="New conversation">
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1">
        {messages.length === 0 ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-6 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold">Ask me anything about your pharmacy</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  I have access to your real-time inventory, sales, purchases, and financial data.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 text-left">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    className="text-left text-xs p-2.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    onClick={() => handleSuggested(q)}
                  >
                    <MessageSquare className="h-3 w-3 inline mr-1.5 text-primary" />
                    {q}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "")}>
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                msg.role === "ai" ? "bg-primary/10" : "bg-muted"
              )}>
                {msg.role === "ai" ? <Bot className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className={cn(
                "rounded-lg p-3 max-w-[80%]",
                msg.role === "ai" ? "bg-muted/50" : "bg-primary text-primary-foreground"
              )}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-lg p-3 bg-muted/50">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ask about your inventory, sales, expiry..."
          className="h-11"
          disabled={loading}
        />
        <Button size="icon" className="h-11 w-11 shrink-0" onClick={handleSend} disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </motion.div>
  );
}
