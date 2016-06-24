app.controller('CopyController', function($scope, $log, cfpLoadingBar, awsService, $uibModal, utilService, $location) {
    $scope.targetFolder;
    $scope.errMsg;

    $scope.copy = function (action) { 
        var folderTree = [];
        cfpLoadingBar.start();
        // load current existing folder tree in order to process later
        awsService.loadFolderTree($location.search().brand).then(function(result){
            if (result){
                folderTree = result;
                cfpLoadingBar.complete();
            }

            $uibModal.open({
                templateUrl: 'assets/html/folder.tree.modal.html',
                controller: 'treeController',
                controllerAs : 'ctrl',
                backdrop : 'static',
                resolve: {
                    message: function () { // file names copied to show on UI
                        var selectedFolders = utilService.getSelectedObjects($scope.folders);
                        var selectedFiles = utilService.getSelectedObjects($scope.files);
                        var itemSize = selectedFolders.length + selectedFiles.length;
                        if ($scope.item && $scope.item.prefix && $scope.item.prefix.lastIndexOf('/') === $scope.item.prefix.length-1){
                            return "Select the folder in which the source folder '" + $scope.item.displayName +"' is copied to:";
                        }else
                        if (itemSize > 0) {
                            return "Select the folder in which the "+ itemSize +" items are copied to:";
                        }
                        return "Select the folder in which the file '" + $scope.item.displayName +"' is copied to:";
                    },
                    targetFolder: function() {
                        return $scope.targetFolder;
                    },
                    selectedFiles: function() {
                        if ($scope.item && utilService.getFileType($scope.item.displayName)) {
                            var selectedFiles = [];
                            selectedFiles.push($scope.item);
                            return selectedFiles;
                        }
                        return utilService.getSelectedObjects($scope.files);
                    },
                    folderTree: function() {
                        return folderTree;
                    },
                    currentFolder: function() {
                        return $scope.currentFolder;
                    },
                    selectedFolders: function() {
                        var selectedFolders = [];
                        if ($scope.item && $scope.item.prefix && $scope.item.prefix.lastIndexOf('/') === $scope.item.prefix.length-1){
                             selectedFolders.push($scope.item);
                            return selectedFolders;
                        }
                        return utilService.getSelectedObjects($scope.folders);
                    },
                    action: function() {
                        return action;
                    }
                }
            });
        });

    };
});

