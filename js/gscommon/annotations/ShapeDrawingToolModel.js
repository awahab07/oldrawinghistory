/**
 * Created with JetBrains WebStorm.
 * User: abdul.wahab
 * Date: 1/02/15
 * Time: 7:53 AM
 * To change this template use File | Settings | File Templates.
 */


define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/string",
    "dojo/Stateful",
    "dojo/request/xhr",
    "dojox/html/format",
    "dojo/Deferred",
    "dojo/dom-style",
    "dojo/store/Memory",
    "dojo/store/Observable",
    "dijit/DialogUnderlay",
    "gscommon/BasicImageViewerModel",
    "dojo/json"
], function (declare, lang, array, string, Stateful, xhr, format, Deferred, domStyle, Memory, Observable, DialogUnderlay,
             BasicImageViewerModel, json) {

    return declare([BasicImageViewerModel], {
        headers: null,
        annotationRecordNumber: null,
        annotationRecordId: null,
        toolTipInfo: null,
        color: null,
        stroke: null,
        lineStyle: null,
        lineStyleValue: null,
        lineWidth: null,
        lineWidthStore: null,
        font: null,
        textValue: null,
        textFill: null,
        textAuthStore: null,
        textSizeValue: null,
        textSizesAuthStore: null,
        layersStore: null,//layersStore will have all layers data.
        shapeTypeStore: null,
        shapeTypeId: null,
        colorAuthStore: null,
        lineStyleAuthStore: null,
        annotationData: null,
        opacity: 100,
        _annotationRecordUrl: null,
        _configureUrl: null,
        _colorAuthUrl: null,
        _lineStyleAuthUrl: null,
        _auth2Url: null,
        //_textAuthDeferred: null,
        getLayers: function(){
            return this.layersStore.data || [];
        },
        getPaperConfig: function() {
            if(this.annotationData && this.annotationData.options) {
                return JSON.parse(this.annotationData.options);
            } else {
                return null;
            }
        },
        createOrUpdateLayer: function(layerRecord) {
            if(layerRecord.id) {
                this.layersStore.put(layerRecord);
            }

            // @TODO implement new layer creation
        },
        updateSnapshot: function(snapshotData) {
            this.annotationData.image = snapshotData;
        },
        load: function (/* number */ mediaMasterId, /* number */ annotationRecordId, /* Number */ departmentId) {
            //TODO: replace mocked out data below with real data.
            var self = this;

            this.departmentId = departmentId;

            this.inherited(arguments);
            this.set('annotationRecordNumber', 'AR-1999');
            this.set('toolTipInfo', 'This is the best record ever!');
            this.annotationRecordId = annotationRecordId;

            //get data annotation record data and load layers store.
            xhr.get(this._annotationRecordUrl + this.annotationRecordId, {
                handleAs: "json",
                headers: this.headers
            }).then(
                function (annotationData) {
                    self.annotationData = annotationData;
                    self.layersStore = new Memory({
                        data: annotationData.layers,
                        idProperty: 'id'
                    });
                    self.onLayersStoreLoaded();
                },
                function (error) {
                    throw 'annotation data not found for annotation id: ' + self.annotationRecordId;
                }
            );
        },
        constructor: function (/*Object?*/ args) {
            var self = this;
            //TODO: get actual text authority values.
            this.headers = lang.clone(self.app.galSysSessionInfo.headers);
            this._auth2Url = this.app.galSysServiceUrls.authority2;
            this._annotationRecordUrl = this.app.galSysServiceUrls.annotation + '/';
            this._configureUrl = this.app.galSysServiceUrls.configuration;
            this._colorAuthUrl = this._auth2Url + 6156 + '?columnids=6086,6087,6088,6089';
            this._shapeTypeAuthUrl = this._auth2Url + 6152;
            this._lineStyleAuthUrl = this._auth2Url + 6158;
            this._saveDialog = new DialogUnderlay({"class": "galSysLoading"});
            //domStyle.set(this._saveDialog.domNode, 'z-index', 10001);

            //get color authorities
            xhr.get(this._colorAuthUrl, {
                handleAs: "json",
                headers: this.headers
            }).then(function (colors) {
                var mappedColors;

                mappedColors = array.map(colors, function (color) {
                    //color values in db are small int -127 to 127 so values over 128 wrap around. Need to convert.
                    var convertFromSmallInt = function (value) {
                        var converted, int;

                        converted = int = parseInt(value);
                        if(value < 0){
                            converted = 256 + int;
                        }
                        return converted;
                    };
                    array.forEach(color.columns, function (c) {
                        if(c.name == 'ColorLabel'){
                            color.label = c.value;
                        }else if(c.name == 'Red'){
                            color.r = convertFromSmallInt(c.value);
                        }else if(c.name == 'Green'){
                            color.g = convertFromSmallInt(c.value);
                        }else if(c.name == 'Blue'){
                            color.b = convertFromSmallInt(c.value);
                        }else if(c.name == 'Alpha'){
                            color.a = parseInt(c.value);
                        }
                    });
                    return color;
                });

                colors = [
                    {
                        id: 1,
                        label: 'Transparent',
                        r: 0,
                        g: 0,
                        b: 0,
                        a: 0
                    },
                    {
                        id: 2,
                        label: 'Red',
                        r: 255,
                        g: 0,
                        b: 0,
                        a: 1
                    },
                    {
                        id: 3,
                        label: 'Orange',
                        r: 255,
                        g: 139,
                        b: 0,
                        a: 1
                    },
                    {
                        id: 4,
                        label: 'Yellow',
                        r: 255,
                        g: 255,
                        b: 0,
                        a: 1
                    },
                    {
                        id: 5,
                        label: 'Lime',
                        r: 0,
                        g: 255,
                        b: 0,
                        a: 1
                    },
                    {
                        id: 6,
                        label: 'Dark Green',
                        r: 0,
                        g: 124,
                        b: 15,
                        a: 1
                    },
                    {
                        id: 7,
                        label: 'Aqua',
                        r: 56,
                        g: 211,
                        b: 214,
                        a: 1
                    },
                    {
                        id: 8,
                        label: 'Blue',
                        r: 0,
                        g: 120,
                        b: 239,
                        a: 1
                    },
                    {
                        id: 9,
                        label: 'Purple',
                        r: 149,
                        g: 0,
                        b: 255,
                        a: 1
                    },
                    {
                        id: 10,
                        label: 'Fuchsia',
                        r: 255,
                        g: 0,
                        b: 255,
                        a: 1
                    },
                    {
                        id: 11,
                        label: 'Pink',
                        r: 255,
                        g: 136,
                        b: 159,
                        a: 1
                    },
                    {
                        id: 12,
                        label: 'Brown',
                        r: 155,
                        g: 102,
                        b: 8,
                        a: 1
                    },
                    {
                        id: 13,
                        label: 'Black',
                        r: 0,
                        g: 0,
                        b: 0,
                        a: 1
                    },
                    {
                        id: 14,
                        label: 'White',
                        r: 255,
                        g: 255,
                        b: 255,
                        a: 1
                    }
                ];
                //sort by id.
                mappedColors.sort(function (a, b) {
                    return a.id - b.id;
                });
                //TODO: need to use actual authority values

                self.set('colorAuthStore', new Memory({ data: colors }));
                self.set('color', self.colorAuthStore.get(1));
                self.set('stroke', self.colorAuthStore.get(2));
                self.set('textFill', self.colorAuthStore.get(13));
            }, function (error) {
            });

            //get color authorities
            xhr.get(this._lineStyleAuthUrl, {
                handleAs: "json",
                headers: this.headers
            }).then(function (lineStyles) {
                //TODO: remove mocked line styles
                //lineStyles = [
                //    {
                //        id: 1,
                //        style: 'Solid',
                //        literalID: 4813
                //    },
                //    {
                //        id: 2,
                //        style: 'Dotted',
                //        literalID: 4814
                //    },
                //    {
                //        id: 3,
                //        style: 'Dashed',
                //        literalID: 4815
                //    },
                //    {
                //        id: 4,
                //        style: 'Dash Dot',
                //        literalID: 4816
                //    }
                //];
                self.set('lineStyleAuthStore', new Memory({ data: lineStyles }));
                self.set('lineStyle', self.lineStyleAuthStore.get(2));
                self.set('lineStyleValue', 2);
            }, function (error) {

            });

            //get shape type authorities
            xhr.get(this._shapeTypeAuthUrl, {
                handleAs: "json",
                headers: this.headers
            }).then(function (shapeTypes) {
                self.set('shapeTypeStore', new Memory({ data: shapeTypes }));
            }, function (error) {

            });

            this.set('textAuthStore', new Memory({
                data: [
                    {
                        id: 1,
                        value: 'Arial'
                    },
                    {
                        id: 2,
                        value: 'Arial Black'
                    },
                    {
                        id: 3,
                        value: 'Georgia'
                    },
                    {
                        id: 4,
                        value: 'Helvetica'
                    },
                    {
                        id: 5,
                        value: 'monospace'
                    },
                    {
                        id: 6,
                        value: 'Verdana'
                    },
                    {
                        id: 7,
                        value: 'sans-serif'
                    },
                    {
                        id: 8,
                        value: 'serif'
                    },
                    {
                        id: 9,
                        value: 'Times New Roman'
                    }
                ]
            }));
            this.set('font', this.textAuthStore.get(1));
            this.set('textValue', 1);

            this.set('textSizesAuthStore', new Memory({
                data: [
                    {
                        id: 1,
                        value: '9px'
                    },
                    {
                        id: 2,
                        value: '10px'
                    },
                    {
                        id: 3,
                        value: '11px'
                    },
                    {
                        id: 4,
                        value: '12px'
                    },
                    {
                        id: 5,
                        value: '20px'
                    }
                ]
            }));
            this.set('textSize', this.textSizesAuthStore.get(4));
            this.set('textSizeValue', 4);

            //line width auth
            this.set('lineWidthStore', new Memory(
                {
                    sortByLabel: false,
                    data: [
                        {
                            id: 1,
                            label: '1px',
                            value: 1
                        },
                        {
                            id: 2,
                            label: '2px',
                            value: 2
                        },
                        {
                            id: 3,
                            label: '3px',
                            value: 3
                        },
                        {
                            id: 4,
                            label: '4px',
                            value: 4
                        },
                        {
                            id: 5,
                            label: '5px',
                            value: 5
                        },
                        {
                            id: 6,
                            label: '6px',
                            value: 6
                        },
                        {
                            id: 7,
                            label: '7px',
                            value: 7
                        },
                        {
                            id: 8,
                            label: '8px',
                            value: 8
                        },
                        {
                            id: 9,
                            label: '9px',
                            value: 9
                        },
                        {
                            id: 10,
                            label: '10px',
                            value: 10
                        },
                        {
                            id: 11,
                            label: '20px',
                            value: 20
                        },
                        {
                            id: 12,
                            label: '30px',
                            value: 30
                        }
                    ]
                }
            ));
            this.set('lineWidth', this.lineWidthStore.get(2));

            this._lineStyleWatch = this.watch('lineStyleValue', function (prop, oldVal, newVal) {
                self.lineStyleValue = parseInt(newVal);
                self.lineStyle = self.lineStyleAuthStore.get(self.lineStyleValue);
            });

            this._textValueWatch = this.watch('textValue', function (prop, oldVal, newVal) {
                self.font = self.textAuthStore.get(newVal);
            });

            this._textSizeValueWatch = this.watch('textSizeValue', function (prop, oldVal, newVal) {
                self.textSize = self.textSizesAuthStore.get(newVal);
            });

        },
        save: function () {
            var self = this, deferred, data;
            deferred = new Deferred();

            if (!this._saveDialog.open) {
                this._saveDialog.show();
            }

            data = this.annotationData;

            // For webservice null errors
            data.beginDate = null; //"2014-01-01";
            data.endDate = null; //"2014-12-31";
            data.newRecordDepartmentId = self.annotationData.newRecordDepartmentId || self.departmentId;;
            data.primarySnapshotId = self.annotationData.primarySnapshotId;
            data.snapshotMediaRecordId = self.annotationData.snapshotMediaRecordId;
            data.sourceMediaRecordId = self.annotationData.sourceMediaRecordId;
            //data.image = null;

            data.layers = this.layersStore.query();

            this.headers['Content-Type'] = 'application/json';

            xhr.put(this._annotationRecordUrl + this.annotationRecordId, {
                handleAs: "json",
                headers: this.headers,
                data: json.stringify(data)
            }).then(
                function (result) {
                    self.annotationData = result;
                    self.layersStore = new Memory({
                        data: result.layers,
                        idProperty: 'id'
                    });
                    self._saveDialog.hide();
                },
                function (error) {
                    self._saveDialog.hide();
                    deferred.reject(error);
                }
            );
            return deferred.promise;
        },
        getPredefinedImageSize: function () {
            var self = this, url, deferred = new Deferred();
            url = self._configureUrl + '?label=' + 'Media.Annotation.Snapshot.ImageSize';

            xhr.get(url, {
                handleAs: "json",
                headers: this.headers
            }).then(function (result) {
                deferred.resolve(result);
            }, function (error) {
                deferred.reject(error);
            });

            return deferred.promise;
        },
        onLayersStoreLoaded: function () {

        },
        destroy: function () {
            this._saveDialog && this._saveDialog.destroy();
            this._lineStyleWatch.unwatch();
            this._textValueWatch.unwatch();
            this._textSizeValueWatch.unwatch();
            this.inherited(arguments);
        }
    });
});
