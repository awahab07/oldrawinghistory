/**
 * Created by Jason Hornbuckle
 */
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/when",
    "dojo/Stateful",
    "dojo/Deferred",
    "dojo/request/xhr",
    "dojo/_base/array",
    "dojo/store/Memory",
    "dojo/store/Observable",
    "dijit/DialogUnderlay",
    "gscommon/annotations/ShapeDrawingToolModel",
    "gscommon/flexViews/models/ImportedView"
], function(declare, lang, when, Stateful, Deferred, xhr, array, Memory, Observable, DialogUnderlay,
            ShapeDrawingToolModel, ImportedView ) {

    var AnnotationsModel =  declare(ShapeDrawingToolModel, {
        layersStore: null,
        reportsStore: null,
        mediaFlexViewData: null,
        _conservationreportinfoUrl: null,
        _ddContextByModuleUrl: null,
        _importedViewModelTwo: null,
        constructor: function (/*Object?*/ args) {
            lang.mixin(this, args);
            this._importedViewModelOne = new ImportedView({
                app: this.app,
                contextId: null,
                importContextId: null,
                importHierarchyId: null
            });
            this._importedViewModelTwo = new ImportedView({
                app: this.app,
                contextId: null,
                importContextId: null,
                importHierarchyId: null
            });
            this._conservationreportinfoUrl = this.app.galSysServiceUrls.conservationreportinfo;
            this._ddContextByModuleUrl = this.app.galSysServiceUrls.ddContextByModule;
            this.mediaFlexViewData = {};
        },
        load: function (/* number */ mediaMasterId, /* number */ annotationRecordId, /* number */ departmentId) {
            var self = this, layersData, reportUrl;

            this.departmentId = departmentId;
            this.inherited(arguments);
            //TODO: replace with real data.
            layersData = [
                {
                    id: 1,
                    name: 'Pigment',
                    annotations: [
                        {
                            id: 1,
                            title: 'Pigments Identified',
                            geometries: [
                                {

                                }
                            ]
                        }
                    ]
                },
                {
                    id: 2,
                    name: 'Post Black Light Analysis',
                    annotations: []
                }
            ];

            this.set('layersStore', Observable( new Memory({
                data: this.mapLayersData(layersData)
            })));

            reportUrl = lang.replace(this._conservationreportinfoUrl, {
                id: this.annotationRecordId
            });
            //get conservation reports associated with this annotation record.
            xhr.get(reportUrl, {
                handleAs: 'json',
                headers: this.headers
            }).then(
                function (reports) {
                    self.set('reportsStore', new Memory({
                        data: reports,
                        idProperty: 'reportId'
                    }));
                },
                function () {

                }
            );

            this.set('mediaFlexViewData', {
                mediaMasterId: mediaMasterId,
                departmentId: departmentId
            });
        },
        loadFlexView: function (/* string */ type, itemId, securityId) {
            var self = this, url, itemId = itemId, securityId = securityId, moduleId;

            if(type === 'report'){
                moduleId = 14;
            }else if(type === 'media'){
                moduleId = 9;
            }

            url = lang.replace(this._ddContextByModuleUrl, {
                moduleId: moduleId,
                itemId: itemId
            });

            url += '?isAnnotation=1';

            xhr.get(url, {
                handleAs: 'json',
                headers: this.headers
            }).then(
                function (contextInfo) {
                    if(type === 'report'){
                        self._importedViewModelOne.set('contextId', contextInfo.id);
                        self._importedViewModelOne.set('importContextId', contextInfo.id);
                        self._importedViewModelOne.set('importHierarchyId', contextInfo.hierarchyId);
                        when(self._importedViewModelOne.load(itemId, securityId, false),
                            function () {

                            },
                            function (error) {
                            }
                        );
                    }else if(type === 'media'){
                        self._importedViewModelTwo.set('contextId', contextInfo.id);
                        self._importedViewModelTwo.set('importContextId', contextInfo.id);
                        self._importedViewModelTwo.set('importHierarchyId', contextInfo.hierarchyId);
                        when(self._importedViewModelTwo.load(itemId, securityId, false),
                            function () {

                            },
                            function (error) {
                            }
                        );
                    }
                },
                function () {

                }
            );
        },
        modified: function () {
            // summary:
            //      Return true | false when value has been modified.
            // returns: Boolean
            //  implement custom
            return false;
        },
        mapLayersData: function (data) {
            var i = 0, len = data.length;
            for(i; i < len; i++){
                data[i].visible = true;
            }
            return data;
        },
        unMapLayersData: function (data) {
            var i = 0, len = data.length;
            for(i; i < len; i++){
                delete data[i].visible;
            }
            return data;
        },
        update: function () {

        },
        remove: function () {

        },
        reset: function () {
            // summary:
            //      resets state of model
        },
        destroy: function () {
            if(this._saveDialog){ this._saveDialog.destroy(); }
        }
    });

    //static variables
    AnnotationsModel.PAPERSIZE_AUTHORITIES = {
        'A4': '8.27 x 11.7 inches',
        '8 1/2 x 14': '8 1/2 x 14 inches'
    };

    return AnnotationsModel;
});
