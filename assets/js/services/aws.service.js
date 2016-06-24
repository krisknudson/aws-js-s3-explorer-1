app.service('awsService', function($q,utilService) {
    var self = this;


    AWS.config.update({accessKeyId: accessKey, secretAccessKey: secretKey});

    AWS.config.region = region;

    AWS.config.apiVersions = {
        s3: '2006-03-01'
    };
    var ep = new AWS.Endpoint(region + '.amazonaws.com');

    var bucket = new AWS.S3({
        params: {
            Bucket: bucket_name
        },
        endpoint: ep
    });

    this.listObjects = function (params, callback, getThemAll) {
        var result = {"CommonPrefixes":[], "Contents":[]};
        var callbackHandler = function (err, data) {

            result.CommonPrefixes = result.CommonPrefixes.concat(data.CommonPrefixes);
            result.Contents = result.Contents.concat(data.Contents);
            if (getThemAll && data.IsTruncated) {
                params.ContinuationToken = data.NextContinuationToken;
                bucket.listObjectsV2(params, callbackHandler);
            } else {
                callback(result);
            }
        };
        bucket.listObjectsV2(params, callbackHandler);
    };

    this.getDownloadUrl = function(key, callback) {
        var params = {
            Bucket: bucket_name,
            Key: key,
            ResponseContentEncoding: 'UTF-8'
        }
        var url = bucket.getSignedUrl('getObject', params);
        return url;
    }

    this.upload = function(params, callback, updateProgress){
        bucket.upload(params, function(err, data) {
            if(err){
                console.log('upload error : ', err);
            }
            callback(err,data);
        }).on('httpUploadProgress', updateProgress);
    };

    this.createFolder = function(parentPath, folderName, callback){
        var params = {
            Key : (parentPath + folderName + '/'),
            Body : 'Folder'
        };

        bucket.upload(params, function(err, data){
            if(err){
                console.log('create folder error : ', err);
            }
            callback(err,data);
        });
    };

    this.generateUrl = function (key) {
        return bucket.endpoint.href + bucket_name + '/' + key;
    };

    this.renameFile = function (key, destination, callback) {
        var params = {
            CopySource: bucket_name + "/" + key,
            Key: destination
        };
        bucket.copyObject(params, function(err, data) {
            if(err) {
                console.log(err, err.stack);
            } else {
                self.deleteObjectWithoutBackup([{Key : key}], callback);
            }
        });
    };

    this.copyObject = function (key, destination, callback) {
        var params = {
            CopySource: encodeURIComponent(bucket_name + "/" + key),
            Key: destination
        };
        bucket.copyObject(params, function(err, data) {
            if(err) {
                console.log(err, err.stack);
            }

            callback(err, data);

        });
    };

    this.deleteAnObject = function(objKey, callback) {
        this.moveJunk({Key : objKey}, false, callback);
    }

    this.deleteObjects = function(objects, callback, updateProgress) {
        this.moveJunk(objects, false, callback, updateProgress);
    }

    this.moveSingleJunk = function(file, restore, callback, updateProgress, total, currentRequest) {
        var path;

        if(restore) {
           path = utilService.extractPathFromJunk(file.Key);
        } else {
           path = utilService.getJunkPath(file.Key);
           if(updateProgress) {
              updateProgress(currentRequest, total);
           }
        }


        if(path) {
            this.renameFile(file.Key, path, callback);
        }
    }

    this.moveJunk = function(files, restore, callback, updateProgress) {
        var error;
        var self = this;

        if(angular.isArray(files)) {
            app.lineUp(files, function(deferred, file, currentRequest, files){
                self.moveSingleJunk(file, restore, function(data){
                    deferred.resolve(file);
                }, updateProgress, files.length, currentRequest+1);
                return deferred.promise;
            }).then(function(results){
                 callback(error, results);
            });
        } else {
            self.moveSingleJunk(files, restore, callback);
        }
    }

    this.deleteObjectWithoutBackup = function(objects, callback) {
        params = {
            Bucket: bucket_name,
            Delete: {
                Objects: []
            }
        }
        var numberOfRequest = self.getNumberOfRequestToDelete(objects);
        for(var i = 0; i< numberOfRequest; i++) {
            params.Delete.Objects = objects.splice(0, 1000);
            bucket.deleteObjects(params, callback);
        }
    }

    this.getNumberOfRequestToDelete = function(objects) {
        var length = objects.length;
        var numberOfRequest = Math.floor(length/1000);
        return (length % 1000) === 0 ? numberOfRequest : (numberOfRequest + 1);
    }

    this.loadFolderTree = function(rootFolder) {
        var deferred = $q.defer();

        var foldersList = []; // clear up

        foldersList.push({
            "folderName": rootFolder,
            "folderId": rootFolder,
            "children": []
        });

        var prefix = rootFolder + '/';

        this.listObjects({Delimiter: '/', Prefix: prefix}, // to enlist all folders and files with orders
            function (response) {
                    var folders = response.CommonPrefixes;
                    folders.forEach(function (e) {// to retain only folders
                            foldersList[0].children.push({
                                "folderName": utilService.getFoldersName(e.Prefix),
                                "folderId": e.Prefix,
                                "children": []
                            });
                    });

                deferred.resolve(foldersList[0]);

            });

        return deferred.promise;

    };
    
    this.expand = function(targetFolder, folderTree, parentNode) { // FIXME consider to combine with loadFolderTree become one
        var deferred = $q.defer();
        this.listObjects({Delimiter: '/', Prefix: targetFolder},
            function (response) {
                var folders = response.CommonPrefixes;
                var children = [];
                folders.forEach(function (e) {
                    children.push({
                        "folderName": utilService.getFoldersName(e.Prefix),
                        "folderId": e.Prefix,
                        "children": []
                    });
                });

                parentNode.children = children; 
                deferred.resolve(folderTree.children);

            });
        return deferred.promise;

    }

    });