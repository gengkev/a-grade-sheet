var express = require('express'),
    http = require('http'),
    https = require('https'),
    path = require('path'),
    querystring = require('querystring');

var app = express();

app.configure(function(){
    app.set('port', process.env.PORT || 6060);
    app.set('views', __dirname + '/views');
    // app.set('view engine', 'jade');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
    app.use(express.errorHandler());
});

app.get('/', function(req, res) {
    res.render('index.ejs');
});
app.options('/a-grade-sheet-auth', function(req, res) {
   res.setHeader("Access-Control-Allow-Origin", "*");
   res.setHeader("Access-Control-Allow-Headers", "Content-Type");
   res.end();
});
app.post('/a-grade-sheet-auth', function(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    var code = req.body.code;
    if (!code) {
        res.statusCode = 400;
        res.end("400 Bad Request");
    }
    var req2 = https.request({
       'host': 'accounts.google.com',
       'port': 443,
       'path': '/o/oauth2/token',
       'method': 'POST',
       'headers': {'Content-Type': 'application/x-www-form-urlencoded'}
    }, function(res2) {        
        var statusCode = res2.statusCode;
		var data = '';
        res2.on("data", function(chunk) {
            data += chunk;
        });
        res2.on("end", function() {
            res.statusCode = statusCode;
            res.end(data);
        });
    });
    var bla = querystring.stringify({
		"code": code,
		"client_id": "105228524875.apps.googleusercontent.com",
		"client_secret": "Dj4dkoGYQM3t9qkbSBocp35Y",
		"redirect_uri": "postmessage",
		"grant_type": "authorization_code"
    });
    req2.end(bla);
});

http.createServer(app).listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
});
