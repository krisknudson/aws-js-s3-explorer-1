app.controller('RenameController', function($scope, awsService, cfpLoadingBar, $uibModal, $log, $rootScope) {
    var self = this;
    $scope.item;
    $scope.originalName;
    $scope.newName;
    $scope.errMsg;

    $scope.isFile = function() {
        if($scope.item.prefix) {
            return false;
        }
        return true;
    }

    $scope.open = function () {

        var modalInstance = $uibModal.open({
            templateUrl: 'assets/html/rename.modal.html',
            controller: 'ModalInstanceCtrl',
            backdrop: 'static',
            resolve: {
                item: function () {
                    return $scope.item;
                },
                originalName: function () {
                    return $scope.item.displayName;
                },
                newName: function () {
                    return $scope.item.displayName;
                },
                existingItems: function () {
                    if($scope.item.prefix) {
                        return $scope.folders;
                    } else {
                        return $scope.files;
                    }
                },
                itemType: function () {
                    if($scope.item.prefix) {
                        return "folder";
                    } else {
                        return "file";
                    }
                },
                errMsg: function () {
                    return $scope.errMsg;
                }
            }
        });

        modalInstance.result.then(function (newName) {
            cfpLoadingBar.start();
            $scope.newName = newName;
            if($scope.item.prefix) {
                var newPrefix = $scope.currentFolder + $scope.newName + "/";
                self.renameFolder($scope.item.prefix, newPrefix);
            } else {
                var newPrefix = $scope.currentFolder + $scope.newName;
                awsService.renameFile($scope.item.key, newPrefix, function (response) {
                    $rootScope.$emit('refresh', $scope.currentFolder);
                    cfpLoadingBar.complete();
                });
            }
        }, function () {
        });
    };

    this.renameFolder = function(oldPrefix, newPrefix) {
        awsService.listObjects({Prefix: oldPrefix}, function (response) {
            if (response.Contents.length) {
                var renameFiles = [];
                response.Contents.forEach(function (element) {
                    renameFiles.push({key: element.Key, oldPrefix: oldPrefix, newPrefix: newPrefix});
                });
                app.async(renameFiles, self.moveFileProcessor).then(function(result){
                    var copiedObjects = [];
                    result.forEach(function (element) {
                        copiedObjects.push({Key: element.key});
                    });
                    awsService.deleteObjects(copiedObjects, function() {
                        $rootScope.$emit('refresh', $scope.currentFolder);
                    });
                });
            }
        }, true);
    };

    this.moveFileProcessor = function(deferred, element) {
        var renameFile = element;
        var destination = renameFile.key.replace(renameFile.oldPrefix, renameFile.newPrefix);
        awsService.copyObject(renameFile.key, destination, function () {
            deferred.resolve(renameFile);
        });
        return deferred.promise;
    };
});

app.controller('ModalInstanceCtrl', function ($scope, $uibModalInstance, item, originalName, newName, errMsg, existingItems, itemType, utilService) {

    $scope.item = item;
    $scope.originalName = originalName;
    $scope.newName = newName;
    $scope.errMsg = errMsg;

    $scope.rename = function () {
        if ($scope.item.displayName !== $scope.newName) {
            if(utilService.isExisted(existingItems, $scope.newName)) {
                $scope.errMsg = '[' + $scope.newName + '] is already existed';
                return;
            } if (!utilService.isValidName($scope.newName)) {
                $scope.errMsg = '[' + $scope.newName + '] is an invalid name. Cannot contains / \ : * ? " < > |';
                return;
            } else {
                $uibModalInstance.close($scope.newName);
            }
        }
    };

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };
});