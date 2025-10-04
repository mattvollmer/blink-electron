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
      // Convert messages to the format expected by Blink runtime
      const formattedMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        parts: [
          {
            type: 'text',
            text: msg.content,
          }
        ],
      }));
      
      console.log('Sending messages:', JSON.stringify(formattedMessages, null, 2));
      
      // Use fetch directly to the agent endpoint
      const response = await fetch(`http://localhost:${project.port}/_agent/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: formattedMessages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let assistantMessage = '';
      const assistantId = Date.now().toString();
      const decoder = new TextDecoder();
      let toolCalls: Array<{id: string, name: string, input: any}> = [];
      let toolOutputs: Map<string, any> = new Map();
      let hasTools = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk and extract text from SSE format
        const chunk = decoder.decode(value, { stream: true });
        console.log('Received chunk:', chunk);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));
              
              // Handle text deltas
              if (data.type === 'text-delta' && data.delta) {
                assistantMessage += data.delta;
                setMessages((prev) => {
                  const existing = prev.find((m) => m.id === assistantId);
                  if (existing) {
                    return prev.map((m) =>
                      m.id === assistantId ? { ...m, content: assistantMessage } : m
                    );
                  } else {
                    return [
                      ...prev,
                      {
                        id: assistantId,
                        role: 'assistant' as const,
                        content: assistantMessage,
                        createdAt: new Date(),
                      },
                    ];
                  }
                });
              }
              
              // Track tool calls
              if (data.type === 'tool-input-available') {
                hasTools = true;
                toolCalls.push({
                  id: data.toolCallId,
                  name: data.toolName,
                  input: data.input
                });
              }
              
              // Track tool outputs
              if (data.type === 'tool-output-available') {
                toolOutputs.set(data.toolCallId, data.output);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
      
      // If there were tool calls, make another request with the results
      if (hasTools && toolCalls.length > 0) {
        // Small delay to ensure first message is fully rendered
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Display tool calls in the UI
        const toolCallsMessage = {
          id: assistantId + '-tools',
          role: 'assistant' as const,
          content: toolCalls.map(tool => {
            const output = toolOutputs.get(tool.id);
            return `🔧 **${tool.name}**\n\`\`\`json\nInput: ${JSON.stringify(tool.input, null, 2)}\n\nOutput: ${JSON.stringify(output, null, 2)}\n\`\`\``;
          }).join('\n\n'),
          createdAt: new Date(Date.now() + 1), // Ensure it comes after first message
        };
        
        setMessages((prev) => [
          ...prev,
          toolCallsMessage
        ]);
        
        // Build assistant message with tool calls in parts format
        const assistantParts: any[] = [];
        
        if (assistantMessage) {
          assistantParts.push({ type: 'text', text: assistantMessage });
        }
        
        for (const tool of toolCalls) {
          assistantParts.push({
            type: `tool-${tool.name}`,
            toolCallId: tool.id,
            state: 'output-available',
            input: tool.input,
            output: toolOutputs.get(tool.id)
          });
        }
        
        // Add assistant message to messages (for follow-up request context only, don't modify UI)
        const assistantMessageWithTools = {
          id: assistantId,
          role: 'assistant' as const,
          parts: assistantParts,
          content: assistantMessage,
          createdAt: new Date(),
        };
        
        // Make follow-up request with tool results
        const followUpMessages = [...messages, userMessage, assistantMessageWithTools].map(msg => ({
          role: msg.role,
          parts: msg.parts || [
            {
              type: 'text',
              text: msg.content,
            }
          ],
        }));
        
        const followUpResponse = await fetch(`http://localhost:${project.port}/_agent/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messages: followUpMessages }),
        });

        if (!followUpResponse.ok) {
          throw new Error(`HTTP error! status: ${followUpResponse.status}`);
        }

        const followUpReader = followUpResponse.body?.getReader();
        if (!followUpReader) {
          throw new Error('No response body');
        }
        
        // Read the follow-up response
        let followUpMessage = '';
        const followUpId = Date.now().toString() + '-followup';
        
        while (true) {
          const { done, value } = await followUpReader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.type === 'text-delta' && data.delta) {
                  followUpMessage += data.delta;
                  setMessages((prev) => {
                    const existing = prev.find((m) => m.id === followUpId);
                    if (existing) {
                      return prev.map((m) =>
                        m.id === followUpId ? { ...m, content: followUpMessage } : m
                      );
                    } else {
                      return [
                        ...prev,
                        {
                          id: followUpId,
                          role: 'assistant' as const,
                          content: followUpMessage,
                          createdAt: new Date(),
                        },
                      ];
                    }
                  });
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
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
