app.controller('MainController', function($scope, $rootScope, awsService, utilService, cfpLoadingBar, $window,
$location, $uibModal) {
    $scope.parentFolder = false;
    $scope.currentFolder = '';
    $scope.files = [];
    $scope.folders = [];
    $scope.breadcrumbs = [];
    $scope.numberOfSelected = 0;
    $scope.totalDisplayed = 50;
    $scope.isRetrievingObjects = false;
    var self = this;
    $scope.init = function () {
        $scope.currentFolder = '';
        if ($location.search().brand) {
            $scope.currentFolder = $location.search().brand + '/';
        }
        $scope.retrieveObjects($scope.currentFolder, false);
    };

    $rootScope.$on('refresh', function(event, prefix) {
        if(!prefix) {
            prefix = $scope.currentFolder;
        }
        $scope.retrieveObjects(prefix, true);
    });

    $scope.isJunkDir = function(path) {
        return utilService.isJunkSubDir(path || $scope.currentFolder);
    }

    $scope.retrieveObjects = function (prefix, isRefreshed) {
        if($scope.isRetrievingObjects) {
            return;
        }
        $scope.isRetrievingObjects = true;
        cfpLoadingBar.start();
        awsService.listObjects({Delimiter: '/', Prefix: prefix }, function (response) {
            //Browse file
            if(!isRefreshed) {
                if ($scope.breadcrumbs.map(function(e) { return e.prefix; }).indexOf(prefix) === -1) {
                    $scope.breadcrumbs.push({prefix: prefix, displayName: utilService.getFoldersName(prefix)});
                }
                $scope.totalDisplayed = 50;
            }
            $scope.folders = utilService.getFoldersName(response.CommonPrefixes);
            $scope.files = utilService.getFilesName(response.Contents);

            $scope.currentFolder = prefix;
            $scope.parentFolder = utilService.getParentFolder($scope.currentFolder);
            $scope.numberOfSelected = 0;
            $scope.$digest();
            cfpLoadingBar.complete();
            $scope.isRetrievingObjects = false;
        }, true);
    };

    $scope.goTo = function (prefix, index) {
        $scope.currentFolder = prefix;
        $scope.retrieveObjects(prefix, false);
        $scope.breadcrumbs.splice(index+1, $scope.breadcrumbs.length - index);
    };

    $scope.openFile = function(key) {
        $window.open(awsService.generateUrl(key), '_blank');
    };

    $scope.downloadFile = function(file, isZipped) {
        if(!isZipped) {
            var downloadUrl = awsService.getDownloadUrl(file.key),
                a = document.createElement("a");

            a.href = downloadUrl;
            a.download = file.displayName;
            a.type="application/octet-stream";
            a.style = "display: none";
            document.body.appendChild(a);
            a.click();
        } else {
            file.itemsToZip = [];
            file.itemsToZip.push({key: file.key, downloadUrl: awsService.getDownloadUrl(file.key)});
            var zipper = new JSZip();
            var updateProgress = function(evt) {
                file.zipProgress = parseInt((evt.loaded * 100) / evt.total)+'%';
                $scope.$digest();
            }

            self.zipAndDownload(file, zipper, updateProgress);
        }
    }

    $scope.downloadFolder = function(folder) {
        folder.itemsToZip = [];
        folder.numberOfFilesToZip = 0;
        var zipper = new JSZip(),
            zippedNumber = 0;
            updateProgress = function(evt) {
                var progress = parseInt((evt.loaded * 100) / evt.total);
                folder.zipProgress = progress +'%';
                if(evt.loaded == evt.total) {
                    zippedNumber++;
                }
                folder.zippedNumber = zippedNumber + "/" + folder.numberOfFilesToZip;
                $scope.$digest();
            };

        awsService.listObjects({Delimiter: '', Prefix: folder.prefix}, function(response) {
            response.Contents.forEach(function(element){
                var downloadUrl = "",
                    length = element.Key.length;

                if(element.Key.charAt(length-1) != '/') {
                    downloadUrl = awsService.getDownloadUrl(element.Key);
                    folder.numberOfFilesToZip++;
                }
                folder.itemsToZip.push({key: element.Key, downloadUrl: downloadUrl});
            });
            self.zipAndDownload(folder, zipper, updateProgress);
        }, true);

    }

    this.zipAndDownload = function(item, zipper, updateProgress) {
        var itemsToZip = item.itemsToZip,
            zippedNumber = 0;
        item.status = 'downloading';
        item.zipProgress = '0%';
        Promise.all(itemsToZip.map(function(subItem) {
            return utilService.zipFileFromUrl(subItem, zipper, updateProgress);
        })).then(function() {
            zipper.generateAsync({
                type: "blob"
            }).then(function(content) {
                var a = document.createElement("a"),
                    downloadUrl = URL.createObjectURL(content);

                $scope.$digest();
                a.download = item.displayName + ".zip";
                a.href = downloadUrl
                document.body.appendChild(a);
                a.click();
                setTimeout(function() {window.URL.revokeObjectURL(downloadUrl);item.status = "success";},300);
            });
        })
    }
    $scope.openUploadDialog = function(){
        var modalInstance = $uibModal.open({
            animation: false,
            templateUrl: 'assets/html/upload.modal.html',
            controller: 'UploadCtrl',
            controllerAs : 'ctrl',
            backdrop: 'static',
            resolve: {
                currentFolder: function () {
                    return $scope.currentFolder;
                },
                existingFiles: function () {
                    return $scope.files;
                }
            }
        });
    }

    $scope.openCreateFolderDialog = function(){
        var modalInstance = $uibModal.open({
            animation: false,
            templateUrl: 'assets/html/folder.modal.html',
            controller: 'CreateFolderCtrl',
            controllerAs : 'ctrl',
            backdrop: 'static',
            resolve: {
                currentFolder: function () {
                    return $scope.currentFolder;
                },
                existingFolders: function () {
                    return $scope.folders;
                }
            }
        });
    }

    $scope.selectAnObject = function(obj) {
        if(obj.isSelected){
            $scope.numberOfSelected++;
        } else {
            $scope.numberOfSelected--;
        }
    }

    $scope.setObjectsIsSelected = function(isSelected) {
        $scope.showCheckBox = true;
        if(isSelected) {
            $scope.numberOfSelected = $scope.files.length + $scope.folders.length;
        } else {
            $scope.numberOfSelected = 0;
        }
        for(var i = 0; i< $scope.files.length;i++) {
            $scope.files[i].isSelected = isSelected;
        }
        for(var i = 0; i< $scope.folders.length;i++) {
            $scope.folders[i].isSelected = isSelected;
        }
    }

    $scope.closeDetailsPopover = function(item) {
        item.popoverIsOpen = false;
        item.hover = false;
    }

    $scope.loadMore = function () {
        $scope.totalDisplayed += 20;
    };

});

