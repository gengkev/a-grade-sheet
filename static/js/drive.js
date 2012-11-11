angular.module('drivedb', [])
	.config(function($httpProvider) {
		// derpwhales just makes CORS worse
		delete $httpProvider.defaults.headers.common['X-Requested-With'];
	})
	.run(function($window, $rootScope, Database) {
		var waiter = new $window.CallbackWaiter();
		
		Database.authorize(false, waiter.get());
		$window.gapi.client.load('drive', 'v2', waiter.get());
		
		waiter.callback(function() {
			Database.loadList(function() {
				setTimeout(function() {
					$rootScope.$broadcast('pageLoad');
				}, 0);
			});
		});
	})
	.factory('Database', function($window, $rootScope, $http) {
		const CLIENT_ID = '105228524875.apps.googleusercontent.com';
		const SCOPES = 'https://www.googleapis.com/auth/drive.install https://www.googleapis.com/auth/drive.file';
		const MIME_TYPE = 'application/vnd.a-grade-sheet.course+json';
		const AUTH_SERVER_URL = "https://a-grade-sheet.herokuapp.com/a-grade-sheet-auth";
		
		function trimFileData(item) {
			if (!item.editable || item.labels.trashed || item.mimeType != MIME_TYPE) {
				return false;
			}
			return {
				name: item.title,
				description: item.description,
				id: item.id,
				downloadUrl: item.downloadUrl,
				lastModified: item.modifiedDate
			}
		}
		
		// I guess Database should be storing an in-memory copy of some basic file metadata
		// since list is going to be queried pretty often... and do callbacks for other stuff
		var database = {
			list: [],
			getFileIndex: function(id) {
				for (var i = 0; i < database.list.length; i++) {
					if (database.list[i].id == id) {
						return i;
					}
				}
			},
			newFile: function(parentId, title, callback) {
				const boundary = 'less-than-3';
				const delimiter = "\r\n--" + boundary + "\r\n";
				const close_delim = "\r\n--" + boundary + "--";
				
				var metadata = {
					"title": title,
					"mimeType": MIME_TYPE
				};
				var base = {
					"application": "a-grade-sheet",
					"version": "0.1",
					"info": {
						"name": title
					}
				};
				var multipartRequestBody =  
					delimiter +
					'Content-Type: application/json\r\n\r\n' +
					JSON.stringify(metadata) +
					delimiter +
					'Content-Type: ' + MIME_TYPE + '\r\n\r\n' +
					JSON.stringify(base) +
					close_delim;
				
				$window.gapi.client.request({
					'path': '/upload/drive/v2/files',
					'method': "POST",
					'headers': {
						'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
					},
					'body': multipartRequestBody
				}).execute(function(resp) {
					if (!resp || resp.error) {
						console.warn("api request for newFile failed", resp.error);
						if (callback) callback(false);
						return;
					}
					
					var fileData = trimFileData(resp);
					if (!fileData) {
						console.warn("parse data for newFile failed");
						if (callback) callback(false);
						return;
					}
					
					database.list.push(fileData);
					$rootScope.$broadcast('updatedList');
					callback(resp.id);
				});
			},
			loadFileData: function(id) {
				var index = database.getFileIndex(id);
				var file = database.list[index];
				return file;
			},
			loadFile: function(id, callback) {
				var index = database.getFileIndex(id);
				var file = database.list[index];
				$window.gapi.client.drive.files.get({fileId: id}).execute(function(resp) {
					if (!resp || resp.error) {
						console.warn("api request for loadFile failed", resp.error);
						if (callback) callback(false);
						return;
					}
					
					// while we're at it, refresh file data in db
					var fileData = trimFileData(resp);
					if (!fileData) {
						console.warn("parse data for loadFile failed");
						if (callback) callback(false);
						return;
					}
					
					database.list[index] = fileData;
					
					// we should have an item now
					$http({
						method: "GET",
						url: resp.downloadUrl,
						headers: {"Authorization": "Bearer " + database.getAccessToken()}
					}).success(function(data, status) {
						database.list[index].sheets = data.sheets;
						console.log("loadFile result", data, status);
						if (callback) callback(data);
					}).error(function(data, status) {
						console.warn("http request for loadFile failed", data, status);
						if (callback) callback(false);
						return;
					});
				});
			},
			updateFile: function(id, metadata, json, callback) {
				
			},
			deleteFile: function(id, callback) {
				var file = database.loadFileData(id);
				$window.gapi.client.drive.files.delete({fileId: id}).execute(function(resp) {
					if (!resp || resp.error) {
						console.warn("api request for deleteFile failed", resp);
						callback(false);
						return;
					}
					
					callback(true);
				});
			},
			loadList: function(callback) {
				$window.gapi.client.drive.files.list({}).execute(function(resp) {
					if (!resp || resp.error || !resp.items) {
						console.warn("api request for loadList failed", resp);
						if (callback) callback(false);
						database.list = [];
						$rootScope.$broadcast('updatedList'); // yeah, right.
						return;
					}
					console.log("loadList result", resp);
					var result = [];
					resp.items.forEach(function(item) {
						var fileData = trimFileData(item);
						if (!fileData) {
							// we can just skip it
							return;
						}

						result.push(trimFileData(item));
					});
					database.list = result;
					if (callback) callback(result);
					$rootScope.$broadcast('updatedList');
				});
			},
			logged_in: false,
			authorize: function(force, callback) {
				// this is a load of crap
				// we have a setTimeout(func, 0) because sometimes attempting auth right after load fails
				// also, for the force option, we have the web server flow, which is great fun, and calls my server
				// but that might as well break at any time because using that here isn't documented bleh
				setTimeout(function() {
					var params = {'client_id': CLIENT_ID, 'scope': SCOPES, 'immediate': !force};
					if (force) {
						params.response_type = 'code';
						
						// don't actually need, but otherwise we get a prompt on opening files from Drive
						params.access_type = 'offline';
					}
					$window.gapi.auth.authorize(params, function(authResult) {
						if (authResult && !authResult.error) {
							if (force) {
								$http({
									method: "POST",
									url: AUTH_SERVER_URL,
									data: "code=" + authResult.code,
									headers: {"Content-Type": "application/x-www-form-urlencoded"}
								}).success(function(data, status) {
									console.log(data);
									$window.gapi.auth.setToken(data);
									database.logged_in = true;
									if (callback) callback(true, data);
								}).error(function(data, status) {
									console.warn("authentication attempt failed", data);
									database.logged_in = false;
									if (callback) callback(false, data);
								});
							} else {
								database.logged_in = true;
								if (callback) callback(true, authResult);
							}
						} else {
							console.warn("authentication attempt failed", arguments);
							database.logged_in = false;
							if (callback) callback(false, authResult);
						}
					});
				}, 0);
			},
			getAccessToken: function() {
				var token = $window.gapi.auth.getToken();
				if (token) return token.access_token;
				else return null;
			}
		};
		return database;
	});