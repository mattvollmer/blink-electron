const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PROXY_PORT || 3000;
const TARGET_PORT = process.env.TARGET_PORT || 3001;
const TARGET_HOST = 'localhost';

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Proxy the request
  const proxyReq = http.request(
    {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      // Copy status code
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      
      // Pipe the response
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    res.writeHead(502);
    res.end('Bad Gateway');
  });

  // Pipe the request
  req.pipe(proxyReq);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`CORS proxy listening on http://127.0.0.1:${PORT}`);
  console.log(`Proxying to http://${TARGET_HOST}:${TARGET_PORT}`);
});
