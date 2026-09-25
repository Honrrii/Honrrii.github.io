const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8'};
const allowed = new Set(['index.html', 'styles.css', 'script.js']);
http.createServer((req, res) => {
  const filename = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!allowed.has(filename)) {res.writeHead(404);res.end('Not found');return;}
  fs.readFile(path.join(__dirname, filename), (error, data) => {
    if (error) {res.writeHead(500);res.end('Unable to load file');return;}
    res.writeHead(200, {'Content-Type':types[path.extname(filename)], 'Cache-Control':'no-store'});
    res.end(data);
  });
}).listen(4173, '0.0.0.0', () => console.log('Portfolio preview: http://localhost:4173'));
