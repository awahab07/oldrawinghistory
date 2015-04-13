/**
 * Created with JetBrains WebStorm.
 * User: olegg
 * Date: 7/30/13
 * Time: 4:04 PM
 * To change this template use File | Settings | File Templates.
 */
define([
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/aspect",
    "dojo/on",
    "dojo/when",
    "dojo/promise/all",
    "dojo/topic",
    "dijit/Destroyable",
    "dojo/Deferred",
    "dojo/dom-style",
    "dojo/dom-class",
    "dojo/dom-construct",
    "dojo/dom-geometry",
    "dojo/query",
    "dojox/fx/scroll",
    "dijit/TitlePane",
    "gscommon/ViewModelFactory",
    "gscommon/ContextViewModel",
    "gscommon/SecurityManager",
    "gscommon/flexViews/widgets/WidgetFactory",
    "gscommon/flexViews/models/ModelFactory",
    "gscommon/flexViews/controllers/ControllerFactory",
    "gscommon/flexViews/models/_base",
    "gscommon/flexViews/widgets/GridLayout",
    "gscommon/flexViews/controllers/FlexFieldsGridController",
    "gscommon/flexViews/models/FlexFieldContainerModel"
], function (lang, array, aspect, on, when, all, topic, Destroyable, Deferred, domStyle, domClass, domConstruct, domGeom,
             query, scroll, TitlePane, ViewModelFactory, ContextViewModel, SecurityManager, WidgetFactory, ModelFactory,
             ControllerFactory, modelBase, GridLayout, FlexFieldsGridController, FlexFieldContainerModel) {

    var parseModelCompositions = function (/*Object*/ modelCompositions) {
        // returns: flat array of container model compositions
        var results = [], modelComp, i, l, prop, j, childrenLen;
        for (i = 0, l = modelCompositions.length; i < l; i++) {
            if (modelCompositions[i].modelInfo.operationalMode === modelBase.operationalMode.container
                || modelCompositions[i].modelInfo.operationalMode === modelBase.operationalMode.flexFieldContainer) {
                modelComp = {};
                for (prop in modelCompositions[i]) {
                    if (prop === "children") {
                        childrenLen = modelCompositions[i][prop].length;
                        if (childrenLen) {
                            modelComp[prop] = [];
                            for (j = 0; j < childrenLen; j++) {
                                if (modelCompositions[i][prop][j].modelInfo.operationalMode === modelBase.operationalMode.container) {
                                    results = results.concat(parseModelCompositions([modelCompositions[i][prop][j]]));
                                } else {
                                    modelComp[prop].push(modelCompositions[i][prop][j]);
                                }
                            }
                        }
                    } else if (typeof modelCompositions[i][prop] == "object") {
                        modelComp[prop] = lang.clone(modelCompositions[i][prop]);
                    } else {
                        modelComp[prop] = modelCompositions[i][prop];
                    }
                }
                results.push(modelComp);
            }
        }
        return results;
    };

    var getAnchorPane = function (/*Object*/ widgetProps) {
        var props, openState, isOpen, titlePane;
        props = {};
        if (widgetProps["anchor label"]) {
            props.title = widgetProps["anchor label"];
        }
        if (widgetProps["stay always open"]) {
            openState = widgetProps["stay always open"];
            props.toggleable = openState != 'AlwaysOpen' ? true : false;

            switch (openState) {
                case 'AlwaysOpen':
                    isOpen = true;
                    break;
                case 'OpenByDefault':
                    isOpen = true;
                    break;
                case 'ClosedByDefault':
                    isOpen = false;
                    break;
                default:
                    isOpen = true;
                    break;
            }

            props.open = isOpen;
        }
        titlePane = new TitlePane(props);
        titlePane.on("show", function() {
            var childWidgets, i, l;
            if (titlePane.hasChildren()) {
                childWidgets = titlePane.getChildren();
                for (i = 0, l = childWidgets.length; i < l; i++) {
                    childWidgets[i].resize && childWidgets[i].resize();
                }
            }
        });
        return titlePane;
    };

    var updateWidgetLabel = function (/*String*/ name, /*String*/ oldValue, /*String*/ value) {
        if (this.labelNode.textContent !== undefined) {
            this.labelNode.textContent = value || "";
        } else {
            this.labelNode.innerText = value || "";
        }
    }

    return {
        viewId: null,
        loadingDeferred: null,
        viewContentPane: null,
        getViewModelFactory: function () {
            var self = this;
            if (!self._viewModelFactory) {
                self._viewModelFactory = new ViewModelFactory({app: self.app});
            }
            return self._viewModelFactory;
        },
        load: function (/*Integer*/ viewId, /*Integer*/ contextId, /*Integer*/ id, /*Function*/ callback) {
            var self = this, widgets, models, controllers, viewInfo;
            var loadDeferred = new Deferred();
            self.loadingDeferred = loadDeferred.promise;

            self._contextTranslatePromise = self.app.stores["contextTranslationStore"].store.query({
                "contextid": contextId,
                "uiviewid": viewId,
                "itemid": id
            }, {
                headers: self.app.galSysSessionInfo && self.app.galSysSessionInfo.headers
            });

            if (!self._viewModelFactory) {
                self._viewModelFactory = new ViewModelFactory({app: self.app});
            }
            if (!self._widgetFactory) {
                self._widgetFactory = new WidgetFactory({app: self.app});
            }
            if (!self._modelFactory) {
                self._modelFactory = new ModelFactory({app: self.app});
            }
            if (!self._controllerFactory) {
                self._controllerFactory = new ControllerFactory({app: self.app});
            }
            if (self._securityHandle) {
                self._securityHandle.cancel();
                self._securityHandle = null;
            }
            if (self._securityLoadWatchHandle) {
                self._securityLoadWatchHandle.remove();
                self._securityLoadWatchHandle = null;
            }
            if (!self._securityManager) {
                self._securityManager = new SecurityManager({securityProvider: self.app.galSys.securityProvider});
            }

            self.destroyable = new Destroyable();

            self.viewId = +viewId;
            self.viewName = "null";
            //self._models = {};
            self._selfLoadModels = {};
            self._containerLoadModels = {};
            self._selfUpdateModels = {};
            self._flexFieldModels = {};
            widgets = [];
            models = [];
            controllers = [];
            //widgets.push(new TextBox({value: "Context Id: " + contextId + ", id: " + id}));
            when(self._viewModelFactory.getView(self.viewId), function (viewInfo) {
                var i, l, viewItems, widgetInfo, modelInfo, widgetPromise, modelPromise, controllerPromise,
                    modelItem, modelItems, rootModelItems, results, prop, dependentModels;

                self.viewName = viewInfo.name;

                if (viewInfo.viewCompositionItems && viewInfo.viewCompositionItems.length && viewInfo.viewCompositionItems.length > 0) {
                    viewItems = viewInfo.viewCompositionItems;
                    viewItems.sort(function (a, b) {
                        return a.position - b.position
                    });
                    for (i = 0, l = viewItems.length; i < l; i++) {
                        widgetInfo = viewItems[i].widgetInfo;
                        if (widgetInfo.widgetTypeId == 6 /*"AnchorLayoutWidget"*/ || widgetInfo.widgetTypeId == 7 /*"MultiColumnFlow"*/
                            || widgetInfo.widgetTypeId == 23 /*"FlexFieldLayout"*/ || widgetInfo.widgetTypeId == 37 ) {

                            widgetInfo.id = viewItems[i].id; // add id to utilize for scrolling to anchor with navTree.
                            widgets.push(widgetInfo);
                        } else {
                            widgetPromise = self._widgetFactory.getWidget(widgetInfo);
                            if (widgetPromise) {
                                widgets.push(widgetPromise);
                            }
                        }
                        modelItem = viewItems[i].modelComposition;
                        if (modelItem) {
                            modelInfo = modelItem.modelInfo;
                            if (modelInfo) {
                                modelPromise = self._modelFactory.getModel(modelItem);
                                if (modelPromise) {
                                    models.push(modelPromise);

                                    // collect models
                                    if (modelInfo.operationalMode == modelBase.operationalMode.selfManaged) {
                                        self._selfLoadModels[modelItem.id] = modelPromise;
                                        self._selfUpdateModels[modelItem.id] = modelPromise;
                                    } else if (modelInfo.operationalMode == modelBase.operationalMode.flexField) {
                                        self._flexFieldModels[modelItem.id] = modelPromise;
                                    } else {
                                        self._containerLoadModels[modelItem.id] = modelPromise;
                                    }

                                    when(all({viewCompositionItem: viewItems[i], widget: widgetPromise, model: modelPromise}), function (widgetAndModel) {
                                        // enforce widget security
                                        var columnInfo, modelInfo = widgetAndModel.viewCompositionItem.modelComposition.modelInfo;
                                        if (!modelInfo.securitySelfHandled) {
                                            if (modelInfo.columnInfo && modelInfo.columnInfo.length) {
                                                columnInfo = array.filter(modelInfo.columnInfo, function(columnDef) {
                                                    return columnDef.isModifyableInModel;
                                                });
                                            }
                                            if (columnInfo && columnInfo.length) {
                                                if (modelInfo.modelTypeId == 31 /*LockBinaryChoiceModel*/) {
                                                    self._securityManager.secureByColumn(widgetAndModel.widget, true, columnInfo[0].id, columnInfo[0].hierarchyId, null, true, true, "readOnly", null, false);
                                                } else {
                                                    self._securityManager.secureByColumn(widgetAndModel.widget, true, columnInfo[0].id, columnInfo[0].hierarchyId);
                                                }
                                            } else {
                                                self._securityManager.secureByHierarchy(widgetAndModel.widget, true, true, true, false, false, modelInfo.hierarchyId);
                                            }

                                        }

                                        // pass widget and model to their controller
                                        controllerPromise = self._controllerFactory.getController(widgetAndModel.viewCompositionItem,
                                            widgetAndModel.model, widgetAndModel.widget, self.app.galSysLocalizationProvider, self.app.galSys.securityProvider);
                                        if (controllerPromise) {
                                            controllers.push(controllerPromise);
                                        }
                                    });
                                }
                            }
                        }
                    }
                    if (viewInfo.modelCompositions && viewInfo.modelCompositions.length && viewInfo.modelCompositions.length > 0) {
                        // get container model compositions for container models
                        modelItems = parseModelCompositions(viewInfo.modelCompositions);
                        if (modelItems.length && modelItems.length > 0) {
                            rootModelItems = {};
                            for (i = 0, l = modelItems.length; i < l; i++) {
                                dependentModels = {};
                                if (modelItems[i].modelInfo.operationalMode === modelBase.operationalMode.flexFieldContainer) {
                                    if (modelItems[i].children && modelItems[i].children.length) {
                                        array.forEach(modelItems[i].children, function (modelItemChild) {
                                            if (modelItemChild.id in self._flexFieldModels) {
                                                dependentModels[modelItemChild.id] = self._flexFieldModels[modelItemChild.id];
                                            }
                                        });
                                        // create updateable model
                                        self._selfLoadModels[modelItems[i].id] = self._selfUpdateModels[modelItems[i].id]
                                            = new FlexFieldContainerModel({app: self.app});
                                        self._selfUpdateModels[modelItems[i].id].init(contextId, modelItems[i], dependentModels);
                                    }
                                } else {
                                    if (modelItems[i].children && modelItems[i].children.length) {
                                        array.forEach(modelItems[i].children, function (modelItemChild) {
                                            if (modelItemChild.id in self._containerLoadModels) {
                                                dependentModels[modelItemChild.id] = self._containerLoadModels[modelItemChild.id];
                                            }
                                        });
                                        // create updateable model
                                        self._selfUpdateModels[modelItems[i].id] = new ContextViewModel({app: self.app});
                                        self._selfUpdateModels[modelItems[i].id].init(contextId, modelItems[i], dependentModels);
                                        if (modelItems[i].parentId) {
                                            // TODO: change the above condition to:
                                            // modelItems[i].parentId != null
                                            // once a current bug causing it to be equal to 0 is fixed

                                            // add current container children to its root level ascendant
                                            modelItem = modelItems[i];
                                            while (modelItem.parentId) {
                                                results = array.filter(modelItems, function (item) {
                                                    return (item.id == modelItem.parentId);
                                                });
                                                if (results.length) {
                                                    modelItem = results[0];
                                                } else {
                                                    break;
                                                }
                                            }
                                            if (!modelItem.parentId) {
                                                // TODO: change the above condition to:
                                                // modelItem.parentId == null
                                                // once a current bug causing it to be equal to 0 is fixed

                                                // found the root level ascendant for the current container model
                                                if (!rootModelItems[modelItem.id]) {
                                                    modelItem = lang.clone(modelItem);
                                                    rootModelItems[modelItem.id] = modelItem;
                                                } else {
                                                    modelItem = rootModelItems[modelItem.id];
                                                }
                                                if (!modelItem.children) modelItem.children = [];
                                                modelItem.children = modelItem.children.concat(modelItems[i].children);
                                            }
                                        } else {
                                            if (!(modelItems[i].id in rootModelItems)) {
                                                rootModelItems[modelItems[i].id] = modelItems[i];
                                            }
                                        }
                                    }
                                }
                            }
                            for (prop in rootModelItems) {
                                self._selfLoadModels[rootModelItems[prop].id] = new ContextViewModel({app: self.app});
                                self._selfLoadModels[rootModelItems[prop].id].init(contextId, rootModelItems[prop],
                                    self._containerLoadModels, self._selfUpdateModels);

                                // apply security on model load
                                if (!self._securityLoadWatchHandle) {
                                    self._securityLoadWatchHandle = aspect.before(self._selfLoadModels[rootModelItems[prop].id], "load", function(id, securityContextId, locked) {
                                        self._securityManager.apply(securityContextId, locked);
                                    });
                                }
                            }
                        }
                    }
                }

                if (self._controllers) {
                    for (i = 0, l = self._controllers.length; i < l; i++) {
                        when(self._controllers[i], function(controller) {
                            controller.destroy && controller.destroy();
                        });
                    }
                    self._controllers = null;
                }
                if (self._models) {
                    for (i = 0, l = self._models.length; i < l; i++) {
                        when(self._models[i], function(model) {
                            model.destroy && model.destroy();
                        });
                    }
                    self._models = null;
                }
                if (self._widgets) {
                    for (i = 0, l = self._widgets.length; i < l; i++) {
                        when(self._widgets[i], function(widget) {
                            widget.destroy && widget.destroy();
                        });
                    }
                    self._widgets = null;
                }

                callback(widgets);

                when(all({widgets: all(widgets), models: all(models)}), function (widgetsAndModels) {
                    // initialize security for widgets
                    self._securityHandle = self._securityManager.initialize();

                    self._widgets = widgetsAndModels.widgets;
                    self._models = widgetsAndModels.models;
                    when(all(controllers), function (controllers) {
                        self._controllers = controllers;
                        loadDeferred.resolve();
                    });
                });
            }, function (error) {
                loadDeferred.reject(error);
            });
        },
        changeSelection: function (/*Integer*/ id, /*Integer*/ securityContextId, /*Boolean*/ locked) {
            var self = this, prop, modelOrPromise, deferred = new Deferred(),
                modelPromises = [], dataPromises = [], contextTranslationPromise = {};

            if (self._selfLoadModels) {
                for (prop in self._selfLoadModels) {
                    modelOrPromise = self._selfLoadModels[prop];
                    modelPromises.push(modelOrPromise);
                    when(modelOrPromise, function (model) {
                        var contextId;
                        if ("contextId" in model) {
                            contextId = model.contextId;
                        } else if ("modelType" in model && "contextId" in model.modelType) {
                            contextId = model.modelType["contextId"];
                        }
                        if (contextId) {
                            if (contextId !== self.contextId) {
                                contextTranslationPromise = self._contextTranslatePromise;
                            }
                            when(contextTranslationPromise, function (contextTranslation) {
                                var translation;
                                if (contextTranslation && contextTranslation[contextId]) {
                                    translation = contextTranslation[contextId];
                                    dataPromises.push(model.load(translation.itemId, translation.securityContextId, locked));
                                } else {
                                    dataPromises.push(model.load(id, securityContextId, locked));
                                }
                            }, function (error) {
                                dataPromises.push(model.load(id, securityContextId, locked));
                            });
                        } else {
                            dataPromises.push(model.load(id, securityContextId, locked));
                        }
                    });
                }
                when(all(modelPromises), function () {
                    when(all(dataPromises), function () {
                        deferred.resolve();
                    }, function (error) {
                        deferred.reject(error);
                    });
                }, function (error) {
                    deferred.reject(error);
                });
            } else {
                deferred.reject();
            }
            return deferred.promise;
        },
        save: function () {
            var self = this, prop, modelOrPromise, deferred = new Deferred(),
                modelPromises = [], dataPromises = [];
            if (self.loadingDeferred && self.loadingDeferred.isResolved() && self._selfUpdateModels) {
                for (prop in self._selfUpdateModels) {
                    modelOrPromise = self._selfUpdateModels[prop];
                    modelPromises.push(modelOrPromise);
                    when(modelOrPromise, function (model) {
                        if (model.save) {
                            dataPromises.push(model.save());
                        }
                    });
                }
                when(all(modelPromises), function () {
                    when(all(dataPromises), function () {
                        deferred.resolve();
                    }, function (error) {
                        deferred.reject(error);
                    });
                }, function (error) {
                    deferred.reject(error);
                });
            } else {
                deferred.resolve();
            }
            return deferred.promise;
        },
        layout: function (/*Object[]*/ widgets) {
            var self = this, i, l;
            var content = self.viewContentPane;
            var oldWidgets = content.getChildren();
            var evt = self.app.navigateEvent;
            var departmentId = evt.item["departmentId$"];


            if (!self.labelWidgetNodes) {
                self.labelWidgetNodes = [];
            }
            if (!self.labeledWidgetNodeWrappers) {
                self.labeledWidgetNodeWrappers = [];
            }
            if (!self.multiColumnFlows) {
                self.multiColumnFlows = [];
            }
            if (!self.lineWidgets) {
                self.lineWidgets = [];
            }
            self.flexViewAnchorLayouts = {};

            array.forEach(oldWidgets, function (oldWidget) {
                content.removeChild(oldWidget);
            });

            //remove previous labelWidgetNodes
            array.forEach(self.labelWidgetNodes, function (labelWidgetNode) {
                labelWidgetNode.remove();
            });
            //remove previous labelWidgetNodeWrappers
            array.forEach(self.labeledWidgetNodeWrappers, function (labeledWidgetNodeWrapper) {
                labeledWidgetNodeWrapper.remove();
            });

            //remove previous multiColumnFlows
            array.forEach(self.multiColumnFlows, function (multiColumnFlow) {
                multiColumnFlow.remove();
            });

            //remove previous lineWidgets
            array.forEach(self.lineWidgets, function (lineWidget) {
                lineWidget.remove();
            });

            if (self.flexFieldGridControllers) {
                array.forEach(self.flexFieldGridControllers, function (flexFieldGridCtrl) {
                    flexFieldGridCtrl.destroy();
                });
            }
            self.flexFieldGridControllers = [];


            when(all(widgets), function (resolvedWidgets) {
                var widgetTypeId, widgetParams, widgetProps, widgetWidth, titlePane, layoutPane, columnCount,
                    labeledWidgetNode, labeledWidgetNodeWrapper, labelNode, gridLayout, gridController, widgetHeaderNode,
                    widgetHeaderRow, labelWrapper, dataEntryRow, widgetOuter, visualPane;
                titlePane = content;
                layoutPane = content.domNode;
                columnCount = 1;
                widgetWidth = "99%";

                var columnCounter = 1,
                    rowCounter = 1,
                    dataEntryRow = domConstruct.create("div", {
                        "class": "galSysDataEntryRow " + "dataEntryRow" + rowCounter,
                        rowCounter: rowCounter
                    });

                for (i = 0, l = resolvedWidgets.length; i < l; i++) {
                    widgetTypeId = resolvedWidgets[i].widgetTypeId;
                    if (widgetTypeId && (widgetTypeId == 6 /*"AnchorLayoutWidget"*/ || widgetTypeId == 7
                       /*"MultiColumnFlow"*/ || widgetTypeId == 23 /*"FlexFieldLayout"*/ || widgetTypeId == 22
                       /*"FlexField"*/ || widgetTypeId == 29 /*"ImportedView"*/ ||
                       widgetTypeId == 37 /* LineWidget */)) {

                        widgetParams = resolvedWidgets[i].initParams;
                        widgetProps = {};
                        if (widgetParams && widgetParams.length) {
                            for (var j = 0, k = widgetParams.length; j < k; j++) {
                                widgetProps[widgetParams[j].name.toLowerCase()] = widgetParams[j].value;
                            }
                        }
                        if (widgetTypeId == 6 /*"AnchorLayoutWidget"*/) {
                            if (widgetProps["column count"]) {
                                columnCount = parseInt(widgetProps["column count"]);
                                if (isNaN(columnCount)) {
                                    columnCount = 1;
                                }
                            }
                            widgetWidth = "99%";
                            titlePane = getAnchorPane(widgetProps);
                            layoutPane = titlePane.containerNode;

                            domStyle.set(titlePane.domNode, {
                                //width: "100%"
                            });
                            domStyle.set(titlePane.hideNode, {
                                borderStyle: "none"
                            });
                            domStyle.set(titlePane.titleBarNode, {
                                borderLeft: "none",
                                borderRight: "none"
                            });


                            content.addChild(titlePane);
                            self.flexViewAnchorLayouts[resolvedWidgets[i].id] = titlePane;


                        } else if (widgetTypeId == 7 /*"MultiColumnFlow"*/) {
                            if (widgetProps["column count"]) {
                                columnCount = parseInt(widgetProps["column count"]);
                                if (isNaN(columnCount)) {
                                    columnCount = 1;
                                    widgetWidth = "99%";
                                } else {
                                    widgetWidth = ((100 / columnCount) - 1) + "%";
                                }
                            }
                            layoutPane = domConstruct.create("div", {
                                "class": "galSysLabeledWidgetRow " + "galSys" + columnCount + "CellRow"
                            });

                            self.multiColumnFlows.push(layoutPane);

                            domStyle.set(layoutPane, {
                                /*width: "100%",
                                 float : "left"*/
                            });
                            titlePane.containerNode.appendChild(layoutPane);
                        } else if (widgetTypeId == 23 /*"FlexFieldLayout"*/) {
                            // TODO: create GridLayout widget here
                            gridLayout = new GridLayout({
                                selectionMode: "single",
                                className: "dgrid-autoheight galSysGridLayout"
                                //className: "dgrid-autoheight"
                            });
                            gridController = new FlexFieldsGridController({
                                app: self.app,
                                grid: gridLayout,
                                layoutProperties: widgetProps,
                                localizationProvider: self.app.galSysLocalizationProvider
                            });
                            self.flexFieldGridControllers.push(gridController);
                            domStyle.set(gridLayout.domNode, {
                                width: "100%"
                                /*display: "inline-block",
                                 width: widgetWidth,
                                 marginLeft: "0.5%",
                                 marginRight: "0.5%",
                                 marginTop: "0.5em",
                                 marginBottom: "0.5em",
                                 boxSizing: "border-box"*/
                            });
                            //domClass.add(gridLayout.domNode, "galSysDataView");
                            layoutPane.appendChild(gridLayout.domNode);
                            gridLayout.startup();
                        } else if (widgetTypeId == 22 /*"FlexField"*/) {
                            gridController.addFlexField(resolvedWidgets[i]);
                        } else if (widgetTypeId == 29 /*"ImportedView"*/) {
                            domStyle.set(resolvedWidgets[i].domNode, {width: "100%"});
                            content.addChild(resolvedWidgets[i]);
                        } else if (widgetTypeId == 37 /*"LineWidget"*/) {
                            //reset the layoutPane to content.domNode because subsequent added widgets will
                            //need to be added to this or new layout widget and not the previous
                            // layout widget
                            layoutPane = content.domNode;
                            visualPane = domConstruct.create("div", {
                                "class": 'galSysLayoutLine'
                            });
                            content.domNode.appendChild(visualPane);
                            self.lineWidgets.push(visualPane);
                        }
                    } else {

                        resolvedWidgets[i].lockProp = true; //will be used in RecordLocking Subscribe function
                        widgetOuter = domConstruct.create("div", {"class": "galSysWidgetOuter"});
                        labeledWidgetNode = domConstruct.create("div", {"class": "galSysLabeledWidget"});

                        if (resolvedWidgets[i].labelCaption !== undefined
                            && resolvedWidgets[i].labelPosition
                            && resolvedWidgets[i].labelPosition !== "none") {
                            self.labelWidgetNodes.push(labeledWidgetNode);
                            widgetHeaderNode = domConstruct.create("div", {"class": "galSysWidgetHeader"}, widgetOuter);
                            widgetHeaderRow = domConstruct.create("div", {"class": "galSysWidgetHeaderRow"}, widgetHeaderNode);
                            labelWrapper = domConstruct.create("div", {"class": "galSysWidgetLabelArea"}, widgetHeaderRow);
                            resolvedWidgets[i].labelNode = domConstruct.create('label', {
                                'class': (resolvedWidgets[i].labelPosition == "side") ? "galSysCapPosSide" : "galSysCapPosTop"
                            }, labelWrapper, "first");
                            lang.hitch(resolvedWidgets[i], updateWidgetLabel)("labelCaption", "", resolvedWidgets[i].labelCaption);
                            resolvedWidgets[i].watch("labelCaption", updateWidgetLabel);
                        }

                        domConstruct.place(resolvedWidgets[i].domNode, widgetOuter);
                        domConstruct.place(widgetOuter, labeledWidgetNode);

                        labeledWidgetNodeWrapper = domConstruct.create("div", {
                            "class": "galSysLabeledWidgetCell"
                        });

                        self.labeledWidgetNodeWrappers.push(labeledWidgetNodeWrapper);

                        labeledWidgetNodeWrapper.appendChild(labeledWidgetNode);

                        /*dataEntryRow.appendChild(labeledWidgetNodeWrapper);
                         if(columnCounter == columnCount){
                         layoutPane.appendChild(dataEntryRow);
                         }*/


                        layoutPane.appendChild(labeledWidgetNodeWrapper);


                        if (columnCounter == columnCount) {
                            rowCounter = rowCounter + 1;
                            columnCounter = 1;
                            dataEntryRow = domConstruct.create("div", {
                                "class": "galSysDataEntryRow " + "dataEntryRow" + rowCounter,
                                rowCounter: rowCounter
                            });
                        } else {
                            columnCounter = columnCounter + 1;
                        }

                        resolvedWidgets[i].startup();
                    }
                }

                //Lock Record Topic Subscription Code will Disable all widgets if value of lock is true
                topic.subscribe("RecordLocking", function (value) {
                    self._securityManager.apply(departmentId, value);
                    //var allGrids = self.flexFieldGridControllers;
                    //for (var j = 0; j < allGrids.length; j++) {
                    //    var selectedGrid = allGrids[j];
                    //    var gridColumns = selectedGrid.grid.columns;
                    //    for (var c in gridColumns) {
                    //        gridColumns[c]["canEdit"] = function (object, val) {
                    //            return !value;
                    //        };
                    //    }
                    //    selectedGrid.grid.refresh();
                    //}
                });

                var scrollableContent = query('.galSysContextScrollableArea')[0],
                    banner = query('.galSysBannerDataView')[0];

                if (banner) {
                    var bannerHeight = domGeom.getMarginBox(banner).h;
                    domStyle.set(scrollableContent, {
                        top: bannerHeight + "px"
                    });
                }

                if (!self.anchorNavigations) {
                    self.anchorNavigations = topic.subscribe("NavigationView/goToAnchor", function (anchorId) {

                        var scrollableContent = query('.galSysContextScrollableArea')[0];
                        var layoutAnchor = self.flexViewAnchorLayouts[anchorId];
                        if (layoutAnchor) {
                            var anchorClickNode = query('.dijitTitlePaneTitle', layoutAnchor.domNode)[0];

                            var scroll = new dojox.fx.smoothScroll({
                                node: layoutAnchor.domNode,
                                win: scrollableContent,
                                duration: 800
                            });

                            scroll.play();

                            if (!layoutAnchor.open) {
                                anchorClickNode.click();
                            }
                        }

                    });

                    self.destroyable.own(self.anchorNavigations);
                }

            });
        }
    };
});