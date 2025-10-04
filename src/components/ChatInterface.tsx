import React, { useState, useEffect, useRef } from "react";
import { Client } from "blink/client";
import { UIMessage } from "ai";
import { BlinkProject, useProjectStore } from "../store/projectStore";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Send, ChevronRight, ChevronDown, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatInterfaceProps {
  project: BlinkProject;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ project }) => {
  const { setProjectMessages, addProjectMessage, projects } = useProjectStore();
  // Deduplicate messages in case of any duplicates from localStorage
  const rawMessages = project.messages || [];
  const messages = Array.from(
    new Map(rawMessages.map((m) => [m.id, m])).values(),
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [collapsedTools, setCollapsedTools] = useState<Set<string>>(new Set());
  const [client, setClient] = useState<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac");

  useEffect(() => {
    if (project.status === "running") {
      const blinkClient = new Client({
        baseUrl: `http://localhost:${project.port}`,
      });
      setClient(blinkClient);
    } else {
      setClient(null);
    }
  }, [project.status, project.port]);

  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, shouldAutoScroll]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      50;
    setShouldAutoScroll(isAtBottom);
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !client || project.status !== "running") return;

    const userMessage: UIMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "user",
      content: input,
      createdAt: new Date(),
    };

    addProjectMessage(project.id, userMessage);
    setInput("");
    setIsLoading(true);
    setIsThinking(true);
    console.log("Setting isThinking to true");
    setShouldAutoScroll(true); // Always scroll when user sends a message

    try {
      // Convert messages to the format expected by Blink runtime
      const formattedMessages = [...project.messages, userMessage].map(
        (msg) => ({
          role: msg.role,
          parts: msg.parts || [
            {
              type: "text",
              text: msg.content,
            },
          ],
        }),
      );

      console.log(
        "Sending messages:",
        JSON.stringify(formattedMessages, null, 2),
      );

      // Use fetch directly to the agent endpoint
      const response = await fetch(
        `http://localhost:${project.port}/_agent/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages: formattedMessages }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      let assistantMessage = "";
      const assistantId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const decoder = new TextDecoder();
      let toolCalls: Array<{ id: string; name: string; input: any }> = [];
      let toolOutputs: Map<string, any> = new Map();
      let hasTools = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Decode the chunk and extract text from SSE format
        const chunk = decoder.decode(value, { stream: true });
        console.log("Received chunk:", chunk);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));

              // Handle text deltas
              if (data.type === "text-delta" && data.delta) {
                assistantMessage += data.delta;
                const currentProject = projects.find(
                  (p) => p.id === project.id,
                );
                const currentMessages = currentProject?.messages || [];
                const existing = currentMessages.find(
                  (m) => m.id === assistantId,
                );
                if (existing) {
                  setProjectMessages(
                    project.id,
                    currentMessages.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: assistantMessage }
                        : m,
                    ),
                  );
                } else {
                  addProjectMessage(project.id, {
                    id: assistantId,
                    role: "assistant",
                    content: assistantMessage,
                    createdAt: new Date(),
                  });
                }
              }

              // Track tool calls
              if (data.type === "tool-input-available") {
                hasTools = true;
                toolCalls.push({
                  id: data.toolCallId,
                  name: data.toolName,
                  input: data.input,
                });
              }

              // Track tool outputs
              if (data.type === "tool-output-available") {
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
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Display tool calls in the UI
        const toolCallsMessage = {
          id: assistantId + "-tools",
          role: "assistant" as const,
          content: toolCalls
            .map((tool) => {
              const output = toolOutputs.get(tool.id);
              return `🔧 **${tool.name}**\n\`\`\`json\nInput: ${JSON.stringify(tool.input, null, 2)}\n\nOutput: ${JSON.stringify(output, null, 2)}\n\`\`\``;
            })
            .join("\n\n"),
          createdAt: new Date(Date.now() + 1), // Ensure it comes after first message
        };

        addProjectMessage(project.id, toolCallsMessage);

        // Collapse tool message by default
        setCollapsedTools((prev) => new Set([...prev, toolCallsMessage.id]));

        // Build assistant message with tool calls in parts format
        const assistantParts: any[] = [];

        if (assistantMessage) {
          assistantParts.push({ type: "text", text: assistantMessage });
        }

        for (const tool of toolCalls) {
          assistantParts.push({
            type: `tool-${tool.name}`,
            toolCallId: tool.id,
            state: "output-available",
            input: tool.input,
            output: toolOutputs.get(tool.id),
          });
        }

        // Add assistant message to messages (for follow-up request context only, don't modify UI)
        const assistantMessageWithTools = {
          id: assistantId,
          role: "assistant" as const,
          parts: assistantParts,
          content: assistantMessage,
          createdAt: new Date(),
        };

        // Make follow-up request with tool results
        const followUpMessages = [
          ...messages,
          userMessage,
          assistantMessageWithTools,
        ].map((msg) => ({
          role: msg.role,
          parts: msg.parts || [
            {
              type: "text",
              text: msg.content,
            },
          ],
        }));

        const followUpResponse = await fetch(
          `http://localhost:${project.port}/_agent/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ messages: followUpMessages }),
          },
        );

        if (!followUpResponse.ok) {
          throw new Error(`HTTP error! status: ${followUpResponse.status}`);
        }

        const followUpReader = followUpResponse.body?.getReader();
        if (!followUpReader) {
          throw new Error("No response body");
        }

        // Read the follow-up response
        let followUpMessage = "";
        const followUpId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        while (true) {
          const { done, value } = await followUpReader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6));

                if (data.type === "text-delta" && data.delta) {
                  followUpMessage += data.delta;
                  const currentProject = projects.find(
                    (p) => p.id === project.id,
                  );
                  const currentMessages = currentProject?.messages || [];
                  const existing = currentMessages.find(
                    (m) => m.id === followUpId,
                  );
                  if (existing) {
                    setProjectMessages(
                      project.id,
                      currentMessages.map((m) =>
                        m.id === followUpId
                          ? { ...m, content: followUpMessage }
                          : m,
                      ),
                    );
                  } else {
                    addProjectMessage(project.id, {
                      id: followUpId,
                      role: "assistant",
                      content: followUpMessage,
                      createdAt: new Date(),
                    });
                  }
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      // Auth dialog will handle authentication errors automatically
      // No need to show alert here
    } finally {
      setIsLoading(false);
      setIsThinking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (project.status !== "running") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-medium">Project Not Running</h3>
          <p className="text-muted-foreground">
            Start the project to begin chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">{project.name}</h2>
        <p className="text-sm text-muted-foreground">Port: {project.port}</p>
      </div>

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              Start a conversation with your agent
            </p>
          </div>
        ) : (
          messages.map((message) => {
            // Check if this is a tool call message (starts with tool emoji and has Input:/Output:)
            const isToolCall =
              message.content.startsWith("🔧 **") &&
              message.content.includes("Input:") &&
              message.content.includes("Output:");

            return (
              <div
                key={message.id}
                className={`flex flex-col ${
                  message.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[75%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : isToolCall
                        ? "bg-muted/50 border border-border"
                        : "bg-muted"
                  }`}
                >
                  <div>
                    {isToolCall ? (
                      <div className="text-xs font-mono space-y-2">
                        <button
                          onClick={() => {
                            const newCollapsed = new Set(collapsedTools);
                            if (newCollapsed.has(message.id)) {
                              newCollapsed.delete(message.id);
                            } else {
                              newCollapsed.add(message.id);
                            }
                            setCollapsedTools(newCollapsed);
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          {collapsedTools.has(message.id) ? (
                            <ChevronRight className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                          <span className="font-semibold">
                            🔧{" "}
                            {message.content.match(/\*\*(.+?)\*\*/)?.[1] ||
                              "Tool Call"}
                          </span>
                        </button>
                        {!collapsedTools.has(message.id) && (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              h2: ({ node, children, ...props }) => {
                                // Hide h2 that contains tool emoji (tool name header)
                                const text = String(children);
                                if (text.includes("🔧")) return null;
                                return <h2 {...props}>{children}</h2>;
                              },
                              pre: ({ node, ...props }) => (
                                <pre
                                  className="text-[10px] overflow-x-auto"
                                  {...props}
                                />
                              ),
                              code: ({ node, ...props }) => (
                                <code className="text-[10px]" {...props} />
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    ) : (
                      <div
                        className={`prose prose-sm max-w-none ${
                          message.role === "user"
                            ? "prose-invert"
                            : "dark:prose-invert"
                        }`}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
                {message.role === "user" ? (
                  <button
                    onClick={() => handleCopy(message.content)}
                    className="mt-1 p-1 text-muted-foreground hover:text-foreground rounded"
                    title="Copy message"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleCopy(message.content)}
                    className="mt-1 p-1 text-muted-foreground hover:text-foreground rounded"
                    title="Copy message"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
        {isThinking && (
          <div className="flex justify-start">
            <div className="rounded-lg px-4 py-2">
              <div className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                ></span>
                <span
                  className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                ></span>
                <span
                  className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                ></span>
              </div>
            </div>
          </div>
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
        <div className="mt-2 flex justify-end">
          <div className="text-xs text-muted-foreground">
            {isMac ? "Cmd" : "Ctrl"}+R: Clears chat
          </div>
        </div>
      </div>
    </div>
  );
};
