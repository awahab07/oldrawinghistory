define([
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/dom-construct",
    "dojo/store/Memory",
    "gscommon/annotations/olCustom/OLGeom",
    "gscommon/annotations/olCustom/OLTextEditor",
    "gscommon/annotations/olCustom/OLGeomTextRectangle",
    "gscommon/annotations/olCustom/OLShape",
    "gscommon/annotations/olCustom/OLDrawInteraction",
    "gscommon/annotations/olCustom/OLManipulateInteraction"
], function (lang, array, domConstruct, Memory, OLGeom, OLTextEditor, OLGeomTextRectangle, OLShape, OLDrawInteraction, OLManipulateInteraction) {

    return {
        _activeOLLayer: null, // reference to currently selected OL Layer in grid or to layer facing the drawing events
        _drawingOLLayers: [], // array of references to drawing layers added to map
        _storeLayers: [], // array of store layers

        _olDrawInteraction: null, // Will be assigned when added to map
        _olManipulateInteraction: null, // Will be assigned when added to map

        _dataProvider: null, // model in most of the times providing layersStore and Annotation Information
        _stylesWidget: null, // styles toolbar, to query or update user opted styles

        _activatedShapeForDrawing: "", // string, will determine what shape is currently active for ol.interaction.DrawWithShapes

        _undoStep: 0, // The state/value of undo step
        _commandHistoryStore: null, // Memory store to track drawing history

        /***** Data *****/
        setDataProvider: function(dataProvider) {
            var self = this;
            self._dataProvider = dataProvider;
        },
        saveLayers: function() {
            var self = this;
            if(self._drawingOLLayers && self._drawingOLLayers.length) {
                var jsonLayers = self.getJSONForDrawingLayers();

                goog.array.forEach(jsonLayers, function(jsonLayer){
                    if(self._dataProvider) {
                        self._dataProvider.createOrUpdateLayer(jsonLayer);
                    }
                }, self);
            }
        },
        loadLayers: function() {
            var self = this;

            if(self._dataProvider && self._dataProvider.getLayers) {
                self._drawingOLLayers = [];

                var layersArray = self._dataProvider.getLayers();

                // mock data
                // layersArray = JSON.parse('[{"shapes":[{"id": null, "shapeText": "Rectangle", "shapePositionInfo":"{\\\"shapeType\\\":\\\"Rectangle\\\",\\\"coordinates\\\":[[[285.0844663343462,900.561645744009],[447.49805513813135,900.561645744009],[447.49805513813135,420.15291008443285],[285.0844663343462,420.15291008443285],[285.0844663343462,900.561645744009]]],\\\"style\\\":{\\\"fill\\\":{\\\"color\\\":\\\"#349823\\\"},\\\"stroke\\\":{\\\"color\\\":\\\"transparent\\\",\\\"width\\\":\\\"4\\\"},\\\"text\\\":{\\\"fill\\\":\\\"#989861\\\"}},\\\"rotationDegrees\\\":0,\\\"rotationCenter\\\":[0,0]}"},{"id": null, "shapePositionInfo":"{\\\"shapeType\\\":\\\"Ellipse\\\",\\\"coordinates\\\":[[244.48106913339996,271.82621418709846],[321.54465973927756,272.30451438614307],[244.48106913339996,347.2325232745701]],\\\"style\\\":{\\\"fill\\\":{\\\"color\\\":\\\"#bbc92b\\\"},\\\"stroke\\\":{\\\"color\\\":\\\"#f50a0a\\\",\\\"width\\\":\\\"4\\\"},\\\"text\\\":{\\\"fill\\\":\\\"#989861\\\"}},\\\"rotationDegrees\\\":0,\\\"rotationCenter\\\":[0,0]}"}],"beginDate":"2014-01-01","endDate":"2014-12-31","id":1,"options":"options 001","title":"Layer 1"}]');

                if(layersArray.length) {
                    self._storeLayers = layersArray;
                    self.addLayersFromJSON(layersArray);
                } else {
                    // @TODO Add default layer
                }
            }

            // Setting active layer
            self._activeOLLayer = self._drawingOLLayers[self._drawingOLLayers.length - 1];
        },

        /***** Drawing *****/
        addColorProvider: function(provider) { // For testing/demo
            var self = this;

            if(self._olDrawInteraction) {
                self._olDrawInteraction.addColorProvider(provider);
            }

            self._stylesWidget = provider;
        },
        getActivatedShapeTypeForDrawing: function() {
            return this._activatedShapeForDrawing;
        },
        deactivateDrawing: function() {
            var self = this;
            if(self._olDrawInteraction) {
                self._olDrawInteraction.deactivateDrawing();
            }
        },
        drawingDeactivated: function(/*string*/shapeType) {
            this._activatedShapeForDrawing = "";
        },
        activateShapeDrawingOnLayer: function(shapeType, layer) {
            var self = this;

            if(self._olManipulateInteraction) {
                self._olManipulateInteraction.clear();
            }

            self.disableSelection();

            this._activatedShapeForDrawing = shapeType;

            if(self._olDrawInteraction && layer) {
                self._olDrawInteraction.activateShapeDrawingOnLayer(shapeType, layer);
            }
        },

        /***** JSON *****/
        getJSONForDrawingLayers: function() {
            var self = this,
                layers = [];

            goog.array.forEach(self._drawingOLLayers, function(olLayer){
                var features = olLayer.getSource().getFeatures(),
                    layer = null,
                    shapes = [];

                features.forEach(function(shapeFeature){
                    // Adding default except for shapePositionInfo, will be overwitten if previously preserved
                    var featureJSONObj = {
                        id: null,
                        colorId: 1,
                        linestyleId: 1,
                        fillLineAngle: 1,
                        fillColorId: 1,
                        shapeFormatId: 1,
                        shapeTypeId: 1,
                        textEntryId: 1,
                        opacity: 50,
                        shapePositionInfo: shapeFeature.toJSONString(),
                        shapeText: shapeFeature.get('text') || ''
                    };

                    var dbPropertiesObj = shapeFeature.get('_dbProperties');
                    if(dbPropertiesObj) {
                        for (var key in dbPropertiesObj) {
                            featureJSONObj[key] = dbPropertiesObj[key];
                        }
                    }

                    shapes.push(featureJSONObj);
                }, self);

                layer = {
                    shapes: shapes
                };
                var dbPropertiesObj = olLayer.get('_dbProperties');
                if(dbPropertiesObj) {
                    // Adding DB properties
                    for (var key in dbPropertiesObj) {
                        layer[key] = dbPropertiesObj[key];
                    }

                    // Overwriting options
                    layer.options = JSON.stringify(dbPropertiesObj.options);
                }

                layers.push(layer);
            }, self);

            return layers;
        },
        addLayersFromJSON: function(/*Array<object>*/JSONLayersArray) {
            var self = this,
                i;
            for(i=0; i<JSONLayersArray.length; i++) {
                var layerObj = JSONLayersArray[i],
                    layer = self.createLayerFromJSONObject(layerObj),
                    j;

                self.addDrawingLayer(layer);
                self.preserveDBPropertiesForLayer(layer, layerObj);

                for(j=0; j<JSONLayersArray[i].shapes.length; j++){
                    layer.getSource().addFeature(self.createShapeFeatureFromJSONObject(JSONLayersArray[i].shapes[j]));
                }
            }
        },
        createLayerFromJSONObject: function(layerObj) {
            var self = this;

            var layer = new ol.layer.Vector({source: new ol.source.Vector()});
            self.preserveDBPropertiesForLayer(layer, layerObj);
            return layer;
        },
        createShapeFeatureFromJSONObject: function(shapeFeatureObj) {
            var shapeFeature = ol.shape.ShapeFeature.prototype.createFromJSONString(shapeFeatureObj.shapePositionInfo),
                dbExcludeProperties  = ['shapePositionInfo'],
                preservedDbProperties = {};

            for(var key in shapeFeatureObj) {
                if(dbExcludeProperties.indexOf(key) == -1) {
                    preservedDbProperties[key] = shapeFeatureObj[key];
                }
            }
            shapeFeature.set('_dbProperties', preservedDbProperties);
            shapeFeature.set('text', shapeFeatureObj.shapeText || '');

            return shapeFeature;
        },
        preserveDBPropertiesForLayer: function(olLayer, jsonLayerObj) {
            var dbExcludeProperties  = ['shapes'],
                preservedDbProperties = {};

            for(var key in jsonLayerObj) {
                if(dbExcludeProperties.indexOf(key) == -1) {
                    preservedDbProperties[key] = jsonLayerObj[key];
                }
            }

            // Extracting options
            preservedDbProperties.options = JSON.parse(preservedDbProperties.options);

            olLayer.set('_dbProperties', preservedDbProperties);
        },
        getRGBAString: function(colorStringOrObj) {
            if(typeof colorStringOrObj == "object") {
                return 'rgba('+colorStringOrObj.r+','+colorStringOrObj.g+','+colorStringOrObj.b+','+colorStringOrObj.a+')';
            } else {
                return colorStringOrObj.toString();
            }
        },

            /***** History Undo/Redo *****/
        initializeCommandHistory: function() {
            var self = this;

            if(!self._commandHistoryStore) {
                self._undoStep = 0;
                self._commandHistoryStore = new Memory();

                self._commandHistoryStore.removeInvalidCommandRecords = function() {
                    var removeIfInvalid = function(item) {
                        if(item.id > self._undoStep) {
                            self._commandHistoryStore.remove(item.id);
                        }
                    };
                    self._commandHistoryStore.query({}).forEach(removeIfInvalid);
                }
            }
        },

        getSourceForCommand: function(command) {
            var self = this;
            return self._activeOLLayer.getSource();
        },

        insertHistoryCommand: function(command, fid, feature, from, to) {
            var self = this;

            self._commandHistoryStore.removeInvalidCommandRecords();
            self._commandHistoryStore.add({id: ++this._undoStep, fid:fid, command:command, feature:feature, from:from, to:to});
        },

        trackStateBeforeOperation: function(feature) {
            var self = this;

            // Retrieving a from reference
            var fromRef = null;
            var queryResults = self._commandHistoryStore.query(function(item){
                return item.id <= self._undoStep && item.fid == feature.getFid() && item.to != null;
            }, {
                count: 1,
                sort: [{attribute: "id", descending: true}]
            });

            if(queryResults.length)
                fromRef = queryResults[0].to;

            // If "from" is not retrieved, it will indicate that the feature is retrieved form the source
            // So insert a MODIFY command with "from" holding the current state of feature whereas "to" with
            // the string "PENDING" informing the following modified event to fill in
            if(!fromRef) {
                fromRef = feature.getJSONObj()
            }

            return fromRef;
        },

        retrieveTrackedStateRecord: function(command, feature) {
            var self = this;

            // Retrieving a latest record with same fid and to="PENDING"
            var toRecord = null;
            var queryResults = self._commandHistoryStore.query(function(item){
                return item.fid == feature.getId() && item.to === "PENDING" && item.command == command;
            }, {
                count: 1,
                sort: [{attribute: "id", descending: true}]
            });

            if(queryResults.length) {
                toRecord = queryResults[0];
            }

            return toRecord;
        },

        unCreateFeature: function(commandRecord) {
            var self = this;

            self.getSourceForCommand(commandRecord).removeFeature(commandRecord.feature);
        },

        reCreateFeature: function(commandRecord) {
            var self = this;

            self.getSourceForCommand(commandRecord).addFeature(commandRecord.feature);
        },

        unModifyFeature: function(commandRecord) {
            commandRecord.feature.updateFromJSONObj(commandRecord.from);
        },

        reModifyFeature: function(commandRecord) {
            commandRecord.feature.updateFromJSONObj(commandRecord.to);
        },

        unDeleteFeature: function(commandRecord) {
            var self = this;

            /*var feature = new ol.Feature({
                fid: commandRecord.fid,
                geometry: commandRecord.from.geometry,
                style: commandRecord.from.style,
                properties: commandRecord.from.properties
            });
            commandRecord.feature = feature;*/
            self.getSourceForCommand(commandRecord).addFeature(commandRecord.feature);
        },

        reDeleteFeature: function(commandRecord) {
            var self = this;

            self.getSourceForCommand(commandRecord).removeFeature(commandRecord.feature);
        },

        undo: function() {
            var self = this;

            if(self._undoStep) {
                var commandRecord = self._commandHistoryStore.get(this._undoStep);
                switch(commandRecord.command) {
                    case "CREATE":
                        this.unCreateFeature(commandRecord);
                        break;
                    case "MODIFY":
                        this.unModifyFeature(commandRecord);
                        break;
                    case "DELETE":
                        this.unDeleteFeature(commandRecord);
                        break;
                }
                this._undoStep--;

                if(self._olManipulateInteraction) {
                    self._olManipulateInteraction.clear();
                }
            }
        },

        redo: function() {
            var self = this;

            if(self._undoStep < self._commandHistoryStore.data.length) {
                self._undoStep++;
                var commandRecord = self._commandHistoryStore.get(this._undoStep);
                switch(commandRecord.command) {
                    case "CREATE":
                        this.reCreateFeature(commandRecord);
                        break;
                    case "MODIFY":
                        this.reModifyFeature(commandRecord);
                        break;
                    case "DELETE":
                        this.reDeleteFeature(commandRecord);
                        break;
                }

                if(self._olManipulateInteraction) {
                    self._olManipulateInteraction.clear();
                }
            }
        },

        /**
         * Called by interactions passing the feature that has been created
         * @param feature ol.Feature that is created
         */
        featureCreated: function(feature) {
            this.initializeCommandHistory();
            this.insertHistoryCommand("CREATE", feature.getFid(), feature, null, feature.getJSONObj());
        },

        /**
         * Called by interactions passing the feature that is going to be deleted
         * @param feature ol.Feature that is modified
         */
        beforeFeatureDeleted: function(feature) {
            this.initializeCommandHistory();
            var fromRef = this.trackStateBeforeOperation(feature);
            this.insertHistoryCommand("DELETE", feature.getFid(), feature, fromRef, "PENDING");
        },

        /**
         * Called by interactions passing the feature that is going to be modified
         * @param feature ol.Feature that is modified
         */
        beforeFeatureModified: function(feature) {
            this.initializeCommandHistory();
            var fromRef = this.trackStateBeforeOperation(feature);

            this.insertHistoryCommand("MODIFY", feature.getFid(), feature, fromRef, "PENDING");
        },

        /**
         * Called by interactions/api passing the feature that has been deleted
         * @param feature ol.Feature that is modified
         */
        featureDeleted: function(feature) {
            this.initializeCommandHistory();
            var trackedRecord = this.retrieveTrackedStateRecord("DELETE", feature);
            if(trackedRecord) {
                trackedRecord.to = null; // Feature has been deleted
                this._commandHistoryStore.put(trackedRecord, {overwrite: true});
            } else {
                console.error("Record of fid: " + feature.getId() + " couldn't be found in stack with \"PENDING\" status.");
            }
        },

        /**
         * Called by interaction handlers passing the feature that has been modified
         * @param feature ol.Feature that is modified
         */
        featureModified: function(feature) {
            this.initializeCommandHistory();
            var trackedRecord = this.retrieveTrackedStateRecord("MODIFY", feature);
            if(trackedRecord) {
                trackedRecord.to = feature.getJSONObj();
                this._commandHistoryStore.put(trackedRecord, {overwrite: true});
            } else {
                console.error("Record of fid: " + feature.getId() + " couldn't be found in stack with \"PENDING\" status.");
            }
        },

        /***** Layers *****/
        addDrawingLayer: function(layer) {
            var self = this;

            if(goog.isDefAndNotNull(layer)) {
                self._drawingOLLayers.push(layer);
                self._map.addLayer(layer);
            }

            return layer;
        },
        addNewDrawingLayer: function() {
            var self = this;

            var newLayer = new ol.layer.Vector({source: new ol.source.Vector()});
            self.addDrawingLayer(newLayer);
            self._activeOLLayer = newLayer;

            return newLayer;
        },
        getActiveDrawingLayer: function(){
            return this._activeOLLayer;
        },
        getMarkerCountForLayer: function(layer) {
            var properties = layer.get('_dbProperties');

            if(!properties.options) {
                properties.options = {};
            }

            if(!properties.options.markerCount) {
                properties.options.markerCount = 1;
            }

            layer.set('_dbProperties', properties);

            return properties.options.markerCount;
        },
        incrementMarkerCountForLayer: function(layer) {
            var layerMarkerCount = this.getMarkerCountForLayer(layer);
            var properties = layer.get('_dbProperties');
            properties.options.markerCount = properties.options.markerCount + 1;
            layer.set('_dbProperties', properties);
            return properties.options.markerCount;
        },
        shiftLayerToIndex: function(layer, index) {
            var self = this,
                index = parseInt(index, 10);

            if(!isNaN(index) && self._map) {
                var layers = self._map.getLayers();

                if(layer && layers && layers.getLength()) {
                    var removedLayer = layers.remove(layer);

                    if(removedLayer) {
                        layers.insertAt(index, removedLayer);
                    }
                }
            }
        },

        /***** Tools *****/
        deleteSelectedFeatures: function() {
            var self = this;

            if(self._olManipulateInteraction) {
                self._olManipulateInteraction.deleteSelectedFeatures(self._activeOLLayer);
            }
        },
        activateArrowDrawing: function() {
            var self = this;

            self.activateShapeDrawingOnLayer("LineArrow", self._activeOLLayer);
        },
        activateRectangleDrawing: function() {
            var self = this;

            self.activateShapeDrawingOnLayer("Rectangle", self._activeOLLayer);
        },
        activateEllipseDrawing: function() {
            var self = this;

            self.activateShapeDrawingOnLayer("Ellipse", self._activeOLLayer);
        },
        activateMarkerDrawing: function() {
            var self = this;

            self.activateShapeDrawingOnLayer("Marker", self._activeOLLayer);
        },
        activateDotDrawing: function() {
            var self = this;

            self.activateShapeDrawingOnLayer("Dot", self._activeOLLayer);
        },
        activateTextDrawing: function() {
            var self = this;

            self.activateShapeDrawingOnLayer("Text", self._activeOLLayer);
        },
        activateFreeHandLineDrawing: function() {
            var self = this;

            self.activateShapeDrawingOnLayer("FreeHandLine", self._activeOLLayer);
        },
        activateFreeHandClosedDrawing: function() {
            var self = this;

            self.activateShapeDrawingOnLayer("FreeHandClosed", self._activeOLLayer);
        },
        activateLineDrawing: function() {
            var self = this;

            self.activateShapeDrawingOnLayer("Line", self._activeOLLayer);
        },

        /***** Interactions *****/
        addDrawInteraction: function() {
            var self = this,
                addedManipulateInteraction = false; // drawInteraction must be added before ManipulateInteraction

            // Remove added manipulateInteraction
            if(self._olManipulateInteraction) {
                addedManipulateInteraction = self._map.removeInteraction(self._olManipulateInteraction);
            }

            if( !self._olDrawInteraction ) {
                self._olDrawInteraction = new ol.interaction.DrawWithShapes({apiRef: self});
                self._map.addInteraction(self._olDrawInteraction);
            }

            // Add again the ManipulateInteraction is removed for precedence
            if(addedManipulateInteraction) {
                self._map.addInteraction(addedManipulateInteraction);
            }
        },
        addManipulateInteraction: function() {
            var self = this;

            if( !self._olManipulateInteraction ) {
                self._olManipulateInteraction = new ol.interaction.Manipulate({
                    iconsBaseUrl: "../conservation/resources/themes/icons/images/",
                    layerToManipulateOn: self._activeOLLayer,
                    apiRef: self
                });
                self._map.addInteraction(self._olManipulateInteraction);
            }
        },
        switchInteraction: function(interactionType, onOff) {
            var self = this;

            self._map.getInteractions().forEach(function(interaction){
                if(interaction instanceof interactionType) {
                    interaction.setActive(onOff);
                }
            });
        },
        enableCanvasPanning: function() {
            var self = this;
            self.switchInteraction(ol.interaction.DragPan, true);
        },
        disableCanvasPanning: function() {
            var self = this;
            self.switchInteraction(ol.interaction.DragPan, false);
        },
        disableSelection: function() {
            var self = this;
            self.switchInteraction(ol.interaction.Manipulate, false);
        },
        enableSelection: function() {
            var self = this;
            self.switchInteraction(ol.interaction.Manipulate, true);
        },
        enableSelectionAndDrawing: function() {
            var self = this;
            self.switchInteraction(ol.interaction.Manipulate, true);
            self.switchInteraction(ol.interaction.DrawWithShapes, true);
        },
        disableSelectionAndDrawing: function() {
            var self = this;
            self.switchInteraction(ol.interaction.Manipulate, false);
            self.switchInteraction(ol.interaction.DrawWithShapes, false);
        },

        /***** Export *****/
        exportCanvasForPaper: function(/*string*/imageType) {
            var self = this,
                base64 = "";

            if(self.paperSize) {
                var paperSizeInPixels = [self.paperSize[0] * self.paperDpi, self.paperSize[1] * self.paperDpi];
                base64 = self.getBase64ForTypeExtentAndSize(imageType, self._documentExtent, paperSizeInPixels);
            } else {
                console.log("Not implemented yet.");
                return;
                // When there's no specified paper size, include the baseImage+drawings+margins
                var drawingExtent = self.calculateDrawingExtent();
                if(self.paperMargin) {
                    var marginInPixels = self.paperDpi * self.paperMargin;
                    drawingExtent = [drawingExtent[0] - marginInPixels, drawingExtent[1] - marginInPixels, drawingExtent[2] + marginInPixels, drawingExtent[3] + marginInPixels];
                }
                var outputPaperSize = [ol.extent.getWidth(drawingExtent), ol.extent.getHeight(drawingExtent)];

                base64 = self.getBase64ForTypeExtentAndSize(imageType, drawingExtent, outputPaperSize);
            }

            var exportLink = domConstruct.toDom('<a href="#" style="display:none;" download="Annotation-Snapshot"></a>');
            domConstruct.place(exportLink, self._map.getTarget(), "after");
            exportLink.href = base64;
            exportLink.click();
            domConstruct.destroy(exportLink);
        },
        calculateDrawingExtent: function() {
            var self = this,
                wholeDrawingExtent = self._baseImageLayer.getExtent(),
                i;

            for(i=0; i<self._drawingOLLayers.length; i++) {
                wholeDrawingExtent = ol.extent.extend(wholeDrawingExtent, self._drawingOLLayers[i].getExtent());
            }

            return wholeDrawingExtent;
        },
        getBase64ForSize: function(size) {
            var self = this;

            if(goog.isNumber(size)) {
                size = [size, size];
            }

            var documentExtent = self._documentExtent || self.calculateDrawingExtent(),
                documentExtentWidth = ol.extent.getWidth(documentExtent),
                documentExtentHeight = ol.extent.getHeight(documentExtent),
                proposedDocumentWidth = documentExtentHeight * size[0] / size[1],
                widthOffset = (proposedDocumentWidth - documentExtentWidth) / 2,
                proposedDocumentHeight = documentExtentWidth * size[1] / size[0],
                heightOffset = (proposedDocumentHeight - documentExtentHeight) / 2,
                proposedExtent = null;

            if(widthOffset >= 0) {
                proposedExtent = [documentExtent[0] - widthOffset, documentExtent[1], documentExtent[2] + widthOffset, documentExtent[3]];
            } else {
                proposedExtent = [documentExtent[0], documentExtent[1] - heightOffset, documentExtent[2], documentExtent[3] + heightOffset];
            }

            var base64 = self.getBase64ForTypeExtentAndSize('PNG', proposedExtent, size);
            return base64;
        },
        getBase64ForTypeExtentAndSize: function(/*string*/imageType, exportExtent, sizeInPixels) {
            var self = this;

            // Determining blocks of document that will be used iteratively to capture canvas image data
            var documentExtent = exportExtent,
                paperSizeInPixels = sizeInPixels,
                map = self._map,
                mapView = self._mapView,
                currentResolution = mapView.getResolution(),
                mapSize = map.getSize(),
                documentBottomLeftPixels = map.getPixelFromCoordinate(ol.extent.getBottomLeft(documentExtent)),
                documentTopRightPixels = map.getPixelFromCoordinate(ol.extent.getTopRight(documentExtent)),
                documentWidthPixels = Math.abs(documentTopRightPixels[0] - documentBottomLeftPixels[0]),
                resolutionForOutputPaperSize = currentResolution * documentWidthPixels / paperSizeInPixels[0];

            mapView.setResolution(resolutionForOutputPaperSize);
            map.renderSync();

            var documentBottomLeftPixels = map.getPixelFromCoordinate(ol.extent.getBottomLeft(documentExtent)),
                documentTopRightPixels = map.getPixelFromCoordinate(ol.extent.getTopRight(documentExtent)),
                documentWidthPixels = Math.round(Math.abs(documentTopRightPixels[0] - documentBottomLeftPixels[0])),
                documentHeightPixels = Math.round(Math.abs(documentTopRightPixels[1] - documentBottomLeftPixels[1])),
                widthPieces = Math.ceil( documentWidthPixels / mapSize[0] ),
                widthPieceCoordinateDistance = ol.extent.getWidth(documentExtent) / widthPieces,
                widthPiecePixelDistance = documentWidthPixels / widthPieces,
                heightPieces = Math.ceil( documentHeightPixels / mapSize[1] ),
                heightPieceCoordinateDistance = ol.extent.getHeight(documentExtent) / heightPieces,
                heightPiecePixelDistance = documentHeightPixels / heightPieces,
                i, j;

            var hiddenCanvas = domConstruct.toDom('<canvas style="display:none;" width="'+documentWidthPixels+'" height="'+documentHeightPixels+'"></canvas>');
            domConstruct.place(hiddenCanvas, map.getTarget(), "after");


            var mapContext = map.getRenderer().context_,
                hiddenContext = hiddenCanvas.getContext("2d");

            // Painting white background to export canvas
            hiddenContext.fillStyle = 'white';
            hiddenContext.fillRect(0, 0, documentWidthPixels, documentHeightPixels);

            if(mapContext) {
                // Captures from bottom left to top right
                for(i=0; i<widthPieces; i++) {
                    for(j=0; j<heightPieces; j++) {
                        var pieceExtent = [ documentExtent[0] + i * widthPieceCoordinateDistance, documentExtent[1] + j * heightPieceCoordinateDistance,
                                documentExtent[0] + ( (i + 1) * widthPieceCoordinateDistance ), documentExtent[1] + ( (j + 1) * heightPieceCoordinateDistance ) ];

                        mapView.setCenter(ol.extent.getCenter(pieceExtent));

                        map.renderSync();

                        var topLeftPixel = map.getPixelFromCoordinate(ol.extent.getTopLeft(pieceExtent)),
                            pieceImageData = mapContext.getImageData(topLeftPixel[0], topLeftPixel[1], widthPiecePixelDistance, heightPiecePixelDistance);

                        hiddenContext.putImageData(pieceImageData, i * widthPiecePixelDistance, (heightPieces-j-1) * heightPiecePixelDistance);

                        map.renderSync();
                    }
                }

                var exportEncoding = imageType == "JPEG" ? "image/jpeg" : "image/png",
                    base64 = hiddenCanvas.toDataURL(exportEncoding);

                domConstruct.destroy(hiddenCanvas);
                return base64;

            } else {
                // @TODO implement invalid renderer prompt
                return 'Error';
            }
        }
    };
});