app.controller('treeController', function ($scope, $uibModalInstance,$uibModal, $log,cfpLoadingBar, awsService, utilService,
                                            targetFolder, folderTree, message, selectedFiles, currentFolder,
                                           selectedFolders, action,$rootScope) {
    var self = this;
    $scope.errMsg;
    $scope.message = message;
    $scope.folderTree = folderTree.children;
    $scope.targetFolder = targetFolder;
    this.selectedFiles = [];
    $scope.collapseNodes = [];
    $scope.clicked = false;
    self.buttonLabel = action || "Copy";

    $scope.onSelect = function() {
        if ($scope.clicked) {return;}
        
        if ($(".ff_selected").attr("node-id")) { // retain selected targetFolder and return 
            $scope.targetFolder = $(".ff_selected").attr("node-id");
            return;
        }

        $scope.targetFolder =  $(".iconClicked").attr("node-id");
        var parentNode = utilService.searchTree(folderTree, $scope.targetFolder);

        if (parentNode == null) return;
        var i = $.inArray(parentNode.folderId, $scope.collapseNodes);
        if (i !== -1) {
            $scope.collapseNodes.splice(i, 1);
        }else{ $scope.collapseNodes.push(parentNode.folderId);}
            
        // check parent has children already then no need to reload any more
        if (parentNode.children.length) return;
        $scope.clicked = true;
        $(".iconClicked").children("img").remove();
        angular.element($(".iconClicked").children("span")).toggleClass("hide");

        awsService.expand($scope.targetFolder, folderTree, parentNode).then(function(result) {
            if (result) {
                $scope.folderTree = result;
                $scope.clicked = false;
                angular.element($(".iconClicked").children("span")).toggleClass("hide");
            }
        });
    };
    
    $scope.copy = function () {
        if(!$scope.targetFolder) {
            $scope.errMsg = 'Please select a folder !';
            return;
        }
        if(currentFolder === $scope.targetFolder) {
            $scope.errMsg = 'Unable to override the same folder in the same current folder !';
            return;
        }
        self.processing = true;
        $("#copy").attr('disabled','disabled');
        $("#cancel").attr('disabled','disabled');


        var selectedObjects = [];

        selectedFiles.forEach(function(selectedFile){
            var destination = $scope.targetFolder + selectedFile.displayName;
            selectedObjects.push({source:selectedFile.key, destination:destination, displayName: selectedFile.displayName});
        });
        if(selectedFolders.length > 0) {
            app.async(selectedFolders, self.subObjects).then(function(result){
                result.forEach(function(element){
                    var children = element.children;

                    children.forEach(function(child) {
                        selectedObjects.push(child);
                    })
                });
                awsService.listObjects({Delimiter: '/', Prefix: $scope.targetFolder }, function (response) {
                    var existingObjects = [];
                    response.CommonPrefixes.forEach(function(e) {
                        if (utilService.isExisted(selectedFolders, utilService.getFoldersName(e.Prefix))) {
                            existingObjects.push(e);
                        }
                    });

                    if (existingObjects.length > 0) { // check if existing folders
                        //  do delete duplicated folders and sub folders inside
                        app.async(existingObjects, self.deletedSubObjects).then(function(result){
                            var allDeletedObjects = [];
                            result.forEach(function(element){
                                var children = element.children;
    
                                children.forEach(function(child) {
                                    allDeletedObjects.push(child);
                                })
                            });
                            awsService.deleteObjects(allDeletedObjects,function(err, data) {
                                if (err) $log.error(err, err.stack); // an error occurred
                                // continue delete files
                                self.processDeleteFiles(response.Contents, selectedObjects);
                            });

                            });
                    } else { // check if existing files
                        self.processDeleteFiles(response.Contents, selectedObjects);
                    }
                }, true);
            });
        } else if (selectedFiles.length > 0) {
            self.copyObjects(selectedObjects);
        }
    };
    
    this.processDeleteFiles = function(contents, selectedObjects){
        var existingObjects = [];
        if (contents.length === 0) return;
        contents.forEach(function (element) {
            if(element.Key.lastIndexOf('/') > -1) {
                var displayName = element.Key.substring(element.Key.lastIndexOf('/')+1);
                if (utilService.isExisted(selectedFiles, displayName)){
                    existingObjects.push(element);
                }
            }
        });
        if (existingObjects.length > 0) { //  delete backup  objects overrided
            awsService.deleteObjects(existingObjects,function(err, response) {
                if (err) $log.error(err, err.stack); // an error occurred
                self.copyObjects(selectedObjects);
            });
        } else {
            self.copyObjects(selectedObjects);
        }
    };

    this.subObjects = function(deferred, folder) {

        var obj = folder;
        obj.children = [];
        var destination = $scope.targetFolder + folder.displayName + "/";

        awsService.listObjects({ Prefix: obj.prefix}, function(response) {

            response.Contents.forEach(function(element) {
                obj.children.push({
                    source: element.Key,
                    destination: element.Key.replace(folder.prefix, destination),
                    displayName: folder.displayName})
            });
            deferred.resolve(obj);
        }, true);
        return deferred.promise;
    };

    this.deletedSubObjects = function(deferred, folder) {
        var obj = folder;
        obj.children = [];

        awsService.listObjects({ Prefix: obj.Prefix}, function(response) {
            response.Contents.forEach(function(element) {
                obj.children.push({Key: element.Key});
            });
            deferred.resolve(obj);
        }, true);
        return deferred.promise;
    };
    
    this.copyObjects = function(selectedObjects) {
        app.lineUp(selectedObjects, self.doCopyObject).then(function(result){
            if (self.buttonLabel === "Move") {
                var copiedObjects = [];
                result.forEach(function (element) {
                    copiedObjects.push({Key: element.source });
                });

                awsService.deleteObjectWithoutBackup(copiedObjects, function() {
                    $rootScope.$emit('refresh', currentFolder);
                });
            }

            // then enough condition to close the copy dialog
            self.processing = false;
            $uibModalInstance.close($scope.targetFolder);
        });
    };

    this.doCopyObject = function(deferred, element) {
        
        awsService.copyObject(element.source, element.destination, function(err, data) {
            if(err) {
                self.processing = false;
                $scope.errMsg = "There are issue when copying.";
                $(".btn-primary").hide();
                $("#copy").removeAttr('disabled');
                $("#cancel").removeAttr('disabled');
                return;
            }
            deferred.resolve(element);
        });
        return deferred.promise;
    };

    

    $scope.cancel = function () {
        $uibModalInstance.dismiss('cancel');
    };

});