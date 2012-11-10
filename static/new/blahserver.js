var http = require('http');
var path = require('path');
var fs = require('fs');

var port = parseInt(function() {
	var args = process.argv.slice(2);
	
	for (var i=0;i<args.length;i++) {
		var params = args[i].split("=",2);
		if ((/-{0,2}port/i).test(params[0])) {
			return params[1];
		}
	}
}());
if ( !(0 <= port && port <= 65535) ) {
	port = 8080;
}

http.createServer(function(req,res) {
	var filePath = req.url.replace(/^\/*/,'').replace(/(\?.*)?(#.*)?$/,'');
	
	if (!(/[a-zA-Z0-9_\-.]*/).test(filePath)) {
		res.writeHead(400);
		res.writeEnd('400 Bad Request');
	}
	
	var extname = path.extname(filePath);
	var contentType = '';
	switch(extname) {
		case '.html':
			contentType = 'text/html';
			break;
		case '.js':
			contentType = 'text/javascript';
			break;
		case '.css':
			contentType = 'text/css';
			break;
	}
	
	path.exists(filePath,function(exists) {
		if (exists) {
			fs.readFile(filePath,function(error, result) {
				if (error) {
					res.writeHead(500);
					res.end('500 Internal Server Error');
				} else {
					res.writeHead(200, { 'Content-Type': contentType });
					res.end(result,'utf-8');
				}
			});
		} else {
			res.writeHead(404);
			res.end('404 Not Found');
		}
	});
}).listen(port, '127.0.0.1');

console.log('Server running at http://localhost:'+port);
