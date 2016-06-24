app.service('utilService', function() {
    var self = this;
    var folderNamePattern = /(.*\/)*(.*)\//;
    var junk_prefix = "junk";
    var junkRegExp = new RegExp('^' + junk_prefix);
    var pathExtractRegExp = new RegExp('^' + junk_prefix + '\/(\\d{4})\/(\\d{1,2})\/(\\d{1,2})\/');

    this.getFoldersName = function (input) {
        if (input instanceof Array) {
            var folders = [];
            input.forEach(function (element) {
                folders.push({
                    displayName: folderNamePattern.exec(element.Prefix)[2],
                    prefix: element.Prefix,
                    isSelected: false
                });
            });
            return folders;
        } else {
            return input == '' ? 'Home' : folderNamePattern.exec(input)[2];
        }
    };

    this.getFilesName = function (input) {
        var files = [];
        var displayName;
        var fileSize;
        var fileType;
        input.forEach(function (element) {

            if(element.Key.lastIndexOf('/') > -1) {
                displayName = element.Key.substring(element.Key.lastIndexOf('/')+1);
            } else {
                displayName = element.Key;
            }
            if(parseInt(element.Size) < 1024) {
                fileSize = element.Size + "Byte";
            } else {
                fileSize = (parseInt(element.Size)/1024).toFixed(2) + "KB";
            }
            if (displayName) {
                fileType = self.getFileType(displayName);
                files.push({displayName: displayName, key: element.Key, isSelected: false, lastModified: element.LastModified, size: fileSize, type: fileType});
            }
        });
        return files;
    };

    this.getFileType = function (displayName) {
        var lastDotIndex = displayName.lastIndexOf(".");
        if (lastDotIndex > -1) {
            return displayName.substring(lastDotIndex + 1);
        }
        return "";
    };

    this.getSelectedObjects = function(objects) {
        var selectedObjects = [];
        objects.forEach(function(object) {
            if(object.isSelected) {
                selectedObjects.push(object);
            }
        });
        return selectedObjects;
    }

    this.getJunkPrefix = function(){
        return junk_prefix;
    }

    this.getJunkPath = function(objKey) {
        var junkPath ;
        if(objKey) {
            junkPath = junk_prefix + '/' + getDateStamp() + '/' + objKey;
        }
        return junkPath;
    }

    this.extractPathFromJunk = function(junkPath) {
        var path;
        if(pathExtractRegExp.test(junkPath)) {
            path = junkPath.replace(pathExtractRegExp,'');
        }
        return path;
    }

    getDateStamp = function(){
        var today = new Date();
        var dd = today.getDate();
        var mm = today.getMonth()+1; //January is 0!

        var yyyy = today.getFullYear();
        if(dd<10){
            dd='0'+dd
        }
        if(mm<10){
            mm='0'+mm
        }
        return yyyy + '/' + mm + '/' + dd;
    }

    this.isExisted = function(existingItems, newName) {
        var existed = false;
        existingItems.forEach(function(existingItem){
            if(existingItem.displayName === newName){
               existed = true;
            }
        });
        return existed;
    }

    this.searchTree = function(element, matchingFolderId){
        if(element.folderId == matchingFolderId){
            return element;
        }else if (element.children){
            var result = null;
            for(var i=0; result == null && i < element.children.length; i++){
                result = this.searchTree(element.children[i], matchingFolderId);
            }
            return result;
        }
        return null;
    }

    this.isJunkSubDir = function(fname) {
        return junkRegExp.test(fname);
    }

    this.isValidName = function(fname) {
        var rg1=/^[^\\/:\*\?"<>\|]+$/; // forbidden characters \ / : * ? " < > |;
        return rg1.test(fname) && !this.isJunkSubDir(fname);
    }

    this.zipFileFromUrl = function (item, zipper, updateProgress) {
        return new Promise(function (resolve) {
            if(item.downloadUrl == "") {
                zipper.folder(item.displayName);
                resolve();
            } else {
                var httpRequest = new XMLHttpRequest();
                httpRequest.open('GET', item.downloadUrl);
                httpRequest.responseType = "arraybuffer";
                httpRequest.addEventListener("progress", updateProgress);

                httpRequest.onreadystatechange = function (evt) {
                    if (httpRequest.readyState == 4) {
                        zipper.file(item.displayName, this.response)
                        resolve();
                    }
                };
                httpRequest.send();
            }
        });
    }

    this.getParentFolder = function (prefix) {
        var length = prefix.split('/').length;
        if(length > 2) {
            return {
                displayName: '...',
                prefix: folderNamePattern.exec(prefix)[1],
                isSelected: false
            };
        } else {
            return false;
        }
    }

});