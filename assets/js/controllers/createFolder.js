app.controller('CreateFolderCtrl', function ($scope, awsService, utilService, $uibModalInstance, currentFolder, existingFolders) {
    var self = this;
    $scope.currentFolder = currentFolder;
    $scope.existingFolders = existingFolders;
    $scope.folderName;
    $scope.errMsg;

    this.create = function(){
        self.processing = true;
        if(!$scope.folderName) {
            $scope.errMsg = 'folder name is required';
            return;
        } else {
             $scope.errMsg = '';
        }

        if(utilService.isExisted($scope.existingFolders, $scope.folderName)) {
            $scope.errMsg = '[' + $scope.folderName + '] is already existed';
            return;
        } if (!utilService.isValidName($scope.folderName)) {
            $scope.errMsg = '[' + $scope.folderName + '] is an invalid name. Cannot contains / \ : * ? " < > |';
            return;
        }
        else {
            awsService.createFolder($scope.currentFolder, $scope.folderName, function(err, data){
                self.processing = false;
                if(err) {
                    $scope.errMsg = err;
                    return;
                } else {
                     $uibModalInstance.close();
                     $scope.$emit('refresh', $scope.currentFolder);
                }
            });
        }
    };

    this.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

});

