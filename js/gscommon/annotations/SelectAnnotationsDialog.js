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
    "dojo/dom-construct",
    "dijit/ConfirmDialog",
    "dijit/Dialog",
    "dojo/dom-geometry",
    "dijit/form/Button",
    "dijit/form/RadioButton",
    "gscommon/flexViews/widgets/MediaRenditionNumber",
    "gscommon/flexViews/models/MediaRenditionModel",
    "gscommon/flexViews/controllers/MediaRenditionController",
    "require",
    "dgrid/OnDemandGrid",
    "dgrid/Keyboard",
    "dgrid/Selection",
    "dgrid/selector",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/text!gscommon/annotations/SelectAnnotations.html",
    "dijit/DialogUnderlay",
    "dojo/_base/window",
    "gscommon/LocalizationManager",
    "dojo/Stateful",
    "dojox/mvc/sync",
    "dojo/json",
    "conservation/SolrSearchStore",
    "gscommon/annotations/AnnotationsAuthorities",
    "gscommon/utilities"
], function (declare, Deferred, xhr, lang, array, domStyle, domClass, domAttr, query, when, Memory, domConstruct,
             ConfirmDialog, Dialog, domGeometry, Button, RadioButton, MediaRenditionNumber, MediaRenditionModel,
             MediaRenditionController,require, OnDemandGrid, Keyboard, Selection, selector, _WidgetBase,
             _TemplatedMixin, _WidgetsInTemplateMixin,template, DialogUnderlay, win, LocalizationManager, Stateful,
             sync, json, SolrSearchStore, AnnotationsAuthorities, utils) {

    var SelectAnnotationModel = declare(Stateful, {
        app: null,
        headers: null,
        departmentsStore: null,
        paperSizeStore: null,
        existingRecords: null,
        imgUrl: null,
        defaultDepartmentId: null,
        mediaRenditionNumber: null,
        sourceMediaRecordId: null,
        newAnnotationRenditionNumber: null,
        annotatedFiledId: null,
        departmentPreference: null,
        departmentId: null,
        preferences: null,
        paperSizeId: null,
        orientation: null,
        prefDeptNotFound: false,
        prefDeptNotFoundTitle: 'Info',
        prepDeptNotFoundMssg: 'Your preferred department is not available. Please choose different department if you create new record.',
        okLabel: 'OK',
        _saveDialog: null,
        _snapShotUrl: null,
        _departmentsUrl: null,
        _preferencesUrl: null,
        _userPrefUrl: null,
        _createUrl: null,
        _AnnotationModelJSON: {
            "id": null,
            "annotatedFileId": null,
            "newRecordDepartmentId": null,
            "primarySnapshotId": null,
            "snapshotMediaRecordId": null,
            "sourceMediaRecordId": null,
            "beginDate": null,
            "endDate": null,
            "image": null,
            "layers": [],
            "locked": false,
            "newRecordRendition": null,
            "options": null
        },
        constructor: function (/*Object?*/ args) {
            lang.mixin(this, args);
            this.headers = this.app.galSysSessionInfo.headers;
            this._snapShotUrl = this.app.galSysServiceUrls.snapShot;
            this._departmentsUrl = this.app.galSysServiceUrls.departments;
            this._departmentsUrl += '?hierarchyid=' + 1233;
            this._preferencesUrl = this.app.galSysServiceUrls.preferences;
            this._preferencesUrl += '?section=annotation&key=departmentid';
            this._userPrefUrl = this.app.galSysServiceUrls.userPreferences;
            this._catPrefUrl = this.app.galSysServiceUrls.catalogPreferences;
            this._createUrl = this.app.galSysServiceUrls.annotation;
            this.preferences = {
                id: null,
                typeId: null,
                version: null
            };
        },
        loadMediaItem: function (/* Object */ mediaItem) {
            var self = this, departmentsDeferred = new Deferred();
            this.set('imgUrl', mediaItem.largeImageUrl);
            this.set('mediaRenditionNumber', mediaItem.mediaRecordNumber);
            this.set('sourceMediaRecordId', mediaItem.mediaMasterId);
            this.set('annotatedFiledId', mediaItem.mediaFile.id);
            this.set('linkedTableId', mediaItem.linkedTableId);
            this.set('itemId', mediaItem.itemId);

            //set paperSize store
            this.set('paperSizeStore', new Memory({
                data: AnnotationsAuthorities.PAPERSIZE_AUTHORITIES
            }));

            xhr.get(this._departmentsUrl, {
                handleAs: 'json',
                headers: this.headers
            }).then(function(departments){
                //add mnemonic value mapping
                var mappedDepartments;
                mappedDepartments = array.map(departments, function (dept) {
                    var item = dept;
                    array.forEach(dept.columns, function (col) {
                        if(col.name === 'Mnemonic'){
                            item.mnemonic = col.value;
                        }
                    });
                    return item;
                });

                self.set('defaultDepartmentId', mappedDepartments[0].id);
                self.set('departmentsStore', new Memory({
                    data: mappedDepartments
                }));
                departmentsDeferred.resolve(self.departmentsStore);
            });

            //get department preferences
            xhr.get(this._preferencesUrl, {
                handleAs: 'json',
                headers: this.headers
            }).then(
                function (response) {
                    self.preferences.typeId = response.preferenceTypeID;
                    self._userPrefUrl += response.preferenceTypeID;
                    self._catPrefUrl += response.preferenceTypeID;
                    xhr.get(self._userPrefUrl, {
                        handleAs: 'json',
                        headers: self.headers
                    }).then(
                        function (response) {
                            //w/o a preference, defaultDept will be selected. if response is empty check for
                            //catalog preference also.
                            when(departmentsDeferred, function () {
                                if(response){
                                    //need to set preference here.
                                    var deptOption = self.departmentsStore.query({
                                        value: response.preferenceValue
                                    })[0];
                                    self.preferences.id = response.preferenceID;
                                    self.preferences.version = response.version;
                                    if(deptOption && deptOption.id){
                                        self.set('departmentId', deptOption.id);
                                    }else{
                                        self.set('departmentId', self.defaultDepartmentId);
                                        self.set('prefDeptNotFound', true);
                                    }

                                }else{
                                    //check for catalog preference.
                                    xhr.get(self._catPrefUrl, {
                                        handleAs: 'json',
                                        headers: self.headers
                                    }).then(
                                        function(result){
                                            if(result){
                                                var deptOption = self.departmentsStore.query({
                                                        value: response.preferenceValue }
                                                )[0];
                                                self.preferences.id = response.preferenceID;
                                                self.preferences.version = response.version;
                                                if(deptOption && deptOption.id){
                                                    self.set('departmentId', deptOption.id);
                                                }else{
                                                    self.set('departmentId', self.defaultDepartmentId);
                                                    self.set('prefDeptNotFound', true);
                                                }
                                            }else{
                                                self.set('departmentId', self.defaultDepartmentId);
                                            }
                                        },
                                        function(){}
                                    );
                                }
                            });
                        },
                        function () {

                        }
                    );
                },
                function () {

                }
            );
        },
        validate: function () {
            var validation;

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

            //newAnnotationRenditionNumber is required
            if(!this.newAnnotationRenditionNumber){
                validation.isValid = false;
                validation.errors.push({
                    type: 'newAnnotationRenditionNumber',
                    message: 'newAnnotationRenditionNumber is required'
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
        create: function () {
            //the following is boilerplate example code only. to be replaced/changed for what you need.
            var createDeferred = new Deferred(),
                data = {},
                self = this,
                validation,
                headers,
                options;

            validation = this.validate();

            if(validation.isValid){

                if(!this._saveDialog){
                    this._saveDialog = new DialogUnderlay({"class": "galSysLoading"});
                }

                headers = lang.clone(this.headers);
                //clone in case need to override somethign for custom header settings.
                //example:
                headers['Content-Type'] = 'application/json';

                options = {
                    paperSize: this.paperSizeStore.get(this.paperSizeId),
                    orientation: this.orientation
                };

                data = lang.clone(this._AnnotationModelJSON);
                data.annotatedFileId = this.annotatedFiledId;
                data.newRecordDepartmentId = this.departmentId;
                data.sourceMediaRecordId = this.sourceMediaRecordId;
                data.newRecordRendition = this.newAnnotationRenditionNumber;
                data.options = JSON.stringify(options);
                data.linkedTableId = this.linkedTableId;
                data.linkedItemId = this.itemId;

                //create record.
                this._saveDialog.show();

                xhr.post(this._createUrl, {
                    handleAs: "json",
                    headers: headers,
                    data: JSON.stringify(data)
                }).then(function (newRecord) {
                    if(self._saveDialog.open){
                        self._saveDialog.hide();
                    }
                    createDeferred.resolve(newRecord);
                }, function (error) {
                    createDeferred.reject(error);
                    if(self._saveDialog.open){
                        self._saveDialog.hide();
                    }
                });

            }else{
                createDeferred.reject(validation.errors);
            }

            return createDeferred.promise;
        },
        update: function () {

        },
        remove: function () {

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
        getSnapshot: function (/* Number */ sourceMediaMasterId, /* Number */ fileId) {
            //summary:
            //  sourceMediaMasterId provided only, if image is primary file of display rendition
            //  fileId provided if image is NOT primary file of display rendition.
            var self, deferred, url;

            self = this;
            deferred = new Deferred();
            //url = this._snapShotUrl + '?mediamasterid=' + sourceMediaMasterId;
            url = this._snapShotUrl + '?sourcemediamasterid=' + sourceMediaMasterId;
            if(fileId){
                //file is not primary file so fileId is provided.
            }


            xhr.get(url, {
                handleAs: "json",
                headers: self.headers
            }).then(
                function(results){
                    var solrQuery, ids, mappedResults = [];

                    if(results && results.length) {
                        self.set('existingRecords', results.length);

                        ids = [];

                        array.forEach(results, function (item) {
                            ids.push(item.snapshotMediaRecordId);
                        });

                        //get media records and map results to provide additional data for columns.
                        self.solrSearchStore = self.solrSearchStore || new SolrSearchStore({
                            target: self.app["galSysServiceUrls"]["search"],
                            idProperty: "id$"
                        });

                        solrQuery = {
                            "queryCriteria": {
                                "all": true,
                                "hierarchyId": 1233,
                                "criterionList": [{
                                    "field": "id$",
                                    "operator": "in",
                                    "values": ids
                                }]
                            },
                            "sortFields": [],
                            "filterFields": [],
                            "resultFields": ['1233__2964', '1411__2861'],
                            "start": 0,
                            "count": 25,
                            "searchQueryId": 1,
                            "subQuery": null,
                            "viewType": "AsItem"
                        };

                        self.solrSearchStore.query(solrQuery, {
                            headers: self.headers,
                            start: 0,
                            count: 0
                        }).then(function (searchResults) {

                            array.forEach(searchResults, function (item) {

                                array.forEach(results, function (result) {
                                    if((result.snapshotMediaRecordId) === parseInt(item.id$)){
                                        result.imageUrl = item.imageUrl;
                                        result.renditionNumber = item['1411__2970'];
                                        result.mediaView = item['1233__2964'];
                                        result.renditionData = item['1411__2861'];
                                    }
                                });
                            });
                            deferred.resolve(results);
                        }, function (error) {
                            deferred.reject(error);
                        });
                    }else{
                        self.set('existingRecords', 0);
                        deferred.resolve(results);
                    }

                },
                function () {
                    deferred.reject();
                }
            );

            return deferred.promise;
        },
        setUserPrefDepartmentId: function () {
            var data, deptObj, method, self = this;

            deptObj = this.departmentsStore.get(this.departmentId);

            data = {
                "preferenceValue": deptObj.value,
                "userID": this.app.galSysSessionInfo.user.id,
                "preferenceID": this.preferences.id,
                "preferenceTypeID": this.preferences.typeId,
                "version": this.preferences.version
            };

            method = data.preferenceID ? 'put' : 'post';

            xhr[method](this._userPrefUrl, {
                handleAs: "json",
                headers: this.headers,
                data: JSON.stringify(data)
            }).then(
                function(response){
                    self.preferences.id = response.preferenceID;
                    self.preferences.version = response.version;
                },
                function(error){

                }
            );
        },
        showNoDeptPrefFoundMssg: function () {
            this.prefDeptNotFound = false;
            utils.messageBox(
                this.prepDeptNotFoundMssg,
                this.prefDeptNotFoundTitle,
                [
                    {
                        label: this.okLabel,
                        callback: function () {}
                    }
                ]
            );
        },
        destroy: function () {
            if(this._saveDialog){ this._saveDialog.destroy(); }
        }
    });

    var SelectAnnotationsDialog = declare([ConfirmDialog], {
        style: 'width:625px;',
        autofocus: false,
        resize: function () {
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
        },
        hide: function () {
            this.model.reset();
            this.inherited(arguments);
        }
    });

    var ExistingGrid = new declare([OnDemandGrid, Keyboard, Selection]);

    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        templateString: template,
        deptSelect: null,
        paperSelect: null,
        createNewRadio: null,
        openExistingRadio: null,
        landscapeRadio: null,
        portraitRadio: null,
        preferencesBtn: null,
        existingGrid: null,
        gridColumns: null,
        selectAnnotationModel: null,
        mediaRecordThumbNode: null,
        mediaRenditionNumber: null,
        mediaRenditionModel: null,
        mediaRenditionController: null,
        preferencesBtn: null,
        preload:true,
        draggable: true,
        parseOnLoad: true,
        localizationProvider: null,
        securityProvider: null,
        existingRecordsMsgNode: null,
        mediaRenditionNumberNode: null,
        paperSelectLabelNode: null,
        openExistingLabelNode: null,
        createNewLabelNode: null,
        orientationLabelNode: null,
        annotationRecordsCreatedMsg: 'This Media Record has been used to create {0} existing annotation records',
        existingRecords: null,
        openExistingLabel: 'Open Existing Annotation Record ({0})',
        createNewLabel: 'Create New Annotation Record',
        //annotationsNumberLabel: ''
        deptSelectLabelNode: null,
        _fullyLoaded: null,
        constructor: function(args) {
            var self = this, nextDisplay;
            lang.mixin(this, args);

            this.selectAnnotationModel = new SelectAnnotationModel({
                app: this.app
            });

            this._dialog = new SelectAnnotationsDialog({
                model: this.selectAnnotationModel
            });

            this._fullyLoaded = new Deferred();

            this.gridColumns = [
                {
                    label: 'imageUrl',
                    field: 'imageUrl',
                    renderCell: function(item, value, node, options){
                        var img = new Image();
                        img.src = item.imageUrl;
                        return img;
                    }
                },
                {
                    label: 'renditionNumber',
                    field: 'renditionNumber'
                },
                {
                    label: 'mediaView',
                    field: 'mediaView'
                },
                {
                    label: 'renditionDate',
                    field: 'renditionDate'
                }
            ];
        },
        buildRendering: function (){
            var self = this;
            self.inherited(arguments);
            this.existingGrid = new ExistingGrid({
                showHeader: false,
                "class": 'existingGrid'
            });
            this.mediaRenditionModel = new MediaRenditionModel({ app: this.app });
            this.mediaRenditionController = new MediaRenditionController(
                this.mediaRenditionModel,
                this.mediaRenditionNumber,
                self.localizationProvider
            );
            this.deptSelect.set('disabled', true);
            this.paperSelect.set('disabled', true);
            this.preferencesBtn.set('disabled', true);
            this.mediaRenditionNumber.set('disabled', true);
            //this.landscapeRadio.set('checked', true);
            this.landscapeRadio.set('disabled', true);
            this.portraitRadio.set('disabled', true);
            this.existingGridCont.appendChild(this.existingGrid.domNode);

            //set label for's
            domAttr.set(this.landscapeRadioLabel, 'for', this.landscapeRadio.id);
            domAttr.set(this.portraitRadioLabel, 'for', this.portraitRadio.id);
        },
        postCreate: function () {
            var self = this;
            self.inherited(arguments);
            when(this.onLoadDeferred, function () {
                when(self._dialog.onLoadDeferred, function(){
                    var locManager;

                    domClass.add(self._dialog.okButton.domNode, ['galSysMediumBtn galSysPrimaryBtnColor']);
                    domClass.add(self._dialog.cancelButton.domNode, ['galSysMediumBtn', 'galSysCancelBtn']);
                    domClass.add(self._dialog.titleBar, 'galSys-modal-header');
                    domClass.add(self._dialog.titleNode, 'galSys-headline-2');
                    domClass.add(self._dialog.closeButtonNode, 'fa fa-close');

                    if (self.localizationProvider) {

                        locManager = new LocalizationManager({localizationProvider: self.localizationProvider});

                        locManager.useLiteral(4410, "Start", self._dialog, true, "buttonOk");
                        locManager.useLiteral(2590, "Exit", self._dialog, true, "buttonCancel");
                        locManager.useLiteral(1106, "Select Record To Edit", self._dialog.titleNode, false);
                        locManager.useLiteral(
                            4768,
                            self.annotationRecordsCreatedMsg,
                            self,
                            true,
                            "annotationRecordsCreatedMsg"
                        );
                        locManager.useLiteral(4769, self.createNewLabel, self, true, 'createNewLabel');
                        locManager.useLiteral(4770, self.openExistingLabel, self, true, 'openExistingLabel');
                        locManager.useLiteral(525, 'Department', self.deptSelectLabelNode, false);
                        locManager.useLiteral(4771, 'Paper Size', self.paperSelectLabelNode, false);
                        locManager.useLiteral(4772, 'Orientation', self.orientationLabelNode, false);
                        locManager.useLiteral(4773, 'Landscape', self.landscapeRadioLabel, false);
                        locManager.useLiteral(4774, 'Portrait', self.portraitRadioLabel, false);
                        locManager.useLiteral(
                            4787,
                            self.selectAnnotationModel.prefDeptNotFoundTitle,
                            self.selectAnnotationModel,
                            true,
                            'prefDeptNotFoundTitle'
                        );
                        locManager.useLiteral(
                            4788,
                            self.selectAnnotationModel.prepDeptNotFoundMssg,
                            self.selectAnnotationModel,
                            true,
                            'prepDeptNotFoundMssg'
                        );
                        locManager.useLiteral(
                            225,
                            self.selectAnnotationModel.okLabel,
                            self.selectAnnotationModel,
                            true,
                            'okLabel'
                        );
                        self._locHandle = locManager.subscribe();
                    }
                    domClass.add(self._dialog.domNode, "galSysSelectAnnotationsDialog");
                    self._dialog.containerNode.appendChild(self.domNode);

                    //deptSelect setup
                    self.deptSelect.set('labelAttr', 'value');
                    self.deptSelect.set('value', 1);
                    //paperSelect setup
                    self.paperSelect.set('labelAttr', 'label');
                    self.paperSelect.set('value', 1);
                    //preference button
                    self.preferencesBtn.set('label', 'P');

                    self.own(
                        self.existingGrid.on('dgrid-refresh-complete', function () {
                            self.existingGrid.resize();
                            self._dialog.resize();
                        }),
                        self.selectAnnotationModel.watch('imgUrl', function (prop, oldVal, newVal){
                            self.mediaRecordThumbNode.src = newVal;
                        }),
                        self.selectAnnotationModel.watch('departmentsStore',
                            function (prop, oldVal, newVal) {
                                self.deptSelect.set('store', newVal);
                                self.deptSelect.set('value', 1);
                            }
                        ),
                        self.paperSelect.watch('value', function (prop, oldVal, newVal) {
                            self.selectAnnotationModel.set('paperSizeId', newVal);
                        }),
                        self.selectAnnotationModel.watch('paperSizeStore',
                            function (prop, oldVal, newVal) {
                                self.paperSelect.set('store', newVal);
                                self.paperSelect.set('value', 1);
                            }
                        ),
                        self.selectAnnotationModel.watch('mediaRenditionNumber',
                            function (prop, oldVal, newVal) {
                                self.mediaRenditionNumberNode.innerHTML = newVal;
                            }
                        ),
                        self.createNewRadio.watch('checked',
                            function (prop, oldVal, newVal) {
                                if(newVal){
                                    self.deptSelect.set('disabled', false);
                                    self.paperSelect.set('disabled', false);
                                    self.preferencesBtn.set('disabled', false);
                                    self.mediaRenditionNumber.set('disabled', false);
                                    self.existingGrid.set('selectionMode', 'none');
                                    self.landscapeRadio.set('disabled', false);
                                    self.portraitRadio.set('disabled', false);
                                }else{
                                    self.deptSelect.set('disabled', true);
                                    self.paperSelect.set('disabled', true);
                                    self.preferencesBtn.set('disabled', true);
                                    self.mediaRenditionNumber.set('disabled', true);
                                    self.existingGrid.set('selectionMode', 'single');
                                    self.landscapeRadio.set('disabled', true);
                                    self.portraitRadio.set('disabled', true);
                                }
                            }
                        ),
                        self.landscapeRadio.watch('checked', function (prop, oldVal, newVal) {
                            if(newVal){
                                self.selectAnnotationModel.set('orientation', 'landscape');
                            }
                        }),
                        self.portraitRadio.watch('checked', function (prop, oldVal, newVal) {
                            if(newVal){
                                self.selectAnnotationModel.set('orientation', 'portrait');
                            }
                        }),
                        self.portraitRadio.watch('checked', function (prop, oldVal, newVal) {

                        }),
                        sync(self.selectAnnotationModel, 'departmentId', self.deptSelect, 'value'),
                        self.mediaRenditionModel.watch('value', function (prop, oldVal, newVal) {
                            self.selectAnnotationModel.set('newAnnotationRenditionNumber', newVal);
                        })
                    );

                    self._dialog.onExecute = function () {
                        var itemId, record;

                        self.mediaRenditionNumber.clearErrors();

                        if(self.createNewRadio.get('checked')){
                            self.selectAnnotationModel.create().then(
                                function (newRecord) {
                                    self.onStart(newRecord.sourceMediaRecordId, newRecord.id);
                                    self._dialog.hide();
                                },
                                function (errors) {
                                    array.forEach(errors, function (error) {
                                        if(error.type === 'newAnnotationRenditionNumber'){
                                            self.mediaRenditionNumber.setErrors();
                                        }
                                    });
                                }
                            );

                        }else{
                            itemId = Object.keys(self.existingGrid.get('selection'))[0];
                            record = self.existingGrid.store.get(itemId);
                            self.onStart(record.sourceMediaRecordId, record.annotationId);
                            self._dialog.hide();
                        }
                    };

                    self.preferencesBtn.onClick = function () {
                        self.selectAnnotationModel.setUserPrefDepartmentId();
                    };

                    self.landscapeRadio.set('checked', true);

                    self._fullyLoaded.resolve();
                });
            });
        },
        startup: function () {
            var self = this;
            self.inherited(arguments);
            this._dialog.placeAt(win.body());
            this._dialog.startup();
        },
        show: function (/* Object */ mediaItem) {
            var self = this, documentSize, contentSize;

            /////////////
            //TODO: get data set correctly when services and structure exists
            ////////////
            when(this._fullyLoaded, function () {
                self.selectAnnotationModel.loadMediaItem(mediaItem);
                self.selectAnnotationModel.getSnapshot(mediaItem.mediaMasterId).then(
                    function (results) {
                        if(results && results.length > 0){
                            self.openExistingRadio.set('checked', true);
                            self.existingGrid.set('columns', self.gridColumns);
                            self.existingGrid.set('store', new Memory({
                                data: results,
                                idProperty: 'snapshotMediaRecordId'
                            }), {});
                            domStyle.set(self.openExistingCont, {
                                height:'auto'
                            });
                        }else{
                            //no records returned.
                            self.createNewRadio.set('checked', true);
                            domStyle.set(self.openExistingCont, {
                                height:'0px',
                                overflow:'hidden'
                            });
                        }
                        self.set('openExistingLabel', self._origOpenExistingLabel);
                        self.set('annotationRecordsCreatedMsg', self._origAnnotationRecordsCreatedMsg);
                        when(self._fullyLoaded, function () {
                            self._dialog.show();
                            if(self.selectAnnotationModel.prefDeptNotFound){
                                self.selectAnnotationModel.showNoDeptPrefFoundMssg();
                            }
                        });

                    },
                    function () {

                    }
                );
            });
        },
        _setAnnotationRecordsCreatedMsgAttr: function (/* string */ value) {
            this._origAnnotationRecordsCreatedMsg = value;
            this.annotationRecordsCreatedMsg = lang.replace(value, {
                0: this.selectAnnotationModel.existingRecords
            });
            this.existingRecordsMsgNode.innerHTML = this.annotationRecordsCreatedMsg;
        },
        _setCreateNewLabelAttr: function (/* string */ value) {
            this.createNewLabel = value;
            this.createNewLabelNode.innerHTML = this.createNewLabel;
        },
        _setOpenExistingLabelAttr: function (/* string */ value) {
            this._origOpenExistingLabel = value;
            this.openExistingLabel = lang.replace(value, {
                0: this.selectAnnotationModel.existingRecords
            });
            this.openExistingLabelNode.innerHTML = this.openExistingLabel;
        },
        onStart: function (/* Number */mediaMasterId, /* Number */ annotationId) {

        },
        destroy: function () {
            this._dialog.destroy();
            this._locHandle && this._locHandle.cancel();
            //this._gridRefreshHandle && this._gridRefreshHandle.remove();
            this.inherited(arguments);
        }
    });
});
