var app = angular.module('s3explorer', ['ngAnimate','ui.bootstrap', 'cfp.loadingBar', 'ngRoute', 'infinite-scroll']);

app.config(['cfpLoadingBarProvider', function(cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;
}]);

app.config(function($locationProvider) {
    $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
    });
});

app.run(function($q, $rootScope){
    /** Operations will be performed synchronous**/
    app.lineUp = function(objects, processor, callback) {
          var currentRequest = 0;
          var deferred = $q.defer();
          var results = [];

          function makeNextRequest() {
                var object = objects[currentRequest];
                callback && callback(object);
                processor($q.defer(), object, currentRequest, objects)
                    .then(function(modifiedObject){
                        results.push(modifiedObject);
                        currentRequest++;
                        if (currentRequest < objects.length){
                            makeNextRequest();
                        } else {
                            deferred.resolve(results);
                        }
                    });
          }
          makeNextRequest();
          return deferred.promise;
    };

    /** Operations will be performed asynchronous**/
    app.async = function(objects, processor) {
          var currentRequest = 0;
          var deferred = $q.defer();
          var results = [];
          objects.forEach(function(object){
              processor($q.defer(), object, currentRequest, objects)
                  .then(function(modifiedObject){
                      results.push(modifiedObject);
                      currentRequest++;
                      if (currentRequest === objects.length){
                          deferred.resolve(results);
                      }
                  });
          });
          return deferred.promise;
    };

});

