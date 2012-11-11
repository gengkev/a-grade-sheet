var pageLoadStart = Date.now();

// https redirect, sir.
if (location.host == 'a-grade-sheet.googlecode.com' && location.protocol != 'https:') {
	location.protocol = 'https:';
}

// Pass the number of callbacks you're expecting, and the callback for all of 
// those callbacks. Then supply waiter.get() where you need a callback.
//
// Or, pass some other value, and supply waiter.get() wherever you need a callback. 
// Then call waiter.run() when you're done, and it will wait for the callbacks to finish.
// 
// Example usage:
//   var waiter = new CallbackWaiter(2, function() {
//     console.log("yay done");
//   });
//   somethingThatRequiresACallback(waiter());
//   somethingElseThatHasACallback(waiter());
//   --------------------------------------------------
//   var waiter = new CallbackWaiter(null, function() {
//     console.log("yay done");
//   });
//   somethingThatRequiresACallback(waiter());
//   somethingElseThatHasACallback(waiter());
//   
//   waiter.run();

function CallbackWaiter(expected, callback) {
	if (!(this instanceof CallbackWaiter)) {
		return new CallbackWaiter(expected, oncomplete);
	}
	
	this._callback = callback;
	this.expected = expected;
	
	this.added = 0;
	this.called = 0;
}
CallbackWaiter.prototype._check = function() {
	if (this.called == this.expected) {
		setTimeout(function() {
			if (this._callback) this._callback.call(null);
		}.bind(this), 0);
	}
};
CallbackWaiter.prototype.get = function() {
	this.added++;
	return function() {
		this.called++;
		this._check();
	}.bind(this);
}
CallbackWaiter.prototype.run = function() {
	this.expected = this.added;
	this._check();
};
CallbackWaiter.prototype.callback = function(callback) {
	this._callback = callback;
	this.run();
};

// apologies in advance for the crappish script loading code.

var loadWaiter = new CallbackWaiter(null, function() {
	angular.bootstrap(document, ['project']);
});

function addScripts(urls, callback) {
	var waiter = new CallbackWaiter(urls.length, callback);
	if (Object.prototype.toString.call(urls) == "[object Array]") {
		var subReadyCalls = 0; // WTF???
		urls.forEach(function(url) {
			var s = document.createElement("script");
			s.onload = waiter.get();
			s.onerror = function() {
				alert("Loading failed!");
			};
			s.setAttribute("async", "async");
			s.setAttribute("src", url);
			document.head.appendChild(s);
		});
	}
	else {
		addScripts([urls]);
	}
}

loadWaiter.get();
addScripts([
	'https://ajax.googleapis.com/ajax/libs/angularjs/1.0.2/angular.min.js'
], function() {
	addScripts([
		'js/project.js',
		'js/drive.js',
		'js/igp_import.js'
	], loadWaiter.get());
});

if (!window.JSON) {
	addScripts('https://cdnjs.cloudflare.com/ajax/libs/json3/3.2.4/json3.min.js', loadWaiter.get());
}

window.gapiReady = loadWaiter.get();
addScripts('https://apis.google.com/js/client.js?onload=gapiReady');

addScripts([
	'https://cdnjs.cloudflare.com/ajax/libs/moment.js/1.7.2/moment.min.js',
	'https://cdnjs.cloudflare.com/ajax/libs/augment.js/0.4.0/augment.min.js'
], loadWaiter.get());

window.addEventListener("load", function() {
	// initialize Google Analytics: fire-and-forget
	var _gaq = [['_setAccount', 'UA-35038306-2'], ['_trackPageview']];
	addScripts('https://ssl.google-analytics.com/ga.js');
});

loadWaiter.run();