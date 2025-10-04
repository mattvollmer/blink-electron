import React, { useState, useEffect, useRef } from 'react';
import { Client } from 'blink/client';
import { UIMessage } from 'ai';
import { BlinkProject } from '../store/projectStore';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Send } from 'lucide-react';

interface ChatInterfaceProps {
  project: BlinkProject;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ project }) => {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (project.status === 'running') {
      const blinkClient = new Client({
        baseUrl: `http://localhost:${project.port}`,
      });
      setClient(blinkClient);
    } else {
      setClient(null);
    }
  }, [project.status, project.port]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !client || project.status !== 'running') return;

    const userMessage: UIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Convert messages to the format expected by the agent (only role and content)
      const formattedMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      const chatPayload = {
        messages: formattedMessages,
      };
      console.log('Sending chat payload:', JSON.stringify(chatPayload, null, 2));
      
      const stream = await client.chat(chatPayload);

      const reader = stream.getReader();
      let assistantMessage = '';
      const assistantId = Date.now().toString();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (value.type === 'text-delta') {
          assistantMessage += value.textDelta;
          
          setMessages((prev) => {
            const existing = prev.find(m => m.id === assistantId);
            if (existing) {
              return prev.map(m => 
                m.id === assistantId 
                  ? { ...m, content: assistantMessage }
                  : m
              );
            } else {
              return [...prev, {
                id: assistantId,
                role: 'assistant' as const,
                content: assistantMessage,
                createdAt: new Date(),
              }];
            }
          });
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Auth dialog will handle authentication errors automatically
      // No need to show alert here
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (project.status !== 'running') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium">Project Not Running</h3>
          <p className="text-muted-foreground">Start the project to begin chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">{project.name}</h2>
        <p className="text-sm text-muted-foreground">Port: {project.port}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Start a conversation with your agent</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
