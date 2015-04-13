/**
 * Created by oleg.gololobov on 9/25/2014.
 */
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/Deferred",
    "dojo/string",
    "dojo/dom",
    "dojo/dom-attr",
    "dojo/json",
    "dojo/promise/all",
    "dojo/request/xhr",
    "dojo/when",
    "dijit/registry"
], function (declare, lang, array, Deferred, string, dom, domAttr, json, all, xhr, when, registry) {

    function addSecurityParams(/*_Widget|DomNode*/ item, /*Object*/ params) {
        var self = this,
            itemIndex = self._securedItems.indexOf(item);

        if (itemIndex < 0) {
            itemIndex = self._securedItems.push(item) - 1;
        }
        self._securityParams[itemIndex] = params;
    }

    function clearSecuritySettings() {
        this._securedItems = [];
        this._securityParams = [];
        this._tablePaths = null;
        if (this._securedItemHandles && this._securedItemHandles.length) {
            this._securedItemHandles.forEach(function (handle) {
                handle.remove();
            });
        }
        this._securedItemHandles = [];
        if (this._domMutationObservers && this._domMutationObservers.length) {
            this._domMutationObservers.forEach(function (observer) {
                observer.disconnect();
            });
        }
        this._domMutationObservers = [];
    }

    function setCSSVisibility(/*Object*/ securedItem, /*Boolean*/ visible) {
        var value = visible ? "" : "collapse";
        if (securedItem.domNode) {
            securedItem.domNode.style.visibility = value;
            if (securedItem.labelNode) {
                securedItem.labelNode.style.visibility = value;
            }
        } else if (securedItem.nodeType) {
            securedItem.style.visibility = value;
        }

    }

    function initSecuredItem(/*Object*/ securedItem, /*int*/ index, /*Array*/ securedItems) {
        var securityParams = this._securityParams[index], accessGranted;
        function disabledWatchHandler(propName, oldValue, value) {
            //var currVal=this.get(securityParams.disabledPropName);
            if (!value) {
                if(securityParams.activity){
                    if (securityParams.disabledPropName && securityParams.isDisabled) {
                        this.set(securityParams.disabledPropName, securityParams.isDisabled);
                    }
                } else if (!securityParams.writeAccessGranted) {
                    // secure UI element
                    this.set(securityParams.disabledPropName, !securityParams.writeAccessGranted);
                }
            }
        }

        function visibleWatchHandler(propName, oldValue, value) {
            var accessGranted;

            if (securityParams.type == "HIERARCHY") {
                accessGranted = securityParams.enforceRead && securityParams.readAccessGranted ||
                securityParams.toHide && securityParams.writeAccessGranted;
            } else {
                accessGranted = securityParams.enforceRead && securityParams.readAccessGranted;
            }
            if (value && !accessGranted) {
                // secure UI element
                this.set(securityParams.visiblePropName, accessGranted);
            }
        }

        function disabledMutationHandler(mutations, observer) {
            mutations.forEach(function (mutation) {
                var value;
                if (mutation["type"] == "attributes" && mutation["attributeName"] == securityParams.disabledPropName) {
                    value = domAttr.has(mutation["target"], mutation["attributeName"]);
                    if (!value && !securityParams.writeAccessGranted) {
                        domAttr.set(mutation["target"], mutation["attributeName"]);
                    }
                }
            });
        }

        function visibleMutationHandler(mutations, observer) {
            mutations.forEach(function (mutation) {
                var value, accessGranted, hiddenValue = "collapse";
                if (mutation["type"] == "attributes" && mutation["attributeName"] == "style") {
                    //value = domClass.contains(mutation["target"], "dijitHidden");
                    value = mutation["target"].style.visibility;
                    if (securityParams.type == "HIERARCHY") {
                        accessGranted = securityParams.enforceRead && securityParams.readAccessGranted ||
                        securityParams.toHide && securityParams.writeAccessGranted;
                    } else if(securityParams.type == "ACTIVITY"){
                        if (value !== hiddenValue && securityParams.isHidden) {
                            mutation["target"].style.visibility = hiddenValue;
                        }else if(value =="collapse" && !securityParams.isHidden){
                            mutation["target"].style.visibility = "";
                        }
                    }
                    else{
                        accessGranted = securityParams.enforceRead && securityParams.readAccessGranted;
                    }
                    if (value !== hiddenValue && !accessGranted &&securityParams.type != "ACTIVITY" ) {
                        //domClass.add(mutation["target"], "dijitHidden");
                        mutation["target"].style.visibility = hiddenValue;
                    }
                }
            });
        }

        function getMutationObserver(/*DomNode*/ domNode, /*Object*/ init, /*Function*/ handler) {
            var observer = new MutationObserver(handler);
            observer.observe(domNode, init);
            return observer;
        }

        switch (securityParams.type) {
            case "HIERARCHY":
                securityParams.readAccessGranted = false;
                securityParams.writeAccessGranted = false;
                if (securityParams.enforceRead || securityParams.toHide) {
                    accessGranted = securityParams.enforceRead && securityParams.readAccessGranted ||
                    securityParams.toHide && securityParams.writeAccessGranted;

                    if (securityParams.visiblePropName) {
                        securedItem.set(securityParams.visiblePropName, accessGranted);
                        this._securedItemHandles.push(securedItem.watch(securityParams.visiblePropName, visibleWatchHandler));
                    } else {
                        setCSSVisibility(securedItem, accessGranted);
                        if (securedItem.domNode) {
                            this._domMutationObservers.push(
                                getMutationObserver(securedItem.domNode, {
                                    attributes: true,
                                    attributeFilter: ["style"]
                                }, visibleMutationHandler)
                            );
                            if (securedItem.labelNode) {
                                this._domMutationObservers.push(
                                    getMutationObserver(securedItem.labelNode, {
                                        attributes: true,
                                        attributeFilter: ["style"]
                                    }, visibleMutationHandler)
                                );
                            }
                        } else if (securedItem.nodeType) {
                            this._domMutationObservers.push(
                                getMutationObserver(securedItem, {
                                    attributes: true,
                                    attributeFilter: ["style"]
                                }, visibleMutationHandler)
                            );
                        }
                    }
                }
                if (securityParams.enforceWrite || securityParams.enforceAdd || securityParams.enforceDelete) {
                    if (!securityParams.toHide) {
                        if ("set" in securedItem && typeof securedItem.set == "function") {
                            // implementation for Stateful objects (including _WidgetBase widgets)
                            securedItem.set(securityParams.disabledPropName, !securityParams.writeAccessGranted);
                            this._securedItemHandles.push(securedItem.watch(securityParams.disabledPropName, disabledWatchHandler));
                        } else if (securedItem.nodeType) {
                            // implementation for DOM nodes
                            this._domMutationObservers.push(
                                getMutationObserver(securedItem, {
                                    attributes: true,
                                    attributeFilter: [securityParams.disabledPropName]
                                }, disabledMutationHandler)
                            );
                        }
                    }
                }
                break;
            case "COLUMN":
                securityParams.readAccessGranted = false;
                securityParams.writeAccessGranted = false;
                // implementation for Stateful objects (including _WidgetBase widgets)
                if (securityParams.enforceRead) {
                    if (securityParams.visiblePropName) {
                        securedItem.set(securityParams.visiblePropName, securityParams.readAccessGranted);
                        this._securedItemHandles.push(securedItem.watch(securityParams.visiblePropName, visibleWatchHandler));
                    } else {
                        setCSSVisibility(securedItem, securityParams.readAccessGranted);
                        if (securedItem.domNode) {
                            this._domMutationObservers.push(
                                getMutationObserver(securedItem.domNode, {
                                    attributes: true,
                                    attributeFilter: ["style"]
                                }, visibleMutationHandler)
                            );
                            if (securedItem.labelNode) {
                                this._domMutationObservers.push(
                                    getMutationObserver(securedItem.labelNode, {
                                        attributes: true,
                                        attributeFilter: ["style"]
                                    }, visibleMutationHandler)
                                );
                            }
                        } else if (securedItem.nodeType) {
                            this._domMutationObservers.push(
                                getMutationObserver(securedItem, {
                                    attributes: true,
                                    attributeFilter: ["style"]
                                }, visibleMutationHandler)
                            );
                        }
                    }

                }
                if (securityParams.enforceWrite) {
                    if ("set" in securedItem && typeof securedItem.set == "function") {
                        securedItem.set(securityParams.disabledPropName, !securityParams.writeAccessGranted);
                        this._securedItemHandles.push(securedItem.watch(securityParams.disabledPropName, disabledWatchHandler));
                    } else if (securedItem.nodeType) {
                        this._domMutationObservers.push(
                            getMutationObserver(securedItem, {
                                attributes: true,
                                attributeFilter: [securityParams.disabledPropName]
                            }, disabledMutationHandler)
                        );
                    }
                }
                break;
            case "ACTIVITY":
                securityParams.isDisabled = true;
                securityParams.isHidden = true;
                // implementation for Stateful objects (including _WidgetBase widgets)
                if (securityParams.hideInsteadOfDisable) {
                    if (securityParams.visiblePropName) {
                        securedItem.set(securityParams.visiblePropName, securityParams.isHidden);
                        this._securedItemHandles.push(securedItem.watch(securityParams.visiblePropName, visibleWatchHandler));
                    } else {
                        setCSSVisibility(securedItem, !securityParams.isHidden);
                        if (securedItem.domNode) {
                            this._domMutationObservers.push(
                                getMutationObserver(securedItem.domNode, {
                                    attributes: true,
                                    attributeFilter: ["style"]
                                }, visibleMutationHandler)
                            );
                            if (securedItem.labelNode) {
                                this._domMutationObservers.push(
                                    getMutationObserver(securedItem.labelNode, {
                                        attributes: true,
                                        attributeFilter: ["style"]
                                    }, visibleMutationHandler)
                                );
                            }
                        } else if (securedItem.nodeType) {
                            this._domMutationObservers.push(
                                getMutationObserver(securedItem, {
                                    attributes: true,
                                    attributeFilter: ["style"]
                                }, visibleMutationHandler)
                            );
                        }
                    }
                }
                else if (securityParams.disabledPropName) {
                    if ("set" in securedItem && typeof securedItem.set == "function") {
                        securedItem.set(securityParams.disabledPropName, securityParams.isDisabled);
                        this._securedItemHandles.push(securedItem.watch(securityParams.disabledPropName, disabledWatchHandler));
                    } else if (securedItem.nodeType) {
                        this._domMutationObservers.push(
                            getMutationObserver(securedItem, {
                                attributes: true,
                                attributeFilter: [securityParams.disabledPropName]
                            }, disabledMutationHandler)
                        );
                    }
                }
                break;
        }
    }

    function setSecurity(/*Object*/ securedItem, /*Object*/ securityParams) {
        var enforceUpdate = securityParams.enforceWrite || securityParams.enforceAdd || securityParams.enforceDelete,
            visible = (!securityParams.enforceRead || securityParams.readAccessGranted) &&
                (!securityParams.toHide || !enforceUpdate || securityParams.writeAccessGranted),
            disabled = enforceUpdate && !securityParams.writeAccessGranted;

        if (securityParams.enforceRead || securityParams.toHide) {
            if (securityParams.visiblePropName) {
                securedItem.set(securityParams.visiblePropName, visible);
            } else {
                setCSSVisibility(securedItem, visible);
            }
        }
        if (enforceUpdate && !securityParams.toHide) {
            if ("set" in securedItem && typeof securedItem.set == "function") {
                securedItem.set(securityParams.disabledPropName, disabled);
            } else {
                // assuming we are dealing with plain DOM element here
                if (disabled) {
                    domAttr.set(securedItem, securityParams.disabledPropName);
                } else {
                    domAttr.remove(securedItem, securityParams.disabledPropName);
                }
            }
        }
        if(securityParams.hideInsteadOfDisable){
            if (securityParams.visiblePropName) {
                securedItem.set(securityParams.visiblePropName, securityParams.isHidden);
            } else {
                setCSSVisibility(securedItem, !securityParams.isHidden);
            }
        }else{
            if ("set" in securedItem && typeof securedItem.set == "function") {
                if(typeof securityParams.isDisabled !="undefined")
                {
                    securedItem.set(securityParams.disabledPropName, securityParams.isDisabled);
                }
            } else {
                // assuming we are dealing with plain DOM element here
                if (securityParams.isDisabled) {
                    domAttr.set(securedItem, securityParams.disabledPropName);
                } else {
                    domAttr.remove(securedItem, securityParams.disabledPropName);
                }
            }
        }
    }

    function applyItemSecurity(/*Array*/ promises, /*int*/ securityContextId, /*Boolean*/ locked,
                               /*Object*/ securedItem, /*int*/ index, /*Array*/ securedItems) {
        var self = this,
            deferred = new Deferred(),
            secProvider = self.securityProvider,
            securityParams = self._securityParams[index],
            targetHierarchyId = securityParams.path ?
                self._tablePaths[securityParams.hierarchyId].targetHierarchy[securityParams.path] :
                securityParams.hierarchyId,targetActivity=securityParams.activity;

        promises.push(deferred.promise);

        switch (securityParams.type) {
            case "HIERARCHY":
                when(secProvider.getCRUDRights(securityContextId, targetHierarchyId), function (rights) {
                    var enforceUpdate = securityParams.enforceWrite || securityParams.enforceAdd || securityParams.enforceDelete;

                    securityParams.readAccessGranted = !securityParams.enforceRead || rights.hierarchyAccess["readable"];
                    securityParams.writeAccessGranted = (!enforceUpdate || !securityParams.enforceLock || !locked) &&
                    (!securityParams.enforceWrite || rights.hierarchyAccess["writable"]) &&
                    (!securityParams.enforceAdd || rights.hierarchyAccess["addable"]) &&
                    (!securityParams.enforceDelete || rights.hierarchyAccess["deletable"]);

                    setSecurity(securedItem, securityParams);
                    deferred.resolve();
                }, function (error) {
                    securityParams.readAccessGranted = !securityParams.enforceRead;
                    securityParams.writeAccessGranted = !securityParams.enforceWrite && !securityParams.enforceAdd && !securityParams.enforceDelete;
                    setSecurity(securedItem, securityParams);
                    deferred.resolve();
                });
                break;
            case "COLUMN":
                when(secProvider.getCRUDRights(securityContextId, targetHierarchyId), function (rights) {
                    var enforceUpdate = securityParams.enforceWrite;

                    securityParams.readAccessGranted = !securityParams.enforceRead || rights.columnMap[securityParams.columnId].read;
                    securityParams.writeAccessGranted = (!enforceUpdate || !securityParams.enforceLock || !locked) &&
                    (!securityParams.enforceWrite || rights.columnMap[securityParams.columnId].write);

                    setSecurity(securedItem, securityParams);
                    deferred.resolve();
                }, function (error) {
                    securityParams.readAccessGranted = !securityParams.enforceRead;
                    securityParams.writeAccessGranted = !securityParams.enforceWrite;
                    setSecurity(securedItem, securityParams);
                    deferred.resolve();
                });
                break;
            case "ACTIVITY":
                when(secProvider.getFunctionalPermissions(targetActivity,securityContextId), function (permissionExists) {
                    securityParams.isDisabled = !permissionExists;
                    securityParams.isHidden = !permissionExists;
                    setSecurity(securedItem, securityParams);
                    deferred.resolve();
                }, function (error) {
                    securityParams.isDisabled = !securityParams.isDisabled;
                    securityParams.toHide = !securityParams.toHide;
                    setSecurity(securedItem, securityParams);
                    deferred.resolve();
                });
                deferred.resolve();
                break;
            default:
                deferred.resolve();
                break;
        }
    }

    function getTablePath(/*int|Array*/ tableId) {
        var path;
        if (tableId) {
            if (lang.isArray(tableId)) {
                path = array.map(tableId, function (element) {
                    return "a" + string.pad(element, 4);
                }).join("");
            } else {
                path = "a" + string.pad(tableId, 4);
            }
        }
        return path;
    }

    function registerTablePath(/*int*/ hierarchyId, /*String*/ path) {
        if (path) {
            this._tablePaths = this._tablePaths || {};
            this._tablePaths[hierarchyId] = this._tablePaths[hierarchyId] || {};
            this._tablePaths[hierarchyId].list = this._tablePaths[hierarchyId].list || [];
            if (array.indexOf(this._tablePaths[hierarchyId].list, path) < 0) {
                this._tablePaths[hierarchyId].list.push(path);
            }
        }
    }

    function getTargetHierarchies() {
        var self = this, hierarchyId, promises, deferred,
            urlRoot = self.securityProvider.app.galSysServiceUrls["securityHierarchy"],
            headers = lang.mixin({}, self.securityProvider.app.galSysSessionInfo.headers, {'Content-Type': 'application/json'});

        if (self._tablePaths) {
            deferred = new Deferred();
            promises = {};
            for (hierarchyId in self._tablePaths) {
                promises[hierarchyId] = xhr.put(urlRoot + hierarchyId, {
                    handleAs: "json",
                    headers: headers,
                    data: json.stringify({list: self._tablePaths[hierarchyId].list})
                });
            }
            self._targetHierPromise = deferred.promise;
            when(all(promises), function (targetHierarchies) {
                for (hierarchyId in targetHierarchies) {
                    self._tablePaths[hierarchyId].targetHierarchy = targetHierarchies[hierarchyId];
                }
                deferred.resolve();
            }, function (error) {
                deferred.reject(error);
            });
        }
    }

    return declare(null, {
        // summary:
        //      Security management class to centralize most security handling of UI elements
        //      and unify ways security settings are applied
        // description:
        //      This class may be used in any widget controller,
        //      which manages widget models marked as "security-self-handled".
        //
        //      When the controller receives instances of widget and model in its constructor
        //      it creates an instance of this class and passes references to securable UI elements
        //      to its "secure-" methods. Once all securable UI elements are defined, the controller
        //      invokes SecurityManager.initialize() method.
        //
        //      The actual application of security settings happens when SecurityManager.apply() method is called.
        //      This method should be invoked in the "before" aspect handler of the widget model "load" method.

        _targetHierPromise: null,

        // securityProvider: gscommon/SecurityProviderClass
        securityProvider: null,

        constructor: function (args) {
            lang.mixin(this, args);
            lang.hitch(this, clearSecuritySettings)();
        },

        secureByColumn: function (/*_Widget|DomNode|String*/ uiElement, /*Boolean*/ isWidget,
                                  /*int*/ columnId, /*int*/ hierarchyId, /*int|Array?*/ tableId,
                                  /*Boolean?*/ enforceRead, /*Boolean?*/ enforceWrite,
                                  /*String?*/ readOnlyProperty, /*String?*/ visibleProperty, /*Boolean?*/ enforceLock) {
            // summary:
            //      defines UI element, which security should be enforced on column level
            // uiElement:
            //      Widget, DOM node or id of Widget or DOM node
            // isWidget:
            //      specifies whether uiElement is a Widget or any other Object (not a DOM node)
            // columnId:
            //      id of the database column associated with the UI element
            // hierarchyId:
            //      id of the hierarchy associated with the UI element
            // tableId:
            //      Optional - a single table Id or and array of table Ids,
            //      representing a path to the table, used to secure the widget (integer or array of integers)
            // enforceRead:
            //      Optional - defaults to true, specifies whether to enforce visibility
            // enforceWrite:
            //      Optional - defaults to true, specifies whether to enforce updatability
            // readOnlyProperty
            //      Optional - defaults to "readOnly", specifies name of the property used to prevent modifications
            // visibleProperty
            //      Optional - when not specified CSS "visibility" is used by default,
            //      specifies name of the property used to hide UI element
            // enforceLock
            //      Optional - defaults to true, specifies whether to enforce "locked" state

            //var securedItem, path,
            //    readOnlyPropName = typeof readOnlyProperty == "undefined" ? "readOnly" : readOnlyProperty;
            var securedItem, path,
                readOnlyPropName = readOnlyProperty || "readOnly";

            enforceRead = typeof enforceRead == "undefined" || enforceRead === null ? true : !!enforceRead;
            enforceWrite = typeof enforceWrite == "undefined" || enforceWrite === null ? true : !!enforceWrite;
            enforceLock = typeof enforceLock == "undefined" || enforceLock === null ? true : !!enforceLock;

            if (typeof uiElement == "string") {
                securedItem = isWidget ? registry.byId(uiElement) : dom.byId(uiElement);
            } else {
                securedItem = uiElement;
            }
            path = getTablePath(tableId);
            lang.hitch(this, registerTablePath)(hierarchyId, path);
            lang.hitch(this, addSecurityParams)(securedItem, {
                type: "COLUMN",
                hierarchyId: hierarchyId,
                columnId: columnId,
                tableId: tableId,
                path: path,
                enforceRead: enforceRead,
                enforceWrite: enforceWrite,
                enforceAdd: false,
                enforceDelete: false,
                enforceLock: enforceLock,
                disabledPropName: readOnlyPropName,
                toHide: false,
                visiblePropName: visibleProperty,
                readAccessGranted: false,
                writeAccessGranted: false
            });
        },

        secureByHierarchy: function (/*_Widget|DomNode|String*/ uiElement, /*Boolean*/ isWidget,
                                     /*Boolean*/ enforceRead, /*Boolean*/ enforceWrite,
                                     /*Boolean*/ enforceAdd, /*Boolean*/ enforceDelete,
                                     /*int*/ hierarchyId, /*int|Array?*/ tableId,
                                     /*String?*/ disabledProperty, /*Boolean?*/ hideInsteadOfDisable,
                                     /*String?*/ visibleProperty, /*Boolean?*/ enforceLock) {
            // summary:
            //      defines UI element, which security should be enforced on hierarchy (table) level
            // uiElement:
            //      Widget, DOM node or id of Widget or DOM node
            // isWidget:
            //      specifies whether uiElement is a Widget or any other Object (not a DOM node)
            // enforceRead:
            //      Specifies whether to enforce visibility
            // enforceWrite:
            //      Specifies whether to enforce updatability
            // enforceAdd:
            //      Specifies whether to enforce the ability to add new entries
            // enforceDelete:
            //      Specifies whether to enforce the ability to delete existing entries
            // hierarchyId:
            //      id of the hierarchy associated with the UI element
            // tableId:
            //      Optional - a single table Id or and array of table Ids,
            //      representing a path to the table, used to secure the widget (integer or array of integers)
            // disabledProperty
            //      Optional - defaults to "disabled", specifies name of the property used to disable UI element
            // hideInsteadOfDisable:
            //      Optional - defaults to false, specifies whether to hide UI element instead of disabling it
            // visibleProperty
            //      Optional - when not specified CSS "visibility" is used by default,
            //      specifies name of the property used to hide UI element
            // enforceLock
            //      Optional - defaults to true, specifies whether to enforce "locked" state

            var securedItem, path,
                disabledPropName = disabledProperty || "disabled",
                toHide = !!hideInsteadOfDisable,
                visiblePropName = typeof visibleProperty == "undefined" ? null : visibleProperty;

            enforceLock = typeof enforceLock == "undefined" || enforceLock === null ? true : !!enforceLock;

            if (typeof uiElement == "string") {
                securedItem = isWidget ? registry.byId(uiElement) : dom.byId(uiElement);
            } else {
                securedItem = uiElement;
            }
            path = getTablePath(tableId);
            lang.hitch(this, registerTablePath)(hierarchyId, path);
            lang.hitch(this, addSecurityParams)(securedItem, {
                type: "HIERARCHY",
                hierarchyId: hierarchyId,
                tableId: tableId,
                path: path,
                enforceRead: enforceRead,
                enforceWrite: enforceWrite,
                enforceAdd: enforceAdd,
                enforceDelete: enforceDelete,
                enforceLock: enforceLock,
                disabledPropName: disabledPropName,
                toHide: toHide,
                visiblePropName: visiblePropName,
                readAccessGranted: false,
                writeAccessGranted: false
            });
        },

        secureByActivity: function (/*_Widget|DomNode|String*/ uiElement, /*Boolean*/ isWidget, /*String*/ activity,
                                    /*String?*/ disabledProperty, /*Boolean?*/ hideInsteadOfDisable,
                                    /*String?*/ visibleProperty) {
            // summary:
            //      defines UI element, which security should be enforced on activity (functional group) level
            // uiElement:
            //      Widget, DOM node or id of Widget or DOM node
            // isWidget:
            //      specifies whether uiElement is a Widget or any other Object (not a DOM node)
            // activity:
            //      specifies activity (functional group) name
            // disabledProperty
            //      Optional - defaults to "disabled", specifies name of the property used to disable UI element
            // hideInsteadOfDisable:
            //      Optional - defaults to false, specifies whether to hide UI element instead of disabling it
            // visibleProperty
            //      Optional - when not specified CSS "visibility" is used by default,
            //      specifies name of the property used to hide UI element
            var securedItem, path;

            disabledProperty = typeof disabledProperty == "undefined" || disabledProperty === null ? "disabled" : disabledProperty;
            hideInsteadOfDisable = typeof hideInsteadOfDisable == "undefined" || hideInsteadOfDisable === null ? false : !!hideInsteadOfDisable;

            if (typeof uiElement == "string") {
                securedItem = isWidget ? registry.byId(uiElement) : dom.byId(uiElement);
            } else {
                securedItem = uiElement;
            }
            lang.hitch(this, addSecurityParams)(securedItem, {
                type: "ACTIVITY",
                activity: activity,
                hideInsteadOfDisable: hideInsteadOfDisable,
                disabledPropName: disabledProperty,
                visiblePropName: visibleProperty,
                isDisabled: true
            });
        },

        secureModel: function (/*Object*/ widgetModel, /*String?*/ readOnlyProperty) {
            // summary:
            //      defines widget model, which has to be secured by setting "readOnly" property
            // readOnlyProperty
            //      Optional - defaults to "readOnly", specifies name of the property used to prevent modifications
        },

        initialize: function (/*Function?*/ postSecure) {
            // summary:
            //      initializes set of secured UI elements, widget models and other objects, specified by methods with
            //      "secure" prefix (see above).
            //      should be called only after all the securables defined by those methods.
            // postSecure:
            //      Optional callback - used to perform necessary post-processing to properly apply security-related
            //      changes to secured widgets
            //  returns:
            //      a "handle" object with just one method "cancel", which is used to stop security enforcement
            var self = this,
                handle = {
                    cancel: function () {
                        //TODO: implement canceling security subscription for all widgets
                        lang.hitch(self, clearSecuritySettings)();
                    }
                };

            self._securedItems.forEach(initSecuredItem, self);
            postSecure && postSecure();
            lang.hitch(self, getTargetHierarchies)();
            return handle;
        },

        apply: function (/*int*/ securityContextId, /*Boolean*/ locked, /*Function?*/ postSecure) {
            // summary:
            //      applies security settings to all secured UI elements, widget models and other objects
            // securityContextId:
            //      department id - determines which security group permissions to apply
            // locked:
            //      specifies whether all secured UI elements should be locked for modification
            // postSecure:
            //      Optional callback - used to perform necessary post-processing to properly apply security-related
            //      changes to secured widgets
            var self = this,
                promises = [];

            when(self._targetHierPromise, function () {
                self._securedItems.forEach(lang.partial(applyItemSecurity, promises, securityContextId, locked), self);
                all(promises).then(function () {
                    postSecure && postSecure();
                });
            });
        }
    });
});