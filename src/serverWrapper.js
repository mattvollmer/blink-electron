// This wrapper starts the Blink agent with CORS enabled
const http = require('http');
const path = require('path');

// Get the project directory and port from arguments
const projectPath = process.argv[2];
const port = process.argv[3] || process.env.PORT || 3000;

if (!projectPath) {
  console.error('Usage: node serverWrapper.js <project-path> <port>');
  process.exit(1);
}

// Change to project directory
process.chdir(projectPath);

// Import the built agent
const agentPath = path.join(projectPath, '.blink/build/agent.js');

try {
  // Set environment variables
  process.env.PORT = port;
  process.env.HOST = '127.0.0.1';
  
  console.log(`Starting Blink agent on port ${port}...`);
  
  // Import and run the agent
  // The agent.js file calls agent.serve() which returns an http.Server
  require(agentPath);
  
  // Intercept the HTTP server creation to add CORS
  const originalCreateServer = http.createServer;
  http.createServer = function(requestListener) {
    return originalCreateServer(function(req, res) {
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      // Call original handler
      return requestListener(req, res);
    });
  };
  
  console.log(`Agent running at http://127.0.0.1:${port}`);
} catch (error) {
  console.error('Failed to start agent:', error);
  process.exit(1);
}
