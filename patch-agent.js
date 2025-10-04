// Quick script to patch agent.ts with logging
const fs = require('fs');
const path = process.argv[2];

if (!path) {
  console.error('Usage: node patch-agent.js <project-path>');
  process.exit(1);
}

const agentPath = `${path}/agent.ts`;
let content = fs.readFileSync(agentPath, 'utf-8');

// Add logging before convertToModelMessages
content = content.replace(
  'agent.on("chat", async ({ messages }) => {',
  'agent.on("chat", async (data) => {\n  console.log("[AGENT] Received data:", JSON.stringify(data, null, 2));\n  const { messages } = data;\n  if (!messages) {\n    console.error("[AGENT] ERROR: messages is undefined!");\n    console.error("[AGENT] Full data:", data);\n  }'
);

fs.writeFileSync(agentPath, content);
console.log('Patched agent.ts with logging');
