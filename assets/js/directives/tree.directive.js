/**
 * Created by longuyenk on 5/5/2016.
 */
app.directive('treeElement', function ($compile) {
    return {
        restrict: 'E', //Element
        link: function (scope, element, attrs) {
            var EXPAND_ICON= "/etc/sfm/images/expand.png";
            var COLLAPSE_ICON="/etc/sfm/images/collapse.png";
            scope.tree = scope.node;
            var visibility = 'class="hide"';
            if ( $.inArray( scope.tree.folderId, scope.collapseNodes )  != -1) {
                visibility = '';
            }

            if (scope.tree.children.length) {
                for (var i in scope.tree.children) {
                    if (scope.tree.children[i].children.length) {
                        if ( $.inArray(  scope.tree.children[i].folderId, scope.collapseNodes )  != -1) {
                            scope.tree.children[i].icon = EXPAND_ICON;
                        }else{
                            scope.tree.children[i].icon = COLLAPSE_ICON;
                        }
                    }
                }
    
                var template = angular.element(
                        '<ul ' + visibility + '>' +
                        '<li ng-repeat="node in tree.children" node-id={{node.' + attrs.nodeId + '}} ng-class={{node.className}}>' +
                        '<img ng-src="{{node.icon}}" /><span class="hide glyphicon glyphicon-refresh glyphicon-spinning" ng-if="true"/>' +
                        '{{node.' + attrs.nodeName + '}}' +
                        '<tree-element tree="node" node-id=' + attrs.nodeId + ' node-name=' + attrs.nodeName +' node-state=' + attrs.nodeState +  ' collapse-nodes= '+attrs.collapseNodes+' >' +
                        '</tree-element></li></ul>');
                var linkFunction = $compile(template);
                linkFunction(scope);
                element.replaceWith(template);
            } else {
                scope.tree.icon = COLLAPSE_ICON;
                element.remove();
            }
        }
    };
})
    .directive('ffTree', function ($compile) {
        return {
            restrict: 'E', //Element
            link: function (scope, element, attrs) {
                var EXPAND_ICON= "/etc/sfm/images/expand.png";
                var COLLAPSE_ICON="/etc/sfm/images/collapse.png";
                scope.selectedNode = null;

                //CSS for TREE
                var sheet = document.createElement('style')
                sheet.innerHTML =
                    "ff-tree ul{margin:0;padding:0;list-style:none;border:none;overflow:hidden;text-decoration:none;color:#555}" +
                    "ff-tree li{position:relative;padding:0 0 0 20px;font-size:13px;font-weight:initial;line-height:18px;cursor:pointer}" +
                    "ff-tree .ff_selected{font-weight:bold;}" +
                    "ff-tree .hide{display:none;}" +
                    "ff-tree .ff_deselected{font-weight:normal;}";
                document.body.appendChild(sheet);

                scope.$watch(attrs.treeData, function () {
                    for (var i in scope[attrs.treeData]) {
                        if ( $.inArray( scope[attrs.treeData][i].folderId, scope.collapseNodes )  != -1) {
                            scope[attrs.treeData][i].icon = EXPAND_ICON;
                        }else{
                            scope[attrs.treeData][i].icon =  COLLAPSE_ICON;
                        }
                    }
              
                    var template = angular.element(
                        '<ul id="ffTreeBrowser">' +
                        '<li ng-repeat="node in ' + attrs.treeData + '" node-id={{node.' + attrs.nodeId + '}} ng-class="node.className" >' +
                        '<img ng-src="{{node.icon}}" /><span class="glyphicon glyphicon-refresh glyphicon-spinning hide" ng-if="true"/>' +
                        '{{node.' + attrs.nodeName + '}}' +
                        '<tree-element tree="node" node-id=' + attrs.nodeId + ' node-name=' + attrs.nodeName + ' node-state=' + attrs.nodeState + ' collapse-nodes='+attrs.collapseNodes+'>' +
                        '</tree-element></li></ul>');

                    var linkFunction = $compile(template);
                    linkFunction(scope);
                    element.html(null).append(template);

                    //Click Event
                    angular.element(document.getElementById('ffTreeBrowser')).unbind().bind('click', function (e) {
                        if (e.target.nodeName === "IMG") {
                            $(".ff_selected").removeClass("ff_selected"); // clear selected css class
                            var targetImage = angular.element(e.target);
                            var parent = targetImage.parent();
                            if (targetImage.attr("src") === COLLAPSE_ICON){
                                targetImage.attr('src', EXPAND_ICON);
                            }
                            else{  targetImage.attr('src', COLLAPSE_ICON);}
                            $(".iconClicked").removeClass("iconClicked");
                            parent.addClass("iconClicked");
                            if (parent.length) {
                                if (parent.children().length) {
                                    // collapse/expand sub folder(s)
                                    angular.element(parent.children("ul")).toggleClass("hide");
                                }
                            }
                        }else {
                            if (angular.element(e.target).length) {
                                scope.previousElement = scope.currentElement;

                                scope.currentElement = angular.element(e.target);

                                scope.$broadcast('nodeSelected', {
                                    selectedNode: scope.currentElement.attr('node-id')
                                });

                                if (scope.previousElement) {
                                    scope.previousElement.addClass("ff_deselected").removeClass("ff_selected");
                                }
                                scope.currentElement.addClass("ff_selected").removeClass("ff_deselected");
                            }

                        } // end else
                    });
                }, true);
            }
        };
    });
