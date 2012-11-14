window.errorHandler = function(error) {
	alert("Oops, something went wrong: \n"+error);
}

angular.module('project', ['drivedb'])
	.config(function($routeProvider, $locationProvider) {
		$locationProvider.html5Mode(true);
		$routeProvider
			.when('/', {controller: LandingCtrl, templateUrl: '/landing.html'})
			.when('/view/:courseId', {controller: ViewCtrlMain, templateUrl: '/view.html'})
			.when('/view/:courseId/:sheetId', {controller: ViewCtrl, templateUrl: '/view.html'})
			.when('/import', {controller: ImportCtrl, templateUrl: '/import.html'})
			.when('/settings', {controller: SettingsCtrl, templateUrl: '/settings.html'})
			.otherwise({redirectTo: '/'});
	});

function MainCtrl($scope, $location, $window, Database) {
	$scope.overlay = true;
	$scope.active = null;
	$scope.courses = Database.list;
	
	$scope.refresh = function() {
		if ($scope.refreshing) return;
		$scope.refreshing = true;
		Database.loadList(); // will emit updatedList
	};
	
	$scope.$on('updatedList', function() {
		$scope.refreshing = false;
		$scope.courses = Database.list;
		$scope.$digest();
	});
	$scope.$on('navChange', function(e, newId) {
		$scope.active = newId || null;
	});
	$scope.onPage = function(page) {
		return $location.path() == '/' + page;
	};
	
	$scope.$on('pageLoad', function() {
		console.log("time to finish load:", Date.now() - pageLoadStart);
		
		$scope.pageLoaded = true;
		$scope.logged_in = Database.logged_in;
		
		var query = "&" + $window.location.search.substring(1);
		var state = (query.split("&state=")[1] || "").split("&")[0];
		
		if (state) {
			try {
				state = $window.JSON.parse($window.decodeURIComponent(state));
			} catch(e) {}
			console.log(state);
			
			if (state.action == "create") {
				$scope.newCourse();
			} else if (state.action == "open") {
				$location.path("/view/" + state.ids[0]);
			} else {
				console.error("invalid state");
				$window.location.search = "";
			}
		}
		
		$scope.overlay = false;
		$scope.$apply();
	});
	$scope.authorize = function(force) {
		if (typeof force != "boolean") {
			force = true;
		}
		Database.authorize(force, function(success, authResult) {
			if (!success && force) {
				alert("Authorization failed!");
				return;
			}
			$scope.logged_in = Database.logged_in;
			Database.loadList();
		});
	};
	
	$scope.newCourse = function() {
		var title = prompt("New file title?");
		Database.newFile({title: title}, function(id) {
			if (!id) {
				alert("Creating new file failed!");
				return;
			}
			$location.path("/view/" + id);
		});
	};
	$scope.navigate = function(path) {
		$location.path(path);
	};
}
function LandingCtrl($scope, $location, Database) {
	$scope.$emit('navChange');
}
function ImportCtrl($scope, $window, $location, Database) {
	$scope.uploadJsonFile = function() {
		var fr = new FileReader();
		fr.onload = function(e) {
			Database.newFile({file: fr.result}, function(id) {
				if (!id) {
					alert("Creating new file failed!");
					return;
				}
				$location.path("/view/" + id);
			});
		};
		fr.onerror = function(e) {
			console.warn("File read failed", e);
			alert("File read failed!");
		};
		// I'm sorry, AngularJS gods!
		fr.readAsText(document.getElementById("jsonFile").files[0]);
	};
}
function SettingsCtrl($scope, $window, $http, Database) {
	$scope.$emit('navChange');
	
	$scope.revokeAccess = function() {
		// lol why do they allow GETs for this
		$http.get("https://accounts.google.com/o/oauth2/revoke?token="
			+ Database.getAccessToken()
		).success(function(data, status) {
			// this will never happen, but anyway
			$scope.authorize(false);
		}).error(function(data, status) {
			// ACAO doesn't allow it... but it works anyway -_- troll
			$scope.authorize(false);
		});
	};
	
	$scope.getAccessToken = function() { return Database.getAccessToken(); };
}
function ViewCtrlMain($routeParams, $location) {
	$location.path('/view/' + $routeParams.courseId + '/0');
}
function ViewCtrl($scope, $location, $routeParams, Database) {
	if (!$scope.pageLoaded) {
		$scope.$on('pageLoad', function() {
			return ViewCtrl($scope, $location, $routeParams, Database);
		});
		return;
	} else if (!$scope.logged_in) {
		$location.path('/');
		return;
	}
	
	var courseId = $routeParams.courseId;
	$scope.courseId = courseId;
	$scope.$emit('navChange', courseId);
	
	$scope.currentId = $routeParams.sheetId;
	
	Database.loadFile(courseId, function(result) {
		if (!result) {
			alert("Loading file failed!");
			$location.path('/');
			return;
		}
		$scope.info = result.info;
		$scope.sheets = result.sheets;
		
		if (!Array.isArray($scope.sheets) || $scope.sheets.length == 0) {
			// idk?
			$location.path('/');
			return;
		} else if (!$scope.sheets[$scope.currentId]) {
			// uh oh, redirect to 0
			$location.path('/view/' + courseId + '/0');
			return;
		}
		
		$scope.current = $scope.sheets[$scope.currentId];
	});
	
	$scope.delete = function() {
		Database.deleteFile($scope.courseId, $scope.refresh);
	};
}