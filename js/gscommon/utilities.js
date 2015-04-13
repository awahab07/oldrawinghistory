/**
 * Created with JetBrains WebStorm.
 * User: olegg
 * Date: 10/9/12
 * Time: 10:26 AM
 * To change this template use File | Settings | File Templates.
 */
define([
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/dom-construct",
    "dojo/dom-class",
    "dojo/Deferred",
    "dojo/json",
    "dojo/promise/all",
    "dojo/when",
    "dojo/request/notify",
    "dojo/request/xhr",
    "dojo/io-query",
    "dojo/store/JsonRest",
    "dojo/store/Memory",
    "dijit/registry",
    "dijit/Dialog",
    "dijit/form/Button",
    "dojox/html/entities",
    "gscommon/LocalizationProvider",
    "gscommon/SecurityProvider",
    "gscommon/SecurityProviderClass",
    "conservation/base64"
],
function(lang, array, domConstruct, domClass, Deferred, json, all, when, notify, xhr, ioQuery, JsonRest, Memory,
         registry, Dialog, Button, HTMLEntities, LocalizationProvider, SecurityProvider, SecurityProviderClass, base64) {

    function setWidgetsPropRecursive(/*DomNode*/ parentNode, /*String*/ propName, propValue) {
        array.forEach(registry.findWidgets(parentNode), function(foundWidget) {
            if (foundWidget[propName] !== undefined) {
                foundWidget.set(propName, propValue);
            }
            setWidgetsPropRecursive(foundWidget.domNode, propName, propValue);
        });
    }

    function findWidgetsRecursive(/*DomNode*/ parentNode, /*Optional Array*/ targetArray) {
        if (targetArray === undefined) {
            var targetArray = [];
        }
        var results = registry.findWidgets(parentNode);
        if (results && results.length) {
            targetArray = targetArray.concat(results);
            array.forEach(results, function(foundWidget) {
                targetArray = findWidgetsRecursive(foundWidget.domNode, targetArray);
            });
        }
        return targetArray;
    }

    var cls = {
        messageBox: function(/*String|Object*/ message, /*String*/ title, /*Array?*/ actions, /*Integer?*/ defaultButtonIndex){
            // returns buttonCaptions array index
            var defaultButton = defaultButtonIndex || 0;
            var buttonIndex = defaultButton;
            var focusButton = null;
            var structuredMsg = false;

            if (typeof message == "object") {
                if (message["data"]) {
                    structuredMsg = (typeof message["data"] == "object");
                    if (!structuredMsg && "getHeader" in message && message.getHeader("Content-Type") == "application/json") {
                        message["data"] = json.parse(message["data"]);
                        structuredMsg = true;
                    }
                }
                if (structuredMsg && "message" in message["data"]) {
                    message = message["data"]["message"];
                } else if (message["text"]) {
                    message = message["text"];
                }
            }

            // determine whether the message is plain text or HTML
            // only complete HTML pages are handled as HTML
            // (may have to add more advanced pattern matching later)
            var pattern = /^\s?<html>/im;
            var isHTML = pattern.test(message);

            //var messageDom = domConstruct.create("div");
            //messageDom.textContent = message;
            var messageDialog = new Dialog({
                "class": "gsMessageBox",
                title: title,
                extractContent: isHTML,
                //content: messageDom
                content: isHTML ? message : "<pre class='gsMessageBoxText'>" + HTMLEntities.encode(message) + "</pre>"
            });


            messageDialog.on("hide", function() {
                messageDialog.destroyRecursive();
                buttonActions[buttonIndex].callback && buttonActions[buttonIndex].callback();
            });
            messageDialog.on("focus", function() {
                focusButton && focusButton.focus();
            });
            var buttonActions = actions || [{label:"Ok", callback:null}];
            if (!lang.isArray(buttonActions)) {
                buttonActions = [buttonActions];
            }
            var actionBarDom = domConstruct.create("div", {"class": "dijitDialogPaneActionBar"});

            var addButton = function(action, index){
                var button = new Button({
                    label: action.label,
                    "class": "galSysBlueButton"
                });
                //messageDialog.addChild(button);
                domConstruct.place(button.domNode, actionBarDom);
                if (index == defaultButton) {
                    focusButton = button;
                }
                button.on("click", function(evt){
                    buttonIndex = index;
                    messageDialog.hide();
                });
            };

            array.forEach(buttonActions, addButton);
            domConstruct.place(actionBarDom, messageDialog.containerNode);
            messageDialog.show();
        },
        getDisplayTerm: function(term, qualifier, modifier) {
            var displayTerm = "";
            if (term && term.length > 0) {
                displayTerm = term;
                if (modifier && modifier.length > 0) {
                    displayTerm = displayTerm + ", " + modifier;
                }
                if (qualifier && qualifier.length > 0) {
                    displayTerm = displayTerm + " (" + qualifier + ")";
                }
            }
            return displayTerm;
        },
        getDisplayDate: function(beginYear, endYear) {
            if (beginYear && !endYear) {
                return "" + beginYear;
            } else if (!beginYear && endYear) {
                return "" + endYear;
            } else if (beginYear && endYear) {
                return beginYear + " – " + endYear;
            } else {
                return null;
            }
        },
        getRelationshipLabel: function(/*String*/ directLabel, /*String?*/ reverseLabel) {
            if (reverseLabel) {
                return directLabel + " – " + reverseLabel;
            } else {
                return directLabel;
            }
        },
        setNestedWidgetsProperty: function(/*DomNode*/ parentNode, /*String*/ propertyName, propertyValue) {
            setWidgetsPropRecursive(parentNode, propertyName, propertyValue);
        },
        findNestedWidgets: function(/*DomNode*/ parentNode) {
            return findWidgetsRecursive(parentNode);
        },
        getLocalizableLabel: function(/*String*/ type, /*Integer*/ id, /*String*/ defaultLabel) {
            return {type: type, id: id, defaultLabel: defaultLabel};
        },
        getSearchResultsColumns: function(/*int*/ hierarchyId, /*String*/ usage, /*Object*/ app) {
            // summary:
            //      generates column definitions for search results grid ("gridx/Grid" widget)
            //      based on configuration entries in config.json
            // hierarchyId: Integer
            //      root hierarchy Id for the module
            // usage: String
            //      possible values: "navigation", "dashboard"
            // app: Object
            //      dojox/app view "app" property

            var columns,
                hierarchyKey = hierarchyId + "",
                searchResults, gridDefinition, columnDefs;
            if (app && app["galSysSettings"] && app["galSysSettings"]["searchResults"]) {
                searchResults = app["galSysSettings"]["searchResults"];
                if (searchResults[hierarchyKey] && searchResults[hierarchyKey].grid && searchResults[hierarchyKey].grid[usage]) {
                    gridDefinition = searchResults[hierarchyKey].grid[usage];
                    if (gridDefinition.columns && gridDefinition.columns.length) {
                        columns = array.map(gridDefinition.columns, function(column) {
                            var columnDef = {};
                            for (var prop in column) {
                                switch (prop) {
                                    case "columnId":
                                        columnDef["id"] = column[prop];
                                        break;
                                    case "field":
                                    case "width":
                                        columnDef[prop] = column[prop];
                                        break;
                                    case "label":
                                        columnDef["name"] = column[prop];
                                        break;
                                    case "type":
                                        switch (column[prop]) {
                                            case "IMAGE_URL":
                                                columnDef["widgetsInCell"] = true;
                                                columnDef["onCellWidgetCreated"] = function(cellWidget, column){
                                                    var thmb = domConstruct.create("img", {
                                                        "class": "galSysThumbnailImage",
                                                        draggable: true,
                                                        src: "",
                                                        dragstart: function (e) {
                                                            domClass.add(this, "galSysThumbnailDragging");
                                                            e.dataTransfer.effectAllowed = 'copy';
                                                            e.dataTransfer.setData('text', JSON.stringify([e.srcElement.dataObject]));
                                                        },
                                                        dragend: function () {
                                                            domClass.remove(this, "galSysThumbnailDragging");
                                                        }
                                                    }, cellWidget.domNode);
                                                    cellWidget.set('thmb', thmb);

                                                };

                                                columnDef["setCellValue"] = function(gridData, storeData, cellWidget){
                                                    cellWidget.thmb.src = gridData;
                                                    var object = lang.clone(cellWidget.cell.row.rawData());

                                                    for(key in object){
                                                        if(key.indexOf("__2825") > -1){
                                                            object.mediaMasterId = object[key];
                                                        }
                                                    }
                                                    cellWidget.thmb.dataObject = object;
                                                };
                                                break;
                                            case "TEXT":
                                                columnDef["decorator"] = function(data, rowId, visualIndex, cell) {
                                                    if (data) {
                                                        return HTMLEntities.encode(data);
                                                    }
                                                };
                                                break;
                                        }
                                        break;
                                    case "template":
                                        columnDef["formatter"] = function(/*Object*/ data, id) {
                                            return lang.replace(column["template"], data);
                                        };
                                        break;
                                    default:
                                        break;
                                }
                            }
                            return columnDef;
                        });
                    }
                }
            }
            if (columns && columns.length) {
                return columns;
            } else {
                return [
                    {
                        field: "imageUrl",
                        name: "Media",
                        decorator: function(data, rowId, visualIndex, cell) {
                            if (data) {
                                return "<img src='" + data + "' />";
                            }
                        }
                    },
                    {
                        name: "Object Info",
                        formatter: function(/*Object*/ data, id) {
                            var prop, combined = "";

                            for (prop in data) {
                                combined += (combined ? "; " : "") + data[prop];
                            }
                            return HTMLEntities.encode(combined);
                        }
                    }
                ];
            }
        },
        getModuleInfo: function(/*int*/ moduleId) {
            var moduleInfo = {
                moduleId: moduleId,
                hierarchyId: -1,
                contextId: -1
            };
            switch (moduleId) {
                case 1:     //Objects
                    moduleInfo.hierarchyId = 3;
                    moduleInfo.contextId = 41;
                    moduleInfo.name = "Objects";
                    break;
                case 9:     //Objects
                    moduleInfo.hierarchyId = 1233;
                    moduleInfo.contextId = 91;
                    moduleInfo.name = "Media";
                    break;
                case 12:    //Projects
                    moduleInfo.hierarchyId = 126183;
                    moduleInfo.contextId = 44;
                    moduleInfo.name = "Projects";
                    break;
                case 14:    //Conservation Reports
                    moduleInfo.hierarchyId = 126185;
                    moduleInfo.contextId = 48;
                    moduleInfo.name = "Conservation Reports";
                    break;
                case 3:  //Bibliography
                    moduleInfo.hierarchyId = 94;
                    moduleInfo.contextId = 108;
                    moduleInfo.name = "Bibliography";
                    break;
                case 8:  //Sites
                    moduleInfo.hierarchyId = 177;
                    moduleInfo.contextId = 123;
                    moduleInfo.name = "Sites";
                    break;

            }
            return moduleInfo;
        },
        getModuleInfoByHierarchy: function(/*int*/ hierarchyId) {
            var moduleInfo = {
                moduleId: -1,
                hierarchyId: hierarchyId,
                contextId: -1
            };
            switch (hierarchyId) {
                case 3:     //Objects
                    moduleInfo.moduleId = 1;
                    moduleInfo.contextId = 41;
                    moduleInfo.name = "Objects";
                    break;
                case 1233:     //Media
                    moduleInfo.moduleId = 9;
                    moduleInfo.contextId = 91;
                    moduleInfo.name = "Media";
                    break;
                case 126183:    //Projects
                    moduleInfo.moduleId = 12;
                    moduleInfo.contextId = 44;
                    moduleInfo.name = "Projects";
                    break;
                case 126185:    //Conservation Reports
                    moduleInfo.moduleId = 14;
                    moduleInfo.contextId = 48;
                    moduleInfo.name = "Conservation Reports";
                    break;
                case 94:  //Bibliography
                    moduleInfo.moduleId = 3;
                    moduleInfo.contextId = 108;
                    moduleInfo.name = "Bibliography";
                    break;
                case 177:  //Sites
                    moduleInfo.moduleId = 8;
                    moduleInfo.contextId = 123;
                    moduleInfo.name = "Sites";
                    break;
            }
            return moduleInfo;
        },
        getGridColumns: function(/*Array|Object*/ widgetColumns, /*dgrid/Grid*/grid) {
            // summary:
            //      generates column definitions for a grid ("dgrid/Grid" widget)
            //      based on widgetColumns array or object
            // widgetColumns: Array|Object
            //      Columns object as defined for dgrid widget with one exception:
            //      editable cell is defined by specifying "editor" property
            //      with an editor widget's module id assigned to it.
            //
            //      Example:
            //
            //        var gridColumns = [
            //            {
            //                editor: "dijit/form/FilteringSelect",
            //                field: "id",
            //                label: "label",
            //                localization: {
            //                    literalId: 101 | columnId: 202 | tableId: 303
            //                },
            //                editorArgs: {
            //                    style: "width:100%",
            //                    labelAttr: "label",
            //                    searchAttr: "label",
            //                    store: lookupStore,
            //                    onFocus: function() {
            //                        this.grid.clearSelection();
            //                        this.grid.select(this.value);
            //                    }
            //                }
            //            }
            //        ];
            //  grid: dgrid/Grid
            //  returns: dojo/promise/Promise
            var deferred = new Deferred();

            require([
                "dgrid/editor"
            ], function(editor) {

                var i, gridCol, editors = {}, gridColumns = lang.clone(widgetColumns);

                function getModulePromise(/*String*/ moduleId) {
                    var modDeferred = new Deferred();
                    require([moduleId], function(moduleConstructor) {
                        modDeferred.resolve(moduleConstructor);
                    });
                    return modDeferred.promise;
                }

                for (i in gridColumns) {
                    gridCol = gridColumns[i];
                    if (gridCol["editor"]) {
                        if (!editors[gridCol["editor"]]) {
                            editors[gridCol["editor"]] = getModulePromise(gridCol["editor"]);
                        }
                    }
                }

                when(all(editors), function(resolvedEditors) {
                    var i, colEditor;

                    for (i in gridColumns) {
                        if (gridColumns[i]["editor"]) {
                            colEditor = gridColumns[i]["editor"];
                            delete gridColumns[i]["editor"];
                            if (gridColumns[i]["editorArgs"]) {
                                gridColumns[i]["editorArgs"].grid = grid;
                            }
                            gridColumns[i] = editor(gridColumns[i], resolvedEditors[colEditor]);
                        }
                        if (gridColumns[i]["localization"]) {
                            delete gridColumns[i]["localization"];
                        }
                    }

                    deferred.resolve(gridColumns, true);
                });
            });
            return deferred.promise;
        },
        getFlexViewMvcMapping: function(/*Object*/ flexViewMvcSettings) {
            var mvcMap = {}, propName;

            if (flexViewMvcSettings) {
                if (flexViewMvcSettings.models && typeof flexViewMvcSettings.models == "object") {
                    mvcMap.models = {};
                    for (propName in flexViewMvcSettings.models) {
                        if (flexViewMvcSettings.models.hasOwnProperty(propName)) {
                            mvcMap.models[flexViewMvcSettings.models[propName]["typeId"]] = flexViewMvcSettings.models[propName]["module"];
                        }
                    }
                }
                if (flexViewMvcSettings.widgets && typeof flexViewMvcSettings.widgets == "object") {
                    mvcMap.widgets = {};
                    for (propName in flexViewMvcSettings.widgets) {
                        if (flexViewMvcSettings.widgets.hasOwnProperty(propName)) {
                            mvcMap.widgets[flexViewMvcSettings.widgets[propName]["typeId"]] = flexViewMvcSettings.widgets[propName]["module"];
                        }
                    }
                }
                if (flexViewMvcSettings.mvcMapping && lang.isArrayLike(flexViewMvcSettings.mvcMapping)) {
                    mvcMap.controllers = {};
                    array.forEach(flexViewMvcSettings.mvcMapping, function(modelMap) {
                        var modelTypeId = modelMap["modelTypeId"];
                        if (modelMap["widgets"] && lang.isArrayLike(modelMap["widgets"])) {
                            array.forEach(modelMap["widgets"], function(widgetMap) {
                                var widgetTypeId = widgetMap["typeId"];
                                if (!mvcMap.controllers[modelTypeId]) {
                                    mvcMap.controllers[modelTypeId] = {};
                                }
                                mvcMap.controllers[modelTypeId][widgetTypeId] = widgetMap["controller"];
                            });
                        }
                    });
                }
            }
            return mvcMap;
        },
        equals: function(x, y, /*Array?*/ ignoredPropNames) {
            var self = this, types;
            function getType(v) {
                // summary:
                //		Returns the type of the given value.

                return lang.isArray(v) ? "array" : lang.isFunction((v || {}).getTime) ? "date" : v != null && ({}.toString.call(v) == "[object Object]" || lang.isFunction((v || {}).set) && lang.isFunction((v || {}).watch)) ? "object" : "value";
            }

            function equalsArray(x, y) {
                for(var i = 0, l = Math.max(x.length, y.length); i < l; i++){
                    if(!self.equals(x[i], y[i])){ return false; }
                }
                return true;
            }

            function equalsDate(x, y) {
                return x.getTime() == y.getTime();
            }

            function equalsObject(x, y, ignoredPropNames) {
                var list = lang.mixin({}, x, y), ignored;
                if (ignoredPropNames && lang.isArrayLike(ignoredPropNames)) {
                    ignored = ignoredPropNames;
                }
                for(var s in list){
                    if ((!ignored || ignored.indexOf(s) == -1) && !self.equals(x[s], y[s])) {
                        return false;
                    }
                }
                return true;
            }

            function equalsValue(x, y) {
                return x === y;
            }

            types = [getType(x), getType(y)];

            if (types[0] != types[1]) {
                return false;
            } else {
                switch (types[0]) {
                    case "array":
                        return equalsArray(x, y);
                    case "date":
                        return equalsDate(x, y);
                    case "object":
                        return equalsObject(x, y, ignoredPropNames);
                    default:
                        return equalsValue(x, y);
                }
            }
        },
        parseTransitionTarget: function(/*String*/ target) {
            var targetParts = [];
            var parts = target.split("+");
            var removeParts, viewId;

            if (parts.length > 0) {
                while (parts.length > 1) {
                    viewId = parts.shift();
                    if (viewId.indexOf("-") >= 0) {
                        removeParts = viewId.split("-");
                        if (removeParts.length > 0) {
                            viewId = removeParts.shift();
                            if (viewId) {
                                targetParts.push({viewId: viewId.split(","), remove: false});
                            }
                            viewId = removeParts.shift();
                            if (viewId) {
                                targetParts.push({viewId: viewId.split(","), remove: true});
                            }
                        }
                    } else {
                        targetParts.push({viewId: viewId.split(","), remove: false});
                    }
                }
                viewId = parts.shift();
                removeParts = viewId.split("-");
                if (removeParts.length > 0) {
                    viewId = removeParts.shift();
                }
                if (viewId.length > 0) {
                    targetParts.push({viewId: viewId.split(","), remove: false});
                }
                if (removeParts.length > 0) {
                    while (removeParts.length > 0) {
                        viewId = removeParts.shift();
                        targetParts.push({viewId: viewId.split(","), remove: true});
                    }
                }
            }
            return targetParts;
        },
        getPreCachedStore: function(/*Object*/ app, /*String*/ storeName, /*Object*/ query,
                                    /*Function?*/ filter, /*String?*/ preCachedStoreName) {
            // summary:
            //      Returns a promise resolving to a memory store populated
            //      with the results of querying the back-end store
            //      optionally filtered by provided filtering function
            var memStoreName = preCachedStoreName || storeName,
                actualQuery = query || {},
                deferred = new Deferred(),
                queryPromise, finalResultsArray;

            if (!app["memoryStores"]) {
                app.memoryStores = {};
            }
            if (!app.memoryStores[memStoreName]) {
                app.memoryStores[memStoreName] = {};
            }
            if (app.memoryStores[memStoreName]["store"]) {
                deferred.resolve(app.memoryStores[memStoreName]["store"]);
            } else {
                queryPromise = app.memoryStores[memStoreName].promise
                    = app.stores[storeName].store.query(actualQuery, {headers: app.galSysSessionInfo.headers});
                when(queryPromise, function(resultsArray) {
                    if (filter && typeof filter == "function") {
                        finalResultsArray = array.filter(resultsArray, filter);
                    } else {
                        finalResultsArray = resultsArray;
                    }
                    app.memoryStores[memStoreName].store = new Memory({
                        idProperty: app.stores[storeName].store.idProperty,
                        getIdentity: app.stores[storeName].store.getIdentity,
                        data: finalResultsArray
                    });
                    deferred.resolve(app.memoryStores[memStoreName]["store"]);
                }, function(error) {
                    deferred.reject(error);
                });
            }
            return deferred.promise;
        },
        login: function(/*Object*/ app, /*String?*/ loginName, /*String?*/ password) {
            var authInfo, deferred = new Deferred(),
                utilities = this;
            var uiLanguageId = localStorage.getItem("uiLanguageId"),
                uiLanguageIsoCode = localStorage.getItem("uiLanguageIsoCode");
            uiLanguageId = uiLanguageId ? uiLanguageId : 1;
            uiLanguageIsoCode = uiLanguageIsoCode ? uiLanguageIsoCode : "en-US";

            var logonQuery = {
                username: loginName || "",
                password: password || ""
            };
            if (loginName && password) {
                authInfo = base64.encode(loginName + ":" + password);
            }
            var commonHeaders = {
                Accept: "application/javascript, application/json",
                //"X-GS-Auth": startupSettings.login,
                "X-GS-Auth": "tms",
                "X-GS-UI-LanguageId": Number(uiLanguageId).toString(),
                "X-GS-Product": app.productKey
            };
            if (authInfo) {
                commonHeaders.Authorization = "Basic " + authInfo;
            }
            var userInfo = null;
            var queryString = ioQuery.objectToQuery(logonQuery);

            when(xhr(app.galSysServiceUrls.login + "?" + queryString, {
                handleAs: "json",
                headers: commonHeaders,
                sync: true
            }), function(response) {
                var logonError;
                if (response.isStandardSecurity && !authInfo) {
                    // standard security requires user credentials provided
                    // with every request (otherwise we would have to deal with http session expiration handling)
                    logonError = new Error("Authorization credentials are missing!");
                    logonError.response = {status: 401};
                    // reject the deferred for proper logon screen handling
                    deferred.reject(logonError);
                    // notify the global authorization controller
                    notify.emit("done", logonError);
                } else {
                    userInfo = response;
                    app.galSysSessionInfo = {
                        uiLanguage: {
                            id: uiLanguageId,
                            isoCodeWithLocale: uiLanguageIsoCode
                        },
                        currentLanguageId: uiLanguageId,
                        logonQuery: logonQuery,
                        headers: commonHeaders,
                        user: userInfo
                    };

                    // obtain session preferences
                    var userSettingsStore = new JsonRest({
                        target: app.galSysServiceUrls["userPreferences"] + "61/",
                        headers: app.galSysSessionInfo.headers,
                        idProperty: "preferenceID"
                    });
                    app.galSysSessionInfo.promise = userSettingsStore.query({});
                    when(app.galSysSessionInfo.promise, function(userPreference) {
                        var settings;

                        if (userPreference) {
                            settings = JSON.parse(userPreference.preferenceValue);
                            if (settings) {
                                if (settings.locale) {
                                    app.galSysSessionInfo.locale = settings.locale;
                                }
                                if (settings.date) {
                                    app.galSysSessionInfo.dateSettings = settings.date;
                                }
                                if (!localStorage.getItem("uiLanguageId")
                                    && settings.language && settings.language.id !== null
                                    && settings.language.id != app.galSysSessionInfo.currentLanguageId) {

                                    app.galSysSessionInfo.uiLanguage = settings.language;
                                    app.galSysSessionInfo.currentLanguageId = settings.language.id - 0;
                                    app.galSysSessionInfo.headers["X-GS-UI-LanguageId"] = settings.language.id;
                                    if (app.galSysLocalizationProvider) {
                                        app.galSysLocalizationProvider.clearCache();
                                        app.galSysLocalizationProvider.localizeAll();
                                    }
                                }
                            }
                        }
                    });

                    // create additional stores
                    if (!app["memoryStores"]) {
                        app.memoryStores = {};
                    }
                    if (!app.memoryStores["uiLanguage"]) {
                        app.memoryStores.uiLanguage = {};
                    }
                    if (!app.memoryStores["language"]) {
                        app.memoryStores.language = {};
                    }
                    if (!app.memoryStores.uiLanguage["store"]) {
                        var langPromise = app.memoryStores.uiLanguage.promise
                            = app.stores.languageStore.store.query({}, {headers: app.galSysSessionInfo.headers});
                        when(langPromise, function(resultsArray) {
                            var uiLanguages = array.filter(resultsArray, function(uiLanguage) {
                                // UI languages have ids in a range from 1 to 10000
                                return uiLanguage.id > 0 && uiLanguage.id < 10001;
                            });
                            app.memoryStores.uiLanguage.store = new Memory({data: uiLanguages});
                            app.memoryStores.language.store = new Memory({data: resultsArray});
                        });
                    }
                    if (!app.memoryStores["ddContext"]) {
                        app.memoryStores.ddContext= {};
                    }
                    if (!app.memoryStores.ddContext["store"]) {
                        var contextPromise = app.memoryStores.ddContext.promise
                            = app.stores.ddContextStore.store.query({}, {headers: app.galSysSessionInfo.headers});
                        when(contextPromise, function(resultsArray) {
                            app.memoryStores.ddContext.store = new Memory({data: resultsArray});
                        });
                    }
                    if (!app.memoryStores["mediaTypes"]) {
                        app.memoryStores.mediaTypes = {};
                    }
                    if (!app.memoryStores.mediaTypes["store"]) {
                        var mediaTypesPromise = app.memoryStores.mediaTypes.promise
                            = app.stores.mediaTypesStore.store.query({}, {headers: app.galSysSessionInfo.headers});
                        when(mediaTypesPromise, function(resultsArray) {
                            app.memoryStores.mediaTypes.store = new Memory({data: resultsArray});
                        });
                    }

                    // create global localization provider
                    app.galSysLocalizationProvider = new LocalizationProvider({
                        commonContext: app.galSysSessionInfo,
                        columnLabelStore: app.stores.columnLabelStore.store,
                        tableLabelStore: app.stores.tableLabelStore.store,
                        literalStore: app.stores.literalStore.store,
                        customLabelStore: app.stores.customLabelStore.store,
                        hierarchyLabelStore: app.stores.hierarchyLabelStore.store
                    });
                    app.galSysLocalizationProvider.commonContext = app.galSysSessionInfo;

                    // create global security provider
                    app.galSysSecurityProvider = new SecurityProvider({
                        services: app.galSysServiceUrls,
                        commonContext: app.galSysSessionInfo
                    });

                    // create global security provider (new implementation - should replace the one above)
                    app.galSys.securityProvider = new SecurityProviderClass({app: app});

                    // set headers for tree store
                    app.stores["flexTreeStore"].store.headers = app.galSysSessionInfo.headers;

                    // create flex views MVC mapping
                    app.galSys["flexViews"] = {};
                    app.galSys["flexViews"]["mvcMapping"] = utilities.getFlexViewMvcMapping(app["galSysSettings"]["flexViews"]);

                    app.galSys["thesaurusSchemas"] = [];
                    app.stores["thesaurusSchemas"].store.query({}, {headers: app.galSysSessionInfo.headers}).forEach(function(thesaurusSchema) {
                        var schemaId = app.stores["thesaurusSchemas"].store.getIdentity(thesaurusSchema);
                        app.galSys["thesaurusSchemas"][schemaId] = thesaurusSchema;
                    });

                    deferred.resolve(response, false);
                }
            }, function(error) {
                deferred.reject(error);
            });

            return deferred.promise;

            //return xhr(app.galSysServiceUrls.login + "?" + queryString, {
            //    handleAs: "json",
            //    headers: commonHeaders,
            //    sync: true
            //}).then(function(response){
            //    userInfo = response;
            //    app.galSysSessionInfo = {
            //        currentLanguageId: uiLanguageId,
            //        logonQuery: logonQuery,
            //        headers: commonHeaders,
            //        user: userInfo
            //    };
            //    // create additional stores
            //    if (!app["memoryStores"]) {
            //        app.memoryStores = {};
            //    }
            //    if (!app.memoryStores["uiLanguage"]) {
            //        app.memoryStores.uiLanguage = {};
            //    }
            //    if (!app.memoryStores.uiLanguage["store"]) {
            //        var langPromise = app.memoryStores.uiLanguage.promise
            //            = app.stores.languageStore.store.query({}, {headers: app.galSysSessionInfo.headers});
            //        when(langPromise, function(resultsArray) {
            //            var uiLanguages = array.filter(resultsArray, function(uiLanguage) {
            //                // UI languages have ids in a range from 1 to 10000
            //                return uiLanguage.id > 0 && uiLanguage.id < 10001;
            //            });
            //            app.memoryStores.uiLanguage.store = new Memory({data: uiLanguages});
            //        });
            //    }
            //    if (!app.memoryStores["ddContext"]) {
            //        app.memoryStores.ddContext= {};
            //    }
            //    if (!app.memoryStores.ddContext["store"]) {
            //        var contextPromise = app.memoryStores.ddContext.promise
            //            = app.stores.ddContextStore.store.query({}, {headers: app.galSysSessionInfo.headers});
            //        when(contextPromise, function(resultsArray) {
            //            app.memoryStores.ddContext.store = new Memory({data: resultsArray});
            //        });
            //    }
            //    // create global localization provider
            //    app.galSysLocalizationProvider = new LocalizationProvider({
            //        commonContext: app.galSysSessionInfo,
            //        columnLabelStore: app.stores.columnLabelStore.store,
            //        tableLabelStore: app.stores.tableLabelStore.store,
            //        literalStore: app.stores.literalStore.store,
            //        customLabelStore: app.stores.customLabelStore.store,
            //        hierarchyLabelStore: app.stores.hierarchyLabelStore.store
            //    });
            //    app.galSysLocalizationProvider.commonContext = app.galSysSessionInfo;
            //
            //    // create global security provider
            //    app.galSysSecurityProvider = new SecurityProvider({
            //        services: app.galSysServiceUrls,
            //        commonContext: app.galSysSessionInfo
            //    });
            //
            //    // create global security provider (new implementation - should replace the one above)
            //    app.galSys.securityProvider = new SecurityProviderClass({app: app});
            //
            //    // set headers for tree store
            //    app.stores["flexTreeStore"].store.headers = app.galSysSessionInfo.headers;
            //
            //    // create flex views MVC mapping
            //    app.galSys["flexViews"] = {};
            //    app.galSys["flexViews"]["mvcMapping"] = utilities.getFlexViewMvcMapping(app["galSysSettings"]["flexViews"]);
            //
            //});
        }
    };

    return cls;
});