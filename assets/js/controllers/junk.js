collectSelectedFiles = function($q, awsService, items) {
    var selectedFiles = [];
    var rootDeferred = $q.defer();
    var isFolder = function(item) {
        return item.prefix;
    }

    // if "all" is true, the function will collect all files regardless that it's selected or not
    var collectFiles = function(deferred, item, all) {
        var files = [];

        if(item.isSelected | all) {
            if(isFolder(item)) {
                awsService.listObjects({Delimiter: '', Prefix: item.prefix},
                    function(response){
                        response.Contents.forEach(function(element) {
                            files.push({Key : element.Key});
                        });
                        deferred.resolve(files);
                    },
                    true);
            } else {
                files.push({Key : item.key});
                deferred.resolve(files);
            }
        }
        return deferred.promise;
    }

    if(angular.isArray(items)) {
        app.async(items, collectFiles)
            .then(function(results){
                angular.forEach(results, function(result, key){
                    if(angular.isArray(result) && result.length > 0) {
                        selectedFiles = selectedFiles.concat(result);
                    } else {
                        selectedFiles.push(result);
                    }
                });
                rootDeferred.resolve(selectedFiles);
            });
    } else {
        collectFiles($q.defer(), items, true)
            .then(function(results){
                selectedFiles = selectedFiles.concat(results);
                rootDeferred.resolve(selectedFiles);
            });
    }
    return rootDeferred.promise;
}

showConfirm = function ($uibModal, size, objects, callback) {
    var modalInstance = $uibModal.open({
        keyboard: true,
        animation: false,
        templateUrl: 'assets/html/junk.modal.html',
        controller: function($scope, $uibModalInstance, objects){
            $scope.objects = objects;
            $scope.message = "Are you sure ?";
            $scope.cancel = function() {
               $uibModalInstance.dismiss('Cancel');
            }

            $scope.ok = function () {
                $uibModalInstance.close($scope.objects);
            }
        },
        size: size,
        resolve: {
            objects: function () {
                return objects;
            }
        }
    });

    modalInstance.result.then(function (objects) {
        callback && callback(objects);
    }, function () {
        $log.info('Modal dismissed at: ' + new Date());
    });
};

app.run(function($rootScope,$q , $uibModal, cfpLoadingBar, awsService){
     var callback = function(err, data){
        if(err) {
           console.log('err', err);
        }
        cfpLoadingBar.complete();
        $rootScope.$emit('refresh');
     };

    $rootScope.$on('JunkRestore', function(evt, items) {
        showConfirm($uibModal, 'sm',items, function(items){
            cfpLoadingBar.start();
            collectSelectedFiles($q, awsService, items)
                .then(function(results){
                    awsService.moveJunk(results, true, callback);
                });
        });

    });

    $rootScope.$on('JunkDelete', function(evt, items) {
        showConfirm($uibModal, 'sm',items, function(items){
            cfpLoadingBar.start();
            collectSelectedFiles($q, awsService, items)
                .then(function(results){
                    awsService.deleteObjectWithoutBackup(results, callback);
                });
        });

    });
});

