import React, { useState, useEffect, useRef } from "react";
import { Client } from "blink/client";
import { BlinkProject, useProjectStore } from "../store/projectStore";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { toast } from "sonner";
import {
  Send,
  ChevronRight,
  ChevronDown,
  Copy,
  Square,
  Play,
  Info,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

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
  const activeControllersRef = useRef<Set<AbortController>>(new Set());

  const addController = (ctrl: AbortController) => {
    activeControllersRef.current.add(ctrl);
    setIsLoading(true);
  };

  const removeController = (ctrl: AbortController) => {
    activeControllersRef.current.delete(ctrl);
    setIsLoading(activeControllersRef.current.size > 0);
  };

  const abortAllControllers = () => {
    for (const ctrl of activeControllersRef.current) {
      try {
        ctrl.abort();
      } catch {}
    }
    activeControllersRef.current.clear();
    setIsLoading(false);
    setIsThinking(false);
  };

  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toLowerCase().includes("mac");
  const mode = project.mode ?? "run";
  const toggleMode = () => {
    const { updateProject } = useProjectStore.getState();
    console.log(
      `[Mode Toggle] Switching from ${mode} to ${mode === "run" ? "edit" : "run"}`,
    );
    const newMode = mode === "run" ? "edit" : "run";
    updateProject(project.id, { mode: mode === "run" ? "edit" : "run" });
    toast.info(`Switched to ${newMode === "edit" ? "Edit" : "Run"} mode`, {
      description:
        newMode === "edit"
          ? "AI will help you build and modify your agent code"
          : "Chat with your agent to see how it behaves",
    });
  };

  useEffect(() => {
    const targetPort =
      mode === "edit" && project.editPort ? project.editPort : project.port;
    console.log(
      `[Client Init] Mode: ${mode}, Using port: ${targetPort}, editPort: ${project.editPort}, runPort: ${project.port}`,
    );
    const blinkClient = new Client({
      baseUrl: `http://127.0.0.1:${targetPort}`,
    });
    setClient(blinkClient);
  }, [project.status, project.port, project.editPort, mode]);

  // Handle app-level stop-streams (fired before Cmd/Ctrl+R clears chat)
  useEffect(() => {
    const unsubscribe = window.electronAPI.onStopStreams(() => {
      abortAllControllers();
    });
    return unsubscribe;
  }, []);

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

  const handleStop = () => {
    abortAllControllers();
  };

  const handleSend = async () => {
    if (!input.trim() || !client) return;

    console.log(
      `[handleSend] Mode: ${mode}, Client baseUrl: ${client.baseUrl}`,
    );
    const userMessageContent = input.trim();
    const userMessage: BlinkProject["messages"][0] = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: "user",
      content: userMessageContent,
      createdAt: new Date(),
      metadata: { mode }, // Store which mode this message was sent in
    };

    addProjectMessage(project.id, userMessage);
    setInput("");
    setIsLoading(true);
    setIsThinking(true);
    setShouldAutoScroll(true); // Always scroll when user sends a message

    const ctrl = new AbortController();
    addController(ctrl);

    try {
      // Convert messages to the format expected by Blink runtime
      const formattedMessages = messages.concat([userMessage]).map((msg) => ({
        id: msg.id,
        role: msg.role,
        parts: [
          {
            type: "text" as const,
            text: msg.content,
          },
        ],
      }));

      // Use fetch directly to the agent endpoint
      const response = await fetch(
        `http://localhost:${project.port}/_agent/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ messages: formattedMessages }),
          signal: ctrl.signal,
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
        const ctrl2 = new AbortController();
        addController(ctrl2);
        try {
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
          ].map((msg: any) => ({
            role: msg.role,
            parts: msg.parts ?? [
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
        } catch (err) {
          // Handle follow-up request error
        } finally {
          removeController(ctrl2);
        }
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("Error sending message:", error);
      }
    } finally {
      removeController(ctrl);
      setIsThinking(activeControllersRef.current.size > 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        void handleSend();
      }
    }
  };

  if (project.status !== "running") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          {project.status === "starting" ? (
            <>
              <h3 className="text-lg font-medium">Starting Agent...</h3>
              <p className="text-muted-foreground">
                Please wait while the agent starts up
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-medium">Agent Not Running</h3>
              <p className="text-muted-foreground">
                Start the agent to begin chatting
              </p>
              <Button
                onClick={async () => {
                  const { updateProject } = useProjectStore.getState();
                  updateProject(project.id, { status: "starting" });
                  const result = await window.electronAPI.startBlinkProject(
                    project.id,
                    project.path,
                    project.port,
                  );
                  if (result.success) {
                    updateProject(project.id, {
                      status: "running",
                      editPort: result.editPort,
                    });
                  } else {
                    updateProject(project.id, { status: "error" });
                  }
                }}
                className="mt-4"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Agent
              </Button>
            </>
          )}
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
                {message.metadata?.mode && (
                  <span
                    className={`text-[10px] mb-1 px-2 py-0.5 rounded ${
                      message.metadata.mode === "edit"
                        ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                        : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {message.metadata.mode === "edit"
                      ? "Edit Mode"
                      : "Run Mode"}
                  </span>
                )}
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
          <div className="flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className={
                mode === "edit"
                  ? "border-yellow-500 focus-visible:ring-yellow-500"
                  : undefined
              }
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <TooltipProvider>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <div
                      className={
                        mode === "edit"
                          ? "text-yellow-500 flex items-center gap-1"
                          : "text-muted-foreground flex items-center gap-1"
                      }
                    >
                      Mode: {mode === "run" ? "Run" : "Edit"}
                      <Info className="w-3 h-3" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start">
                    {mode === "run" ? (
                      <p>Chat with your agent to see how it behaves</p>
                    ) : (
                      <p>AI helps you build and modify your agent code</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="text-muted-foreground flex gap-3">
                <span>
                  {isMac ? "Cmd" : "Ctrl"}+E: Switch to{" "}
                  {mode === "run" ? "Edit" : "Run"}
                </span>
                <span>{isMac ? "Cmd" : "Ctrl"}+R: Clears chat</span>
              </div>
            </div>
          </div>
          <Button
            onClick={input.trim() ? handleSend : handleStop}
            disabled={!isLoading && !input.trim()}
          >
            {isLoading && !input.trim() ? (
              <Square className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
