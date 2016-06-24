app.controller('UploadCtrl', function ($scope, awsService, utilService, $uibModalInstance, currentFolder, existingFiles) {
    var self = this;
    $scope.currentFolder = currentFolder;
    $scope.existingFiles = existingFiles;
    self.uploadFiles = [];
    self.failedFiles = [];
    $scope.errMsg;

    $scope.getFileDetails = function (evt) {
        $scope.$apply(function () {
            for (var i = 0; i < evt.files.length; i++) {
                self.uploadFiles.push({
                    name    : evt.files[i].name,
                    content : evt.files[i],
                    status  : 'ready',
                    progress: '0%'
                });
            }
        });
    };

    this.upload = function(){
        if(self.uploadFiles.length){
            //Check duplicated file name
            var isExistedFile = false;
            self.uploadFiles.forEach(function(uploadFile){
                if(utilService.isExisted($scope.existingFiles, uploadFile.name)) {
                    $scope.errMsg = '[' + uploadFile.name + '] is already existed';
                    isExistedFile = true;
                }
            });
            if (!isExistedFile) {
                app.lineUp(self.uploadFiles, self.uploadProcessor)
                    .then(function(results){
                        var allSucceed = true;
                        self.failedFiles = [];
                        angular.forEach(results, function(file, index){
                            if(file.status == 'fail'){
                                allSucceed = false;
                                self.failedFiles.push(file);
                            }
                        });
                        if(allSucceed){
                            $uibModalInstance.close();
                            $scope.$emit('refresh', $scope.currentFolder);
                        }
                    });
            }
        }
    };

    this.retry = function(){
       self.uploadFiles = self.failedFiles;
       $scope.upload();
    };

    this.close = function (index) {
        self.uploadFiles.splice(0);
        $uibModalInstance.dismiss('cancel');
        if(self.failedFiles.length) {
            $scope.$emit('refresh', $scope.currentFolder);
        }
    };

    this.cancel = function (index) {
        self.uploadFiles.splice(index, 1);
    };

    this.uploadProcessor = function(deferred, file){
        var modifiedFile = file;
        modifiedFile.status = 'uploading';
        var params = {
            Key : $scope.currentFolder + modifiedFile.name,
            Body: modifiedFile.content
        };
        var updateProgress = function(evt) {
            modifiedFile.progress = parseInt((evt.loaded * 100) / evt.total)+'%';
            $scope.$digest();
        };
        awsService.upload(params, function(err, data){
            if(err) {
                modifiedFile.status = 'fail';
            } else {
                modifiedFile.status = 'success';
            }
            deferred.resolve(modifiedFile);
        }, updateProgress);
        return deferred.promise;
    };

});