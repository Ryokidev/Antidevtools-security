/**
 * server.js
 * Minimal Node.js HTTP server that serves the Guardian.js demo page
 * and the guardian.js library file as static assets.
 */

var http = require('http');
var fs = require('fs');
var path = require('path');

/** @type {number} Port the server binds to. Defaults to 5000. */
var PORT = process.env.PORT || 5000;

/**
 * MIME type map keyed by file extension.
 * @type {Object.<string, string>}
 */
var MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

/**
 * Static route table mapping URL paths to filesystem locations.
 * @type {Object.<string, string>}
 */
var routes = {
  '/':            path.join(__dirname, 'demo', 'index.html'),
  '/index.html':  path.join(__dirname, 'demo', 'index.html'),
  '/guardian.js': path.join(__dirname, 'src', 'guardian.js'),
};

/**
 * HTTP request handler.
 * Resolves the URL against the route table and serves the matching file.
 * Responds with 204 for unknown routes (silently ignores favicon, etc.).
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse}  res
 */
var server = http.createServer(function (req, res) {
  var url = req.url.split('?')[0];
  var filePath = routes[url];

  if (!filePath) {
    res.writeHead(204);
    res.end();
    return;
  }

  var ext = path.extname(filePath);
  var contentType = MIME[ext] || 'text/plain';

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Error');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

/**
 * Start listening on all interfaces.
 */
server.listen(PORT, '0.0.0.0', function () {
  console.log('Guardian.js demo running on port ' + PORT);
});
