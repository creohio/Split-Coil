const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, 'boards.json');

let state = loadState();
let clients = [];

function loadState(){
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveState(){
  fs.writeFileSync(FILE, JSON.stringify(state || {}, null, 2));
}

function sendFile(res, filePath, contentType){
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function broadcast(msg){
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  clients.forEach(c => c.write(data));
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // 🔄 SSE stream
  if (url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    clients.push(res);

    // send current state
    res.write(`data: ${JSON.stringify({ type: 'hello', state })}\n\n`);

    req.on('close', () => {
      clients = clients.filter(c => c !== res);
    });

    return;
  }

  // 💾 Save state
  if (url === '/patch' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        state = data.state;
        saveState();
        broadcast({ type: 'patch', state });
        res.writeHead(200);
        res.end('OK');
      } catch (e) {
        res.writeHead(400);
        res.end('Bad JSON');
      }
    });
    return;
  }

  // 📄 Serve HTML
  if (url === '/') {
    return sendFile(res, path.join(__dirname, 'Split coil.html'), 'text/html');
  }

  // 🧾 Static files (optional future use)
  const filePath = path.join(__dirname, url);
  const ext = path.extname(filePath).toLowerCase();

  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css'
  };

  if (fs.existsSync(filePath)) {
    return sendFile(res, filePath, types[ext] || 'application/octet-stream');
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});