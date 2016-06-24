app.controller("DeleteController", function($scope, $uibModal, $log, awsService, cfpLoadingBar, utilService, $rootScope) {
    var self = this;

    $scope.showConfirm = function (size, objects) {
        var modalInstance = $uibModal.open({
            keyboard: true,
            animation: false,
            templateUrl: 'assets/html/delete.modal.html',
            controller: 'ConfirmModalController',
            size: size,
            backdrop: 'static',
            resolve: {
                parameters: function() {
                    return {
                        files: $scope.files,
                        folders: $scope.folders,
                        currentFolder: $scope.currentFolder,
                        objects: objects
                    }
                }
            }
        });

    };

});

app.controller("ConfirmModalController", function($scope, $uibModalInstance, parameters, utilService, awsService, $rootScope){

    var self = this;
    this.currentFolder = parameters.currentFolder;
    $scope.deleting = false;
    $scope.progress = 'Collecting data...';

    $scope.close = function() {
       $uibModalInstance.dismiss('Cancel');
    }

    $scope.ok = function () {
        $scope.deleting = true;
        var objects = parameters.objects;
        if(objects){
            self.deleteAnObject(objects);
        }else {
            self.deleteObjects();
        }
    }

    this.deleteAnObject = function (obj) {
        if(obj.prefix) {
            var selectedFiles = [];
            awsService.listObjects({Delimiter: '', Prefix: obj.prefix}, function(response) {
                response.Contents.forEach(function(element) {
                    selectedFiles.push({Key: element.Key})
                });

                awsService.deleteObjects(selectedFiles, function(response) {
                    self.updateUI();
                }, self.updateProgress);
            }, true)
        } else {
            awsService.deleteAnObject(obj.key, function(response){
                $uibModalInstance.close();
                $rootScope.$emit('refresh', self.currentFolder);
            });
        }
    };

    this.deleteObjects = function() {
        var selectedObjects = [],
            folders = parameters.folders,
            files = parameters.files;
        var selectedFolders = utilService.getSelectedObjects(folders);
        files.forEach(function(file) {
            if(file.isSelected) {
                selectedObjects.push({Key: file.key});
            }
        })

        if(selectedFolders.length > 0) {
            app.async(utilService.getSelectedObjects(folders), self.getSubObjects).then(function(result){
                result.forEach(function(element){
                    var children = element.children;

                    children.forEach(function(child) {
                        selectedObjects.push(child);
                    })
                })

                awsService.deleteObjects(selectedObjects, function(response) {
                    self.updateUI();
                },self.updateProgress);
            })
        } else {
            awsService.deleteObjects(selectedObjects, function(response) {
                self.updateUI();
            },  self.updateProgress);
        }
    };

    this.getSubObjects = function(deferred, folder, currentRequest, objects) {
        var obj = folder;
        obj.children = [];

        awsService.listObjects({Delimiter: '', Prefix: obj.prefix}, function(response) {
            response.Contents.forEach(function(element) {
                obj.children.push({Key: element.Key})
            });
            deferred.resolve(obj);
        }, true);
        return deferred.promise;
    }

    this.updateProgress = function(done, total) {
        $scope.progress = done + "/" + total;
    }

    this.updateUI = function() {
        setTimeout(function(){
            $uibModalInstance.close();
            $rootScope.$emit('refresh', self.currentFolder);
            }, 1000);
    }
});