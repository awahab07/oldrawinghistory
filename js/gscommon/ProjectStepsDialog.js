/**
 * Created by Jason Hornbuckle
 */
define([
    "dojo/_base/declare",
    "dojo/Deferred",
    "dojo/request/xhr",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/dom-style",
    "dojo/dom-class",
    "dojo/dom-attr",
    "dojo/query",
    "dojo/when",
    "dojo/store/Memory",
    "dojo/store/Observable",
    "dojo/dom-construct",
    "dijit/ConfirmDialog",
    "dojo/dom-geometry",
    "dijit/form/Button",
    "gscommon/flexViews/widgets/DateInput",
    "gscommon/flexViews/models/ISODateModel",
    "gscommon/flexViews/controllers/ISODateController",
    "require",
    "dgrid/OnDemandGrid",
    "dgrid/Keyboard",
    "dgrid/Selection",
    "dgrid/selector",
    "dgrid/editor",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dijit/DialogUnderlay",
    "dojo/_base/window",
    "gscommon/LocalizationManager",
    "dojo/Stateful",
    "dojox/mvc/sync",
    "dojo/json",
    "gscommon/_LocalizeMixin",
    "gscommon/GalSysToolbar",
    "gscommon/flexViews/models/UvListViewModel",
    "gscommon/utilities"
], function (declare, Deferred, xhr, lang, array, domStyle, domClass, domAttr, query, when, Memory, Observable,
             domConstruct,ConfirmDialog, domGeometry, Button, DateInput, ISODateModel, ISODateController, require,
             OnDemandGrid, Keyboard, Selection, selector, editor, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin,
             DialogUnderlay, win, LocalizationManager, Stateful, sync, json, _LocalizeMixin, GalSysToolbar,
             UvListViewModel, utils) {

             //////////////////////////////////////
             // How to Use:
             //  var projectId = 1;
             //  var projectTitle = “My Project”;
             //  var manProjectStepsDialog = new ProjectStepsDialog({ app:  app });
             //
             //  manProjectStepsDialog.show(projectId, projectTitle);
             //
             //   manProjectStepsDialog.onOkClick = function (steps) {
             //    //do whatever you need to do with the updated steps.
             //}
             //
             //
             //  in your destroy method for your widget/controller you will also need to call destroy:
             //
             //    manProjectStepsDialog.destroy();
             ///////////////////////////////////


    var DialogModel = declare(Stateful, {
        app: null,
        headers: null,
        projectId: null,
        stepsStore: null,
        newStepLabel: 'Not Specified',
        okLabel: 'OK',
        errorLabel: 'Error',
        duplicateLabelMssg: 'Project already has step with label: {0}.  Please rename that step before creating a new one.',
        deleteWarning: 'There are {0} sub-reports associated with this project step. Removing it will also remove it from these sub-reports',
        warningLabel: 'Warning',
        deleteLabel: 'Delete',
        cancelLabel: 'Cancel',
        tableIdOfParentReport: null,
        projectTitle: null,
        _saveDialog: null,
        _createUrl: null,
        _deleteUrl: null,
        _updateUrl: null,
        _orderUrl: null,
        _projectStepsUrl: null,
        constructor: function (/*Object?*/ args) {
            lang.mixin(this, args);
            this.headers = lang.clone(this.app.galSysSessionInfo.headers);
            this._projectStepsUrl = this.app.galSysServiceUrls.projectSteps;
            this._createUrl = this._projectStepsUrl;
            this._deleteUrl = this._projectStepsUrl + '/';
            this._updateUrl = this._projectStepsUrl + '/';
            this._orderUrl = this.app.galSysServiceUrls.projectStepsOrder;
            this._projectConReportsUrl = this.app.galSysServiceUrls.projectConReports;
        },
        validate: function (/* string */ action, /* Object */ data) {
            var self = this, validation;

            validation = {
                isValid: true,
                errors: []
            };

            validation.isValid = true;

            /////////////
            //
            //  Do custom validation and push an error object onto validation.errors for each error. Each error
            //  object can have type and message property which can be used by an outside controller for
            //  setting widget state.
            //
            /////////////

            ////////////////////
            if (action === 'create') {

                var items = this.stepsStore.query();

                array.forEach(items, function (item) {
                    var msg;
                    if(item.stepLabel === data.stepLabel){
                        validation.isValid = false;
                        msg = lang.replace(self.duplicateLabelMssg, {
                            0: self.newStepLabel
                        });
                        validation.errors.push({
                            type: 'create',
                            message: msg
                        });
                    }
                });
            }
            return validation;
        },
        modified: function () {
            // summary:
            //      Return true | false when value has been modified.
            // returns: Boolean
            //  implement custom
            return false;
        },
        getSteps: function (/* Number */ projectId) {
            var deferred = new Deferred(), url;

            url = this._projectStepsUrl + '?projectid=' + projectId;

            xhr.get(url, {
                handleAs: 'json',
                headers: this.headers
            }).then(
                function (steps) {
                    deferred.resolve(steps);
                },
                function (error) {
                    deferred.reject(error);
                }
            );

            return deferred.promise;
        },
        create: function () {
            //the following is boilerplate example code only. to be replaced/changed for what you need.
            var createDeferred = new Deferred(),
                newRecord,
                self = this,
                validation,
                headers;

            newRecord = {
                "projectStepId": null,
                "projectId": this.projectId,
                "displayOrder": this.stepsStore.data.length + 1,
                "stepLabel": this.newStepLabel,
                "dateBegin": null,
                "dateEnd": null,
                "version": null
            };

            validation = this.validate('create', newRecord);

            if (validation.isValid) {

                if (!this._saveDialog) {
                    this._saveDialog = new DialogUnderlay({"class": "galSysLoading"});
                }

                headers = lang.clone(this.headers);
                headers['Content-Type'] = 'application/json';

                //create record.
                this._saveDialog.show();

                xhr.post(this._createUrl, {
                    handleAs: "json",
                    headers: headers,
                    data: JSON.stringify(newRecord)
                }).then(function (newRecord) {
                    self.stepsStore.add(newRecord);
                    if (self._saveDialog.open) {
                        self._saveDialog.hide();
                    }
                    createDeferred.resolve(newRecord);
                }, function (error) {
                    var msg;
                    createDeferred.reject(error);
                    if (self._saveDialog.open) {
                        self._saveDialog.hide();
                    }
                    if(error.response.data.code === 4134){
                        msg = lang.replace(self.duplicateLabelMssg, {
                            0: self.newStepLabel
                        });
                        utils.messageBox(msg, self.errorLabel, [{ label: self.okLabel }]);
                    }
                });

            } else {
                var errorMssg = '';
                if(validation.errors){
                    array.forEach(validation.errors, function (error) {
                        errorMssg +=  error.message + ' ';
                    });
                    utils.messageBox(errorMssg, self.errorLabel, [{ label: self.okLabel }]);
                }
                createDeferred.reject(validation.errors);
            }

            return createDeferred.promise;
        },
        update: function (/* Object */ dataObject) {
            var self = this,
                deferred = new Deferred(),
                url,
                data,
                headers = this.headers;

            headers['Content-Type'] = 'application/json';
            url = this._updateUrl + dataObject.projectStepId;
            data = lang.clone(self.stepsStore.get(dataObject.projectStepId));

            data[dataObject.field] = dataObject.value;

            if (!this._saveDialog) {
                this._saveDialog = new DialogUnderlay({"class": "galSysLoading"});
            }

            this._saveDialog.show();

            xhr.put(url, {
                handleAs: "json",
                headers: headers,
                data: json.stringify(data)
            }).then(
                function (updatedItem) {
                    self.stepsStore.put(updatedItem);
                    self._saveDialog.hide();
                    deferred.resolve();
                },
                function (error) {
                    self._saveDialog.hide();
                    deferred.reject(error);
                }
            );

            return deferred;
        },
        "delete": function (/* Number */ projectStepId) {
            var self = this,
                deferred = new Deferred(),
                projectConReportUrl,
                url,
                deleteStep,
                headers = this.headers;

            url = this._deleteUrl + projectStepId;
            projectConReportUrl = self._projectConReportsUrl + this.projectId;
            projectConReportUrl += '?tableid=' + this.tableIdOfParentReport;
            projectConReportUrl += '&stepid=' + projectStepId;

            deleteStep = function () {
                if (!self._saveDialog) {
                    self._saveDialog = new DialogUnderlay({"class": "galSysLoading"});
                }
                self._saveDialog.show();

                xhr.del(url, {
                    handleAs: "json",
                    headers: headers
                }).then(
                    function (orderSet) {
                        self.setOrder(orderSet);
                        self._saveDialog.hide();
                        deferred.resolve();
                    },
                    function (error) {
                        self._saveDialog.hide();
                        deferred.reject(error);
                    }
                );
            };
            //find if this step is used in other conservation reports. if so, warn user before proceding.
            xhr.get(projectConReportUrl + this.projectId, {
                handleAs: 'json',
                headers: this.headers
            }).then(
                function (reports) {
                    var numSubReports = reports.length, mssg;

                    if(numSubReports > 0){
                        mssg = lang.replace(self.deleteWarning, {
                            0: numSubReports
                        });
                        utils.messageBox(mssg, self.warningLabel, [
                            {
                                label: self.deleteLabel,
                                callback: function () {
                                    deleteStep();
                                }
                            },
                            {
                                label: self.cancelLabel,
                                callback: function (error) {
                                    deferred.reject(error);
                                }
                            }
                        ]);
                    }else{
                        deleteStep();
                    }
                },
                function (error) {
                    deferred.reject(error);
                }
            );

            return deferred;
        },
        updateOrder: function () {
            var self = this,
                headers = this.headers,
                steps,
                orderSetItems,
                url = lang.replace(this._orderUrl, {
                    projectId: this.projectId
                });

            headers['Content-Type'] = 'application/json';
            steps = self.stepsStore.query({});
            orderSetItems = steps.map(function(item, index) {
                return {
                    modificationFlag: "NOT_MODIFIED",
                    oldOrder: item.oldOrder || item.displayOrder,
                    order: item.displayOrder,
                    pkID: item.projectStepId,
                    version: item.version
                };
            });
            var orderSet = {
                modificationFlag: "NOT_MODIFIED",
                orderSetItems: orderSetItems
            };
            return xhr.put(url, {
                handleAs: "json",
                headers: headers,
                data: json.stringify(orderSet)
            });
        },
        reorderItem: function (/* Number */ projectStepId, /* string */ direction) {
            var self = this, step, swapStep, curOrder, swapOrder, lastOrder, deferred;

            if(!this._reorderInProgress){
                this._reorderInProgress = true;
                step = lang.clone(this.stepsStore.get(projectStepId));
                curOrder = step.displayOrder;

                if(direction === 'up'){
                    if(step.displayOrder > 1){
                        swapOrder = step.displayOrder - 1;
                    }else{
                        return;
                    }
                }else{
                    lastOrder = this.stepsStore.data.length;
                    if(step.displayOrder < lastOrder){
                        swapOrder = step.displayOrder + 1;
                    }else{
                        return;
                    }
                }

                swapStep = lang.clone(this.stepsStore.query({ displayOrder: swapOrder })[0]);
                //preserve originalOrder
                if(!step.oldOrder){
                    step.oldOrder = step.displayOrder;
                }
                if(!swapStep.oldOrder){
                    swapStep.oldOrder = swapStep.displayOrder;
                }
                step.displayOrder = swapOrder;
                swapStep.displayOrder = curOrder;
                this.stepsStore.put(step);
                this.stepsStore.put(swapStep);
                this._reorderInProgress = false;

                this._pendingReorderTimeoutId && clearTimeout(this._pendingReorderTimeoutId);
                this._pendingReorderTimeoutId = setTimeout(function() {
                    if (!self._saveDialog) {
                        self._saveDialog = new DialogUnderlay({ "class": "galSysLoading" });
                    }
                    self._saveDialog.show();
                    when(self.updateOrder(), function(response) {
                        self._pendingReorderTimeoutId = 0;
                        self.setOrder(response);
                        self._saveDialog.hide();
                    }, function(error) {
                        self._saveDialog.hide();
                    });
                }, 600);

            }else{
                return;
            }

        },
        setOrder: function (/* Object */ orderSet) {
            var result, orderSetItems, i, l, item, itemPrefix;

            result = (!orderSet || typeof orderSet !== "String") ? orderSet : json.parse(orderSet, true);

            if(result){
                orderSetItems = result.orderSetItems;
                if(result.modificationFlag === 'DELETED'){
                    if (orderSetItems.length && orderSetItems.length > 0) {
                        for (i = 0, l = orderSetItems.length; i < l; i++) {
                            switch (orderSetItems[i]["modificationFlag"]) {
                                case "DELETED":
                                    this.stepsStore.remove(orderSetItems[i]["pkID"]);
                                    break;
                                case "MODIFIED":
                                    item = this.stepsStore.get(orderSetItems[i]["pkID"]);
                                    if (item) {
                                        item.displayOrder = orderSetItems[i]["order"];
                                        item.version = orderSetItems[i]["version"];
                                        if(item.oldOrder){ delete item.oldOrder; }
                                        try{
                                            this.stepsStore.put(item);
                                        }catch(e){
                                            this.handleDataError(e);
                                        }
                                    }
                                    break;
                            }
                        }
                    }
                }else if(result.modificationFlag === "MODIFIED" ){
                    if (orderSetItems.length && orderSetItems.length > 0) {
                        for (i = 0, l = orderSetItems.length; i < l; i++) {
                            switch (orderSetItems[i]["modificationFlag"]) {
                                case "MODIFIED":
                                    item = this.stepsStore.get(orderSetItems[i]["pkID"]);
                                    if (item) {
                                        item.displayOrder = orderSetItems[i]["order"];
                                        item.version = orderSetItems[i]["version"];
                                        this.stepsStore.put(item);
                                    }
                                    break;
                            }
                        }
                    }
                }
            }
        },
        handleDataError: function (error) {
            var msg = error.message || this.errorLabel;
            utils.messageBox(msg, self.errorLabel, [{ label: self.okLabel }]);
        },
        reset: function () {
            // summary:
            //      resets state of model
        },
        getOldValue: function () {
            // summary:
            //      Public method to return private _oldValue.
            // tags:
            //      readonly
            return this._oldValue;
        },
        destroy: function () {
            if (this._saveDialog) {
                this._saveDialog.destroy();
            }
        }
    });

    var _Dialog = declare([ConfirmDialog], {
        resize: function () {
            this.inherited(arguments);

            var actionHeight, containerHeight, bb;

            this.inherited(arguments);
            if( domStyle.get(this.containerNode, 'position') === 'absolute' ){
                containerHeight = domStyle.get(this.containerNode, 'height');
                actionHeight = domGeometry.getMarginSize(this.actionBarNode).h;
                domStyle.set(this.actionBarNode, {
                    position:'absolute',
                    bottom:'0px'
                });
                domStyle.set(this.containerNode, 'height', (containerHeight - actionHeight) + 'px');
                this.containerNode.scrollTop = 0;
            }else{
                domStyle.set(this.actionBarNode, {
                    position:'static'
                });
            }

            //add custom resizing logic.  Dialogs are so diverse and frequently require specialized resizing for
            //internal widgets especially when they are dynamically showing/hiding.
        },
        hide: function () {
            //custom code here like resetting state or destroying.
            this.inherited(arguments);
        }
    });

    var CustomDateInput = declare([_WidgetBase], {
        style: 'width:100%',
        _dataInput: null,
        buildRendering: function () {
            this.inherited(arguments);
            this._dateInput = new DateInput({
                style: 'width:100%'
            });
            this.domNode.appendChild(this._dateInput.domNode);
        },
        postCreate: function () {
            var self = this;
            this.inherited(arguments);
            this.own(
                this._dateInput.watch('isoDate', function (prop, oldVal, newVal) {
                    self.onChange(newVal);
                })
            );
        },
        _setValueAttr: function (/* string */ value) {
            this.value = value;
            this._dateInput.set('isoDate', value);
        },
        _getValueAttr: function () {
            this.value = this._dateInput.get('isoDate');
            return this.value;
        },
        destroy: function () {
            this._dateInput.destroy();
            this.inherited(arguments);
        }
    });

    return declare([_WidgetBase, _LocalizeMixin], {
        //templateString: template,
        dialogClassName: null,
        draggable: true,
        app: null, //requires reference to main dojox app object.
        localizationProvider: null,
        securityProvider: null,
        stepsGrid: null,
        projectTitle: null,
        _fullyLoaded: null,
        _started: false,
        _toolBar: null,
        constructor: function (args) {
            var self = this;

            lang.mixin(this, args);

            this.model = new DialogModel({
                app: this.app
            });

            this._dialog = new _Dialog({
                model: this.model
            });

            this.gridColumns = [
                editor({
                    label: 'stepLabel',
                    field: 'stepLabel',
                    sortable: false,
                    editor: 'text',
                    editOn: 'click',
                    localization: { literalId: 591 }
                }),
                editor({
                    label: 'dateBegin',
                    field: 'dateBegin',
                    sortable: false,
                    editor: CustomDateInput,
                    localization: { literalId: 554 }
                }),
                editor({
                    label: 'dateEnd',
                    field: 'dateEnd',
                    sortable: false,
                    editor: CustomDateInput,
                    localization: { literalId: 555 }
                })
            ];

            this.toolBarActions = {
                add: {
                    id: "add",
                    label: "add step",
                    scope: "all",
                    enableButton: true,
                    showAsButton: true,
                    showButtonLabel: false,
                    buttonIconClass: "fa fa-plus",
                    menuIconClass: "fa fa-plus",
                    onClickHandler: function () {
                        self.model.create();
                    },
                    localization: {
                        literalId: 174
                    }
                },
                "delete": {
                    id: "delete",
                    label: "delete step",
                    scope: "all",
                    enableButton: false,
                    showAsButton: true,
                    showButtonLabel: false,
                    buttonIconClass: "fa fa-times",
                    menuIconClass: "fa fa-times",
                    onClickHandler: function () {
                        var projectStepId = Object.keys(self.stepsGrid.selection)[0];
                        self.model["delete"](parseInt(projectStepId));
                    },
                    localization: {
                        literalId: 370
                    }
                },
                moveUp: {
                    id: "moveUp",
                    label: "Move Up",
                    scope: "item",
                    enableButton: false,
                    showAsButton: true,
                    showButtonLabel: false,
                    buttonIconClass: "fa fa-arrow-up",
                    menuIconClass: "fa fa-arrow-up",
                    onClickHandler: function () {
                        self.model.reorderItem(Object.keys(self.stepsGrid.selection)[0], 'up');
                        self._updateGridState();
                    },
                    localization: {
                        literalId: 1817
                    }
                },
                moveDown: {
                    id: "moveDown",
                    label: "Move Down",
                    scope: "item",
                    enableButton: false,
                    showAsButton: true,
                    showButtonLabel: false,
                    buttonIconClass: "fa fa-arrow-down",
                    menuIconClass: "fa fa-arrow-down",
                    onClickHandler: function () {
                        self.model.reorderItem(Object.keys(self.stepsGrid.selection)[0], 'down');
                        self._updateGridState();
                    },
                    localization: {
                        literalId: 1818
                    }
                }
            };

            this.stepsGrid = new (declare([OnDemandGrid, Selection, Keyboard]))({
                selectionMode: "single",
                columns: this.gridColumns
            });

            this.localizationProvider = this.app.galSysLocalizationProvider;

            this._fullyLoaded = new Deferred();

        },
        buildRendering: function () {
            var self = this;

            this.inherited(arguments);

            this._toolBar = new GalSysToolbar({
                actions: this.toolBarActions,
                label: this.projectTitle,
                localizationProvider: this.localizationProvider
            });

            domStyle.set(this.stepsGrid.domNode, 'height', '200px');

            this.domNode.appendChild(this._toolBar.domNode);
            this.domNode.appendChild(this.stepsGrid.domNode);
        },
        postCreate: function () {
            var self = this;

            this.inherited(arguments);

            when(this.onLoadDeferred, function () {
                when(self._dialog.onLoadDeferred, function () {
                    var locManager;

                    //set basic dialog styles.
                    domClass.add(self._dialog.okButton.domNode, ['galSysMediumBtn galSysPrimaryBtnColor']);
                    domClass.add(self._dialog.cancelButton.domNode, ['galSysMediumBtn', 'galSysCancelBtn']);
                    domClass.add(self._dialog.titleBar, 'galSys-modal-header');
                    domClass.add(self._dialog.titleNode, 'galSys-headline-2');
                    domClass.add(self._dialog.closeButtonNode, 'fa fa-close');

                    if (self.localizationProvider) {

                        locManager = new LocalizationManager({localizationProvider: self.localizationProvider});

                        locManager.useLiteral(225, "Ok", self._dialog, true, "buttonOk");
                        locManager.useLiteral(2590, "Exit", self._dialog, true, "buttonCancel");
                        locManager.useLiteral(4790, "Dialog Title", self._dialog.titleNode, false);
                        locManager.useLiteral(1998, self.model.newStepLabel, self.model, true, 'newStepLabel');
                        locManager.useLiteral(225, self.model.okLabel, self.model, true, 'okLabel');
                        locManager.useLiteral(1014, self.model.errorLabel, self.model, true, 'errorLabel');
                        locManager.useLiteral(4791, self.model.duplicateLabelMssg, self.model, true, 'duplicateLabelMssg');
                        locManager.useLiteral(4801, self.model.deleteWarning, self.model, true, 'deleteWarning');
                        locManager.useLiteral(4802, self.model.warningLabel, self.model, true, 'warningLabel');
                        locManager.useLiteral(173, self.model.cancelLabel, self.model, true, 'cancelLabel');

                        self._locHandle = locManager.subscribe();

                        self.localizeDgridColumns(self.localizationProvider, self.stepsGrid);

                    }

                    //add class to dialog
                    domClass.add(self._dialog.domNode, self.dialogClassName);

                    //add main template generated domNode to dialog content area.
                    self._dialog.containerNode.appendChild(self.domNode);

                    //////////////////
                    //add data binding and event handling:
                    //Example:
                    self.own(
                        self.stepsGrid.on('dgrid-refresh-complete', function () {
                            self.stepsGrid.resize();
                            self._dialog.resize();
                        }),
                        self.stepsGrid.on('dgrid-select', function (event) {
                            self._updateGridState();
                        }),
                        self.stepsGrid.on('dgrid-deselect', function (event) {
                            self._updateGridState();
                        }),
                        self.stepsGrid.on('dgrid-datachange', function (event) {
                            var dataObj, projectStepId = event.cell.row.data.projectStepId;

                            dataObj = {
                                projectStepId: projectStepId,
                                field: event.cell.column.field,
                                value: event.value
                            };

                            self.model.update(dataObj);
                        })
                    );
                    ////////////////////

                    self._dialog.onExecute = function () {
                        self.onOkClick(self.model.stepsStore.query());
                        self._dialog.hide();
                    };

                    self._dialog.onCancel = function () {
                        self._dialog.hide();
                    };

                    self._fullyLoaded.resolve();
                });
            });
        },
        startup: function () {
            // startup may be called be external using controlle or if not will be called internally when
            //show is called.
            var self = this;

            if(this._started){
                return;
            }

            this.inherited(arguments);
            this._dialog.placeAt(win.body());
            this._dialog.startup();
            this.stepsGrid.startup();
            this._toolBar.startup();
            this._started = true;
        },
        show: function (/* Number */ projectId, /* Number */ tableIdOfParentReport) {
            var self = this, contentSize;

            when(this._fullyLoaded, function () {
                //if startup has not been called, call it.
                if(!self._started){
                    self.startup();
                }

                //load/update model if needed. since model should have been bound to widgets in template,
                //dialog content will automatically update.
                when(self._fullyLoaded, function () {
                    self.model.set('projectId', projectId);
                    self.model.set('tableIdOfParentReport', tableIdOfParentReport);
                    self.model.getSteps(projectId).then(
                        function (steps) {
                            var dynaUrl;
                            self.model.set('stepsStore', Observable(new Memory({
                                data: steps,
                                idProperty: 'projectStepId'
                            })));
                            self.stepsGrid.set('store',
                                self.model.get('stepsStore'),
                                {},
                                { sort: [{attribute:"displayOrder", descending: false}]}
                            );
                            //set projectTitle
                            dynaUrl = self.model.app.galSysServiceUrls.dynaEntity;
                            dynaUrl += 'hierarchy/126183/item/' + projectId + '?includecolumns=5691,5688';
                            xhr.get(dynaUrl, {
                                headers: self.model.headers,
                                handleAs: 'json'
                            }).then(
                                function (result) {
                                    var projectTitle;

                                    projectTitle = result.values[5691].value ?
                                                   result.values[5691].value :
                                                   result.values[5688].value;

                                    self._toolBar.set('label', projectTitle);
                                    self.model.set('projectTitle', projectTitle);
                                    self._dialog.show().then(
                                        function () {
                                            self.stepsGrid.resize();
                                        }, function () {

                                        }
                                    );
                                },
                                function (error) {
                                    self._toolBar.set('label', '');
                                    self._dialog.show();
                                }
                            );

                        },
                        function (error) {

                        }
                    );
                });
            });
        },
        _updateGridState: function () {
            var selection = this.stepsGrid.selection, id, itemId, lastOrder, item;

            this._toolBar.actions.moveUp.enableButton = false;
            this._toolBar.actions.moveDown.enableButton = false;

            for(id in selection){
                if(selection.hasOwnProperty(id)){
                    itemId = parseInt(id);
                }
            }

            if(itemId){
                lastOrder = this.stepsGrid.store.data.length;
                item = this.stepsGrid.store.get(itemId);
                this._toolBar.actions["delete"].enableButton = true;

                if(item.displayOrder < lastOrder){
                    this._toolBar.actions.moveDown.enableButton = true;
                }

                if(item.displayOrder > 1){
                    this._toolBar.actions.moveUp.enableButton = true;
                }
            }else{
                this._toolBar.actions["delete"].enableButton = false;
            }

            this._toolBar.updateButtonState();
        },
        destroy: function () {
            this._dialog.destroy();
            this._toolBar.destroy();
            this._locHandle && this._locHandle.cancel();
            this.inherited(arguments);
        }
    });
});
