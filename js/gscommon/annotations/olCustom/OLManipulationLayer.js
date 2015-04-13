define([
    "dojo/_base/lang",
    "dojo/_base/array"
], function (lang, array) {

    /**
     * Layer responsible for displaying guide features / grab handles to manipulate features
     * Features rendered for hints/guides/handles to manipulate features will have higher zIndex to be displayed on top
     * and will have specific styles to distinguish them from other features
     *
     * Features drawn on this layer will have specific listeners representing manipulation behavior
     */

    goog.provide('ol.layer.Manipulation');
    goog.provide('ol.ManipulationFeatureType');

    goog.require('ol.layer.Vector');
    goog.require('ol.Collection');
    goog.require('ol.extent');
    goog.require('goog.math.Coordinate');
    goog.require('goog.math');



    ol.ManipulationFeatureType = {
        RESIZEBOX: "ResizeBox",
        RESIZEHANDLE: "ResizeHandle",
        ROTATEHANDLE: "RotateHandle",
        BASEIMAGERESIZEHANDLE: "BaseImageResizeHandle",
        SHAPESPECIFIC: "ShapeSpecific"
    };

    ol.layer.Manipulation = function(opt_options) {
        if(!goog.isDef(opt_options))
            opt_options = {};

        goog.base(this);

        // Check if baseLayer is porvided to accomodate baseImage manipulation (Proportion Scale and Move only)
        this.manipulatableBaseLayer_ = opt_options.manipulatableBaseLayer;

        // Icons location for cursor or other ncecessary icons
        this.iconsBaseUrl_ = opt_options.iconsBaseUrl || "img/";

        // Setting all layer and handle styles
        this.setStyles_(opt_options);

        this.setSource(new ol.source.Vector());
        this.isManipulationLayer = true; // Indicator that this layer is used for manipulation

        // Separate layer for displaying manipulation handles (scale/resize, rotate)
        this.handlesLayer = new ol.layer.Vector({
            source: new ol.source.Vector(),
            style: this.handlesStyle_
        });

        this.handlesLayer.isHandlesLayer = true; // Indicator that this layer is used to display manipulation handles

        this.map_ = null; // Reference to the last used map
        this.mapViewResolutionListenerKey_ = null; // Handle to ol.View:change:resolution listener, Needed to redraw modification handlers updon resolution change
        this.shape_ = null; // Reference to manipulating shape
        this.shapeOriginalGeometry_ = null; // To keep record of geometry of feature before manipulation
        this.dragFromPx_ = null; // Tracking dragFromPx, updated differenctly for "move" than "rotate"/"resize"

        this.apiRef_ = opt_options.apiRef;

        this._textEditorOverlay = null; // Should be only one text editor open at a time editing a shape feature

        this.shapeSelectedForManipulation = function(map, shapeFeature) {
            this.map_ = map;

            this.shapeUnSelected();

            if(goog.isNull(shapeFeature))
                return false;

            this.shape_ = shapeFeature;
            this.shapeOriginalGeometry_ = shapeFeature.getGeometry().clone();

            // Initialize state trackers
            if( !shapeFeature.get('rotationDegrees') ) {
                shapeFeature.set('rotationDegrees', 0);
            }

            if( !shapeFeature.get('rotationDegreesCurrentDrag') ) {
                shapeFeature.set('rotationDegreesCurrentDrag', 0);
            }

            this.displaySelectBoxForFeature();
            this.displayResizeHandlesForFeature();
            this.displayRotateHandleForFeature();

            this.displayShapeSpecificHandlesForFeature();

            // Observing view:resolution and refreshing modification handlers on change
            this.observeViewResolution_(this.map_.getView());
        };

        this.getManipulatingFeature = function(){
            return this.shape_;
        };

        /**
         * Called by ol.layer.manipulate when dragging is done upon Pointer Up event
         * @param  {ol.Feature} shapeOrHandleFeature For "move" refers to shapeFeature, for rotation or scale refers to manipulationFeature
         */
        this.draggingDone = function(shapeOrHandleFeature) {
            var shapeFeature = goog.isDef(shapeOrHandleFeature.isHandleFeature) && shapeOrHandleFeature.isHandleFeature ? shapeOrHandleFeature.manipulatingFeature_ : shapeOrHandleFeature;

            if(shapeFeature) {
                // Preserving accumulative rotation
                if(shapeOrHandleFeature.handleType && shapeOrHandleFeature.handleType == ol.ManipulationFeatureType.ROTATEHANDLE) {
                    shapeFeature.set('rotationDegrees', this.getAccumulativeRotationForFeature_(shapeFeature));
                    shapeFeature.set('rotationDegreesCurrentDrag', 0);
                }

                this.shapeOriginalGeometry_ = shapeFeature.getGeometry().clone();
            }

            if(this.manipulatableBaseLayer_) {
                this.manipulatableBaseLayer_.resizeState = null;
            }

            this.dragFromPx_ = null;
        };

        this.shapeManipulated = function(shapeFeature) {
            this.clearManipulationFeatures();

            if(this.shape_ && this.shape_.manipulated) {
                this.shape_.manipulated();
            }

            this.displayManipulationFeatures();
        };

        this.clear = function() {
            this.shapeUnSelected(); // Just for API
        };

        this.shapeUnSelected = function() {
            this.shape_ = null;
            this.shapeOriginalGeometry_ = null;
            this.dragFromPx_ = null;

            this.clearManipulationFeatures();

            if(this.map_) {
                this.observeViewResolution_(this.map_.getView()); // Removing the view change:resolution listener
            }
        };

        this.displayManipulationFeatures = function() {
            this.displaySelectBoxForFeature();
            this.displayResizeHandlesForFeature();
            this.displayRotateHandleForFeature();
            this.displayShapeSpecificHandlesForFeature();
        };

        this.clearManipulationFeatures = function() {
            this.getSource().clear();
            this.handlesLayer.getSource().clear();
        };

        this.observeViewResolution_ = function(view) {
            if(this.mapViewResolutionListenerKey_)
                view.unByKey(this.mapViewResolutionListenerKey_);

            if(this.shape_) {
                this.mapViewResolutionListenerKey_ = view.on("change:resolution", function(evt) {
                    this.clearManipulationFeatures();
                    this.displayManipulationFeatures();
                }, this);
            }
        };

        this.createRotateHandleForFeature_ = function(feature, cursorImageUrl) {
            goog.asserts.assertInstanceof(feature.selectBoxRectangle_, ol.Feature);
            var selectBoxCoordinates = feature.selectBoxRectangle_.getGeometry().getCoordinates(),
            //rotateHandleCoordinate = [ selectBoxCoordinates[0][5][0]+20, selectBoxCoordinates[0][5][1] + (selectBoxCoordinates[0][6][1] - selectBoxCoordinates[0][5][1] )/2 ],
                rotateHandleCoordinate = selectBoxCoordinates[0][3],
                rotatePoint = new ol.geom.Point(rotateHandleCoordinate, ol.geom.GeometryLayout.XY),
                rotateHandleFeature = new ol.Feature({geometry: rotatePoint});

            rotateHandleFeature.setStyle(this.rotateHandleStyle_);

            rotateHandleFeature.isHandleFeature = true;  // Indication that feature is a manipulation handle
            rotateHandleFeature.handleType = ol.ManipulationFeatureType.ROTATEHANDLE;
            rotateHandleFeature.cursorStyle = 'url("'+cursorImageUrl+'") 12 12, auto';

            rotateHandleFeature.manipulatingFeature_ = feature;
            rotateHandleFeature.manipulatingFeatureOriginalGeometry_ = feature.getGeometry().clone();

            return rotateHandleFeature;
        };

        this.displayRotateHandleForFeature = function() {
            if(this.shape_.manipulationConfig.showRotateHandle) {
                var rotateHandle = this.createRotateHandleForFeature_(this.shape_, this.iconsBaseUrl_ + "rotate.png");
                this.handlesLayer.getSource().addFeature(rotateHandle);
            }
        };

        this.rotateHandleDragged_ = function(map, handleFeature, fromPx, toPx) {
            var manipulationLayer = this,
                shapeFeatureExtent = this.shapeOriginalGeometry_.getExtent(), // @TODO: check error => Uncaught TypeError: Cannot read property 'getExtent' of null
                shapeFeatureCenter = ol.extent.getCenter(shapeFeatureExtent),
                centerCoordinate = map.getCoordinateFromPixel(shapeFeatureCenter),
                fromCoordinate = map.getCoordinateFromPixel(fromPx),
                toCoordinate = map.getCoordinateFromPixel(toPx),
                mathFromPoint = this.olCoordToMathCoord_(fromCoordinate),
                mathToPoint = this.olCoordToMathCoord_(toCoordinate),
                mathCenter = this.olCoordToMathCoord_(shapeFeatureCenter), // Pixel center should not be converted to map coordinate
                dragStartAngleDegrees = goog.math.angle(mathCenter.x, mathCenter.y, mathFromPoint.x, mathFromPoint.y),
                dragEndAngleDegrees = goog.math.angle(mathCenter.x, mathCenter.y, mathToPoint.x, mathToPoint.y),
                differenceAngleDegrees = goog.math.angleDifference(dragStartAngleDegrees, dragEndAngleDegrees);

            this.shape_.setGeometry( this.rotateGeometryAroundCoordinate_(this.shapeOriginalGeometry_.clone(), shapeFeatureCenter, differenceAngleDegrees) );

            // Updating attribute to preserve rotation
            this.shape_.set('rotationDegreesCurrentDrag', differenceAngleDegrees);
            this.shape_.set('rotationCenter', shapeFeatureCenter);
        };

        this.createResizeHandleForFeature_ = function(manipulatingFeature, coordinate, resizesX, resizesY, cursorStyle, referenceExtentCoordinate, signXChange, signYChange) {
            var resizeHandlePoint = new ol.geom.Point(coordinate, ol.geom.GeometryLayout.XY),
                resizeHandleFeature = new ol.Feature({geometry: resizeHandlePoint});

            resizeHandleFeature.setStyle(this.handlesStyle_);

            resizeHandleFeature.isHandleFeature = true;  // Indication that feature is a manipulation handle
            resizeHandleFeature.handleType = ol.ManipulationFeatureType.RESIZEHANDLE;
            resizeHandleFeature.cursorStyle = cursorStyle;

            resizeHandleFeature.resizesX_ = resizesX;
            resizeHandleFeature.resizesY_ = resizesY;
            resizeHandleFeature.signXChange_ = signXChange;
            resizeHandleFeature.signYChange_ = signYChange;
            resizeHandleFeature.referenceExtentCoordinate_ = referenceExtentCoordinate;
            resizeHandleFeature.manipulatingFeature_ = manipulatingFeature;
            resizeHandleFeature.manipulatingFeatureOriginalGeometry_ = manipulatingFeature.getGeometry().clone();

            return resizeHandleFeature;
        };

        this.displayResizeHandlesForFeature = function() {
            var feature = this.shape_;
            if(this.shape_.manipulationConfig.showResizeHandles) {
                goog.asserts.assertInstanceof(feature.selectBoxRectangle_, ol.Feature);

                var selectBoxCoordinates = feature.selectBoxRectangle_.getGeometry().getCoordinates(),
                    selectBoxExtentCenter = ol.extent.getCenter(feature.selectBoxRectangle_.getGeometry().getExtent()),
                    i;

                // Determining directional resize coodinates taking in account the current rotation.
                var rotatedResizeHandleObjs = [
                    { handleCoordinate: [ ( selectBoxCoordinates[0][6][0] + selectBoxCoordinates[0][0][0] ) / 2, ( selectBoxCoordinates[0][6][1] + selectBoxCoordinates[0][0][1] ) / 2 ], resizesX: false, resizesY: true, signXChange: 1, signYChange: 1},
                    { handleCoordinate: selectBoxCoordinates[0][0], resizesX: true, resizesY: true, signXChange: 1, signYChange: 1},
                    { handleCoordinate: [ ( selectBoxCoordinates[0][0][0] + selectBoxCoordinates[0][1][0] ) / 2, ( selectBoxCoordinates[0][0][1] + selectBoxCoordinates[0][1][1] ) / 2 ], resizesX: true, resizesY: false, signXChange: 1, signYChange: -1},
                    { handleCoordinate: selectBoxCoordinates[0][1], resizesX: true, resizesY: true, signXChange: 1, signYChange: -1},
                    { handleCoordinate: [ ( selectBoxCoordinates[0][1][0] + selectBoxCoordinates[0][5][0] ) / 2, ( selectBoxCoordinates[0][1][1] + selectBoxCoordinates[0][5][1] ) / 2 ], resizesX: false, resizesY: true, signXChange: 1, signYChange: -1},
                    { handleCoordinate: selectBoxCoordinates[0][5], resizesX: true, resizesY: true, signXChange: -1, signYChange: -1},
                    { handleCoordinate: [ ( selectBoxCoordinates[0][5][0] + selectBoxCoordinates[0][6][0] ) / 2, ( selectBoxCoordinates[0][5][1] + selectBoxCoordinates[0][6][1] ) / 2 ], resizesX: true, resizesY: false, signXChange: -1, signYChange: -1},
                    { handleCoordinate: selectBoxCoordinates[0][6], resizesX: true, resizesY: true, signXChange: -1, signYChange: 1}
                ];

                // Assigning position reference coordinates
                rotatedResizeHandleObjs[0].positionRefCoord = rotatedResizeHandleObjs[4].handleCoordinate;
                rotatedResizeHandleObjs[1].positionRefCoord = rotatedResizeHandleObjs[5].handleCoordinate;
                rotatedResizeHandleObjs[2].positionRefCoord = rotatedResizeHandleObjs[6].handleCoordinate;
                rotatedResizeHandleObjs[3].positionRefCoord = rotatedResizeHandleObjs[7].handleCoordinate;
                rotatedResizeHandleObjs[4].positionRefCoord = rotatedResizeHandleObjs[0].handleCoordinate;
                rotatedResizeHandleObjs[5].positionRefCoord = rotatedResizeHandleObjs[1].handleCoordinate;
                rotatedResizeHandleObjs[6].positionRefCoord = rotatedResizeHandleObjs[2].handleCoordinate;
                rotatedResizeHandleObjs[7].positionRefCoord = rotatedResizeHandleObjs[3].handleCoordinate;

                feature.resizeHandleFeatures_ = [];

                var handleCursorStylesByAngle = ["nesw-resize", "ew-resize", "nwse-resize", "ns-resize", "nesw-resize", "ew-resize", "nwse-resize", "ns-resize"],
                    cursorStyleIndex;

                for( i=0; i < rotatedResizeHandleObjs.length; i++ ) {
                    var handlePropertiesObject = rotatedResizeHandleObjs[i],
                        rotatedCoordinate = handlePropertiesObject.handleCoordinate,
                        resizeHandleAngle = goog.math.angle(selectBoxExtentCenter[0], selectBoxExtentCenter[1], rotatedCoordinate[0], rotatedCoordinate[1]);

                    if( i == 0) {
                        // Around 225 Degrees
                        if(resizeHandleAngle <= 247.5 && resizeHandleAngle > 202.4)
                            cursorStyleIndex = 0;

                        // Around 180 Degrees
                        if(resizeHandleAngle <= 202.5 && resizeHandleAngle > 157.5)
                            cursorStyleIndex = 1;

                        // Around 135 Degrees
                        if(resizeHandleAngle <= 157.5 && resizeHandleAngle > 112.5)
                            cursorStyleIndex = 2;

                        // Around 90 Degrees
                        if(resizeHandleAngle <= 112.5 && resizeHandleAngle > 67.5)
                            cursorStyleIndex = 3;

                        // Around 45 Degrees
                        if(resizeHandleAngle <= 67.5 && resizeHandleAngle > 22.5)
                            cursorStyleIndex = 4;

                        // Around 0 Degrees
                        if( (resizeHandleAngle <= 22.5 && resizeHandleAngle > 0) || (resizeHandleAngle <= 360 && resizeHandleAngle > 337.5) )
                            cursorStyleIndex = 5;

                        // Around 315 Degrees
                        if(resizeHandleAngle <= 337.5 && resizeHandleAngle > 292.5)
                            cursorStyleIndex = 6;

                        // Around 270 Degrees
                        if(resizeHandleAngle <= 292.5 && resizeHandleAngle > 247.5)
                            cursorStyleIndex = 7;
                    } else {
                        cursorStyleIndex += 1;
                        if(cursorStyleIndex == 8) {
                            cursorStyleIndex = 0;
                        }
                    }

                    var cursorStyle = handleCursorStylesByAngle[cursorStyleIndex];
                    feature.resizeHandleFeatures_.push(this.createResizeHandleForFeature_(feature, rotatedCoordinate, handlePropertiesObject.resizesX, handlePropertiesObject.resizesY, cursorStyle, handlePropertiesObject.positionRefCoord, handlePropertiesObject.signXChange, handlePropertiesObject.signYChange));
                }

                this.handlesLayer.getSource().addFeatures(feature.resizeHandleFeatures_);
            }
        };

        this.resizeHandleDragged_ = function(map, handleFeature, fromPx, toPx) {
            var unRotatedShapeGeometry = this.shapeOriginalGeometry_.clone();
            if(this.shape_.get('rotationCenter')) {
                unRotatedShapeGeometry = this.rotateGeometryAroundCoordinate_( unRotatedShapeGeometry, this.shape_.get('rotationCenter'), -1 * this.shape_.get('rotationDegrees') );
            }

            var shapeFeatureExtent = unRotatedShapeGeometry.getExtent(), //this.shapeOriginalGeometry_.getExtent(), // @TODO: check error => TypeError: this.shapeOriginalGeometry_ is null
                shapeFeatureWidth = shapeFeatureExtent[2] - shapeFeatureExtent[0],
                shapeFeatureHeight = shapeFeatureExtent[3] - shapeFeatureExtent[1],
                fromCoordinate = map.getCoordinateFromPixel(fromPx),
                toCoordinate = map.getCoordinateFromPixel(toPx),
                positionReferenceCoordinate = handleFeature.referenceExtentCoordinate_;

            // If shape is rotated, un rotate the reference coordinates
            if(this.shape_.get('rotationDegrees') && this.shape_.get('rotationCenter')) {
                var unrotatedRefCoords = this.rotateCoordinatesArrayAroundCoordinate_([fromCoordinate, toCoordinate, positionReferenceCoordinate], this.shape_.get('rotationCenter'), -1 * this.shape_.get('rotationDegrees'));
                fromCoordinate = unrotatedRefCoords[0];
                toCoordinate = unrotatedRefCoords[1];
                positionReferenceCoordinate = unrotatedRefCoords[2];
            }

            var dragXDistance = handleFeature.signXChange_ * (toCoordinate[0] - fromCoordinate[0]),
                dragYDistance = handleFeature.signYChange_ * (toCoordinate[1] - fromCoordinate[1]),
                scaleX = handleFeature.resizesX_ ? (1 - dragXDistance / shapeFeatureWidth): 1,
                scaleY = handleFeature.resizesY_ ? (1 - dragYDistance / shapeFeatureHeight): 1,
                updatedPositionReferenceCoordinate = [(positionReferenceCoordinate[0] * scaleX), (positionReferenceCoordinate[1] * scaleY)],
                displacementX = positionReferenceCoordinate[0] - updatedPositionReferenceCoordinate[0],
                displacementY = positionReferenceCoordinate[1] - updatedPositionReferenceCoordinate[1];

            var shapeCoordinates = this.grabCoordinatesArrayFromGeometry_(unRotatedShapeGeometry);

            // Scaling/Resizing coordinates
            shapeCoordinates = shapeCoordinates.map(function(coordinate) {
                return [coordinate[0] * scaleX + displacementX, coordinate[1] * scaleY + displacementY];
            });

            // Re Rotating coordinates if shape is rotated
            if(this.shape_.get('rotationDegrees') && this.shape_.get('rotationCenter')) {
                shapeCoordinates = this.rotateCoordinatesArrayAroundCoordinate_(shapeCoordinates, this.shape_.get('rotationCenter'), this.shape_.get('rotationDegrees'));
            }

            shapeCoordinates = this.wrapCoordinatesArrayForGeometry_(this.shape_.getGeometry(), shapeCoordinates);

            // Scaling shape feature
            if(this.shape_.getGeometry().setCoordinatesForManipulation) {
                // For geometries that provide custom coordinate structure (Non Polygonal e.g. Ellipse)
                this.shape_.getGeometry().setCoordinatesForManipulation(shapeCoordinates);

                if(this.shape_.getGeometry().getCenter) {
                    // Needed, experimental
                    // this.shape_.set('rotationCenter', this.shape_.getGeometry().getCenter());
                }
            } else {
                this.shape_.getGeometry().setCoordinates(shapeCoordinates);
            }
        };

        this.featureDragged = function(map, handleOrShapeFeature, fromPx, toPx, mapBrowserEvent) {
            this.mapResolution_ = map.getView().getResolution();

            if(!this.dragFromPx_) {
                this.dragFromPx_ = fromPx;
            }

            // Determining what type of feature is dragged
            if(goog.isDef(handleOrShapeFeature.isHandleFeature) && handleOrShapeFeature.isHandleFeature) {
                if( goog.isDef(handleOrShapeFeature.handleType) ) {

                    if(handleOrShapeFeature.handleType === ol.ManipulationFeatureType.RESIZEHANDLE ) {
                        this.resizeHandleDragged_(map, handleOrShapeFeature, this.dragFromPx_, toPx);
                        this.shapeManipulated();
                    }

                    if( handleOrShapeFeature.handleType === ol.ManipulationFeatureType.ROTATEHANDLE ) {
                        this.rotateHandleDragged_(map, handleOrShapeFeature, this.dragFromPx_, toPx);
                        this.shapeManipulated();
                    }

                    if( handleOrShapeFeature.handleType === ol.ManipulationFeatureType.BASEIMAGERESIZEHANDLE ) {
                        this.baseLayerResizeHandleDragged_(map, handleOrShapeFeature, this.dragFromPx_, toPx);
                    }

                    if( handleOrShapeFeature.handleType === ol.ManipulationFeatureType.SHAPESPECIFIC ) {
                        handleOrShapeFeature.manipulatingFeature_.manipulaitonHandleDragged(map, handleOrShapeFeature, this.dragFromPx_, toPx, mapBrowserEvent);

                        if(handleOrShapeFeature.isIncrementalChange) {
                            this.dragFromPx_ = toPx;
                        }

                        this.shapeManipulated();
                    }
                }
            } else {
                this.shapeDragged_(map, handleOrShapeFeature, this.dragFromPx_, toPx);

                // For incremental dragging
                this.dragFromPx_ = toPx;
                this.shapeManipulated();
            }
        };

        this.shapeDragged_ = function(map, handleFeature, fromPx, toPx) {
            this.translateFeature_(map, handleFeature, this.dragFromPx_, toPx);
        };

        this.startTextEditingForShape =  function(map, mapBrowserEvent) {
            var textExtent = this.shape_.getTextExtent(map, mapBrowserEvent),
                carotaTextObj = this.shape_.getCurrentTextObj(map, mapBrowserEvent),
                width = ol.extent.getWidth(textExtent),
                height = ol.extent.getHeight(textExtent),
                position = ol.extent.getTopLeft(textExtent);

            // Checks whether editor already exists for the current shape
            if(this._textEditorOverlay instanceof ol.Overlay && this._textEditorOverlay.manipulatingFeature == this.shape_ && this._textEditorOverlay.editor) {
                // Editor already exists for this shape, just update it
            } else {
                if(this._textEditorOverlay instanceof ol.Overlay) {
                    // Finish functionality for the previous editor
                    this.map_.removeOverlay(this._textEditorOverlay);

                    var editorElement = this._textEditorOverlay.getElement();
                    if(editorElement) {
                        goog.dom.removeChildren(editorElement);
                        goog.dom.removeNode(editorElement);
                    }
                } else {
                    this._textEditorOverlay = new ol.Overlay({
                        stopEvent: true
                    });
                }

                var editorElement = goog.dom.createElement(goog.dom.TagName.DIV);
                goog.dom.setProperties(editorElement, {
                    width: width,
                    height: height
                });
                this._textEditorOverlay.editor = carota.editor.create(editorElement);

                this._textEditorOverlay.setElement(editorElement);
                this._textEditorOverlay.setPosition(position);

                this._textEditorOverlay.editor.load(carotaTextObj);

                this.map_.addOverlay(this._textEditorOverlay);
            }
        };

        this.featureDBLClicked = function(map, handleOrShapeFeature, fromPx, toPx, mapBrowserEvent) {
            if(handleOrShapeFeature.manipulationConfig && handleOrShapeFeature.manipulationConfig.editsTextOnDBLClick) {
                //handleOrShapeFeature.hideCurrentText(map, mapBrowserEvent);
                this.startTextEditingForShape(map, mapBrowserEvent);

                return true;
            } else {
                return false; // DB Click isn't handled
            }
        };

        this.baseLayerResizeHandleDragged_ = function(map, handleOrShapeFeature, fromPx, toPx) {
            var handle = handleOrShapeFeature,
                baseLayer = handle.baseLayer;

            if( !baseLayer.resizeState ) {
                var bottomLeft = map.getPixelFromCoordinate(ol.extent.getBottomLeft(baseLayer.currentExtent_)),
                    topRight = map.getPixelFromCoordinate(ol.extent.getTopRight(baseLayer.currentExtent_));

                baseLayer.resizeState = {
                    originalExtentInPixels: [ bottomLeft[0], bottomLeft[1], topRight[0], topRight[1] ],
                    currentViewResolution: map.getView().getResolution(),
                    currentDocumentResolutionFactor: baseLayer.documentResolutionFactor,
                    documentExtentBottomLeftPixels: map.getPixelFromCoordinate(ol.extent.getBottomLeft(baseLayer._documentExtent)),
                    documentExtentTopRightPixels: map.getPixelFromCoordinate(ol.extent.getTopRight(baseLayer._documentExtent))
                }
            }

            var viewResolution = baseLayer.resizeState.currentViewResolution,
                extent = baseLayer.resizeState.originalExtentInPixels,
                handleExtentPixel = [ extent[handle.extentCoordinateIndex[0]], extent[handle.extentCoordinateIndex[1]] ],
                referenceExtentPixel = [ extent[handle.referenceExtentCoordinateIndex[0]], extent[handle.referenceExtentCoordinateIndex[1]] ],
                referenceExtentCoordinate = map.getCoordinateFromPixel(referenceExtentPixel),
                diagonalExtentDistance = Math.sqrt( ol.coordinate.squaredDistance(referenceExtentPixel, handleExtentPixel) ),
                draggedDistance = Math.sqrt( ol.coordinate.squaredDistance(referenceExtentPixel, toPx) ),
                documentResolutionFactor = draggedDistance / diagonalExtentDistance;

            map.getView().setResolution(viewResolution / documentResolutionFactor);

            // resolution factor
            var resolutionDifference = baseLayer.resizeState.currentViewResolution - map.getView().getResolution();
            baseLayer.documentResolutionFactor = baseLayer.resizeState.currentDocumentResolutionFactor + resolutionDifference;

            // persisting document extent
            var bottomLeftExtentCoordinate = map.getCoordinateFromPixel(baseLayer.resizeState.documentExtentBottomLeftPixels),
                topRightExtentCoordinate = map.getCoordinateFromPixel(baseLayer.resizeState.documentExtentTopRightPixels);

            baseLayer._documentExtent = [bottomLeftExtentCoordinate[0], bottomLeftExtentCoordinate[1], topRightExtentCoordinate[0], topRightExtentCoordinate[1]];

            console.log("resolutionDifference", resolutionDifference, "documentResolutionFactor", baseLayer.documentResolutionFactor, "res + fac", map.getView().getResolution() + baseLayer.documentResolutionFactor);
        };

        this.olCoordToMathCoord_ = function(olCoordinate) {
            return new goog.math.Coordinate(olCoordinate[0], olCoordinate[1]);
        };

        this.mathCoordToOLCoord_ = function(mathCoordinate) {
            return [mathCoordinate.x, mathCoordinate.y];
        };

        this.rotateCoordinatesArrayAroundCoordinate_ = function(coordinates, centerCoordinate, angleDegreesToRotate) {
            var manipulationLayer = this,
                mathCenter = manipulationLayer.olCoordToMathCoord_(centerCoordinate);

            coordinates = coordinates.map(function(coordinate) {
                var mathCoordinate = manipulationLayer.olCoordToMathCoord_(coordinate);
                mathCoordinate.rotateDegrees(angleDegreesToRotate, mathCenter);
                return manipulationLayer.mathCoordToOLCoord_(mathCoordinate);
            });

            return coordinates;
        };

        this.rotateGeometryAroundCoordinate_ = function(geometry, centerCoordinate, angleDegreesToRotate) {
            if(geometry.manipulationConfig && geometry.manipulationConfig.handlesRotation) {
                geometry.rotate(angleDegreesToRotate, centerCoordinate);
            } else {
                var geometryLayout = geometry.getLayout(),
                    rotatedGeometryCoordinates = this.rotateCoordinatesArrayAroundCoordinate_(this.grabCoordinatesArrayFromGeometry_(geometry), centerCoordinate, angleDegreesToRotate);

                rotatedGeometryCoordinates = this.wrapCoordinatesArrayForGeometry_(geometry, rotatedGeometryCoordinates);

                geometry.setCoordinates(rotatedGeometryCoordinates, geometryLayout);
            }
            return geometry;
        };

        this.getAccumulativeRotationForFeature_ = function(shapeFeature) {
            if(!isNaN( shapeFeature.get('rotationDegreesCurrentDrag')) ) {
                return goog.math.angleDifference( 360, shapeFeature.get('rotationDegreesCurrentDrag') + shapeFeature.get('rotationDegrees'));
            } else {
                return shapeFeature.get('rotationDegrees');
            }
        };

        this.rotateFeature_ = function(feature, centerCoordinate, angleDegreesToRotate) {
            feature.setGeometry(this.rotateGeometryAroundCoordinate_(feature.getGeometry(), centerCoordinate, angleDegreesToRotate));
            return feature;
        };

        this.translateFeature_ = function(map, feature, fromPx, toPx) {
            var interaction = this,
                fromCoordinate = map.getCoordinateFromPixel(fromPx),
                toCoordinate = map.getCoordinateFromPixel(toPx);
            var differenceMathCoordinate = goog.math.Coordinate.difference(this.olCoordToMathCoord_(toCoordinate), this.olCoordToMathCoord_(fromCoordinate));

            // Checks and delegates if geometry provides its own custom translation behavior
            if(feature.getGeometry().manipulationConfig && feature.getGeometry().manipulationConfig.handlesTranslation) {
                feature.getGeometry().translate([differenceMathCoordinate.x, differenceMathCoordinate.y]);
                if(feature.getGeometry().getCenter) {
                    feature.set('rotationCenter', feature.getGeometry().getCenter()); // Needed, by experiment
                }
            } else {
                var coordinates = goog.array.map(this.grabCoordinatesArrayFromGeometry_(feature.getGeometry()), function(olCoordinate) {
                    var translatedMathCoordinate = interaction.olCoordToMathCoord_(olCoordinate).translate(differenceMathCoordinate);
                    return [translatedMathCoordinate.x, translatedMathCoordinate.y];
                }, this);

                coordinates = this.wrapCoordinatesArrayForGeometry_(feature.getGeometry(), coordinates);

                feature.getGeometry().setCoordinates(coordinates);
            }
        };

        /**
         * This is needed because Point, LineString and Polygons have different array structure of coordinates
         * @param  {ol.geom.Geometry} geometry the geometry to grab coordinates from
         * @return {Array<ol.Coordinate>}          A two dimensional array of coordinates
         */
        this.grabCoordinatesArrayFromGeometry_ = function(geometry) {
            // @TODO account for "multi" geometries
            var coordinates = false;
            // Check if a geometry provides specific interface for manipulation
            if(geometry.getCoordinatesForManipulation) {
                coordinates = geometry.getCoordinatesForManipulation();
            }

            if(!coordinates) {
                coordinates = geometry.getCoordinates();
            }

            if(goog.isDef(coordinates[0][0])) {
                if(coordinates[0][0] && goog.isDef(coordinates[0][0][0])) {
                    return coordinates[0];
                } else {
                    return coordinates;
                }

            } else {
                return [ coordinates ];
            }
        };

        /**
         * This is needed because Point, LineString and Polygons have different array structure of coordinates
         * So when assigned manipulated array of coordinates, they must be transformed into proper structure
         * @param  {ol.geom.Geometry} geometry the geometry to determine the array structure
         * @param {Array<ol.Coordinate>} coordinates The coordintes to wrap to
         * @return {Array}          array of ol.Coordinate of appropriate dimensions
         */
        this.wrapCoordinatesArrayForGeometry_ = function(geometry, coordinates) {
            var coordinateStructure = false;
            // Check if a geometry provides specific interface for manipulation
            if(geometry.getCoordinatesForManipulation) {
                coordinateStructure = geometry.getCoordinatesForManipulation();
            }

            if(!coordinateStructure) {
                coordinateStructure = geometry.getCoordinates();
            }

            if(goog.isDef(coordinateStructure[0][0])) {
                if(coordinateStructure[0][0] && goog.isDef(coordinateStructure[0][0][0])) {
                    return [ coordinates ];
                } else {
                    return coordinates;
                }

            } else {
                return coordinates[0];
            }
        };

        /**
         * createSelectBoxFeature_ returns a feature to display a dashed rectangle around the extent of the selected
         * feature to depict the feature is selected and can be moved by dragging
         * @param  {ol.Feature} feature Feature to use for determining coordinates of SelectBox Polygon (Rectangle)
         * @param  {boolean}    includeRotateHandleCoordinates Whether to account for coordinate for displaying rotate
         *                      handle on.
         * @return {ol.Feature}         new feature that represents the bouding rectangle
         */
        this.createSelectBoxFeature_ = function(feature, includeRotateHandleCoordinates) {
            if (typeof includeRotateHandleCoordinates == "undefined")
                includeRotateHandleCoordinates = true;

            var geometry = feature.getGeometry().clone();
            if(feature.get('rotationCenter')) {
                var rotatedAngle = goog.math.angleDifference( 360, feature.get('rotationDegreesCurrentDrag') + feature.get('rotationDegrees'));
                geometry = this.rotateGeometryAroundCoordinate_( geometry, feature.get('rotationCenter'), -1 * rotatedAngle );
            }

            var unRotatedFeatureExtent = geometry.getExtent(),
                rotateHandlePointX = unRotatedFeatureExtent[0] + (unRotatedFeatureExtent[2] - unRotatedFeatureExtent[0]) / 2,
                selectPolygonCoordinates = [
                    [ unRotatedFeatureExtent[0], unRotatedFeatureExtent[1] ],
                    [ unRotatedFeatureExtent[0], unRotatedFeatureExtent[3] ],
                    [ rotateHandlePointX, unRotatedFeatureExtent[3] ]]; // Include Rotate coord whether or the rotate handle is required

            if(includeRotateHandleCoordinates) {
                selectPolygonCoordinates = selectPolygonCoordinates.concat(
                    [[ rotateHandlePointX, unRotatedFeatureExtent[3] + 30 * this.map_.getView().getResolution() ]]); // Rotate Hook Handle
            } else {
                // If rotate handle is not required, add a flat coordinate in line to accommodate functionality that uses these coordinates, e.g. Six Reisze Handles
                selectPolygonCoordinates = selectPolygonCoordinates.concat([[ rotateHandlePointX, unRotatedFeatureExtent[3] ]]);
            }

            selectPolygonCoordinates = [selectPolygonCoordinates.concat(
                [
                    [ rotateHandlePointX, unRotatedFeatureExtent[3] ], // Include Rotate coord whether or the rotate handle is required
                    [ unRotatedFeatureExtent[2], unRotatedFeatureExtent[3] ],
                    [ unRotatedFeatureExtent[2], unRotatedFeatureExtent[1] ]
                ] )];

            var resizePolygon = new ol.geom.Polygon(selectPolygonCoordinates, ol.geom.GeometryLayout.XY),
                resizeBoxFeature = new ol.Feature({geometry: resizePolygon});

            // Custom identificaiton attributes
            resizeBoxFeature.manipulationType = ol.ManipulationFeatureType.RESIZEBOX;
            resizeBoxFeature.manipulationWidth = unRotatedFeatureExtent[2] - unRotatedFeatureExtent[0];
            resizeBoxFeature.manipulationHeight = unRotatedFeatureExtent[3] - unRotatedFeatureExtent[1];
            resizeBoxFeature.manipulatingFeature_ = feature;
            feature.selectBoxRectangle_ = resizeBoxFeature;

            return resizeBoxFeature;
        };

        this.removeSelectBoxForFeature = function(feature) {
            var manipulationFeatureCollection = new ol.Collection();
            this.getSource().forEachFeature(function(manipulationFeature) {
                if (manipulationFeature.manipulationType === ol.ManipulationFeatureType.RESIZEBOX &&
                    manipulationFeature.manipulatingFeature_ === feature) {
                    this.push(manipulationFeature);
                }
            }, manipulationFeatureCollection);

            manipulationFeatureCollection.forEach(function(manipulationFeature) {
                this.getSource().removeFeature(manipulationFeature);
            }, this);

            manipulationFeatureCollection.dispose();
        };

        this.updateSelectBoxForFeature = function(feature) {
            this.removeSelectBoxForFeature(feature);
            this.displaySelectBoxForFeature(feature);
        };

        this.displaySelectBoxForFeature = function() {
            var selectBoxFeature = this.createSelectBoxFeature_(this.shape_, this.shape_.manipulationConfig.showRotateHandle);

            if(this.shape_.get('rotationCenter')) {
                this.rotateFeature_(selectBoxFeature, this.shape_.get('rotationCenter'), this.getAccumulativeRotationForFeature_(this.shape_));
            }

            this.getSource().addFeature(selectBoxFeature);
        };

        this.showOrHideBaseLayerManipulationHandles = function(map, mapBrowserEvent) {
            var self = this,
                baseLayer = this.manipulatableBaseLayer_;

            if(baseLayer) {
                // Adding overlay for baseLayerManipulation resize handles
                if( !baseLayer.resizeHandlesOverlay ) {
                    baseLayer.resizeHandlesOverlay = new ol.FeatureOverlay({
                        style: new ol.style.Style({
                            fill: new ol.style.Fill({
                                color: "white"
                            }),
                            stroke: new ol.style.Stroke({
                                color: "black",
                                width: 1
                            })
                        })
                    });

                    baseLayer.resizeHandlesOverlay.setMap(map);

                    // resize handles size
                    baseLayer.resizeHandlesSize = 10;

                    // BaseLayer BottomRight resize handle
                    baseLayer.bottomRightResizeHandle = new ol.Feature({geometry: new ol.geom.Polygon( [[]] )});
                    baseLayer.bottomRightResizeHandle.isHandleFeature = true;  // Indication that feature is a manipulation handle
                    baseLayer.bottomRightResizeHandle.handleType = ol.ManipulationFeatureType.BASEIMAGERESIZEHANDLE;
                    baseLayer.bottomRightResizeHandle.cursorStyle = "nwse-resize";
                    baseLayer.bottomRightResizeHandle.baseLayer = baseLayer;
                    baseLayer.bottomRightResizeHandle.extentCoordinateIndex = [2, 1];
                    baseLayer.bottomRightResizeHandle.referenceExtentCoordinateIndex = [0, 3];
                }


                if( baseLayer.currentExtent_ && baseLayer.resizeHandlesOverlay ) {
                    // Updating resize handle geometries
                    var x0 = baseLayer.currentExtent_[0],
                        y0 = baseLayer.currentExtent_[1],
                        x1 = baseLayer.currentExtent_[2],
                        y1 = baseLayer.currentExtent_[3],
                        size = baseLayer.resizeHandlesSize;

                    baseLayer.bottomRightResizeHandle.getGeometry().setCoordinates([[
                        [x1, y0], [x1 - size, y0], [x1, y0 + size], [x1, y0]
                    ]]);

                    // If pointer is on base image
                    if( ol.extent.containsCoordinate(baseLayer.currentExtent_, mapBrowserEvent.coordinate) ) {
                        if(!goog.array.contains(baseLayer.resizeHandlesOverlay.getFeatures().getArray(), baseLayer.bottomRightResizeHandle)) {
                            baseLayer.resizeHandlesOverlay.addFeature(baseLayer.bottomRightResizeHandle);
                        }
                    } else {
                        if(goog.array.contains(baseLayer.resizeHandlesOverlay.getFeatures().getArray(), baseLayer.bottomRightResizeHandle)) {
                            baseLayer.resizeHandlesOverlay.removeFeature(baseLayer.bottomRightResizeHandle);
                        }
                    }
                }

                // Keep updating the extent
                baseLayer.once("postcompose", function(evt) {
                    baseLayer.currentExtent_ = evt.frameState.viewState.projection.extent_;
                }, this);
            }
        };

        this.displayShapeSpecificHandlesForFeature = function() {
            if(this.shape_.getManipulationHandles) {
                var shapeHandleFeatures = this.shape_.getManipulationHandles();
                if(shapeHandleFeatures) {
                    this.handlesLayer.getSource().addFeatures(this.shape_.getManipulationHandles());
                }
            }
        }
    };
    goog.inherits(ol.layer.Manipulation, ol.layer.Vector);

    /**
     * Setting handles and manipulation layer styles
     * @param {Object} opt_options Optionally styles can be provided while instantiating the interaction
     */
    ol.layer.Manipulation.prototype.setStyles_ = function(opt_options) {
        this.rotateHandleSize_ = opt_options.rotateHandleSize_ || 4;
        this.rotateHandleStyle_ = opt_options.rotateHandleStyle || new ol.style.Style({
            image: new ol.style.Circle({
                radius: this.rotateHandleSize_,
                fill: new ol.style.Fill({
                    color: '#00ffff'
                }),
                stroke: new ol.style.Stroke({
                    color: '#000',
                    width: 2
                })
            })
        });

        this.resizeHandleSize_ = opt_options.scaleRectangleSize || 3;
        this.handlesStyle_ = opt_options.resizeHandleStyle || new ol.style.Style({
            image: new ol.style.Circle({
                radius: this.resizeHandleSize_,
                fill: new ol.style.Fill({
                    color: '#00f'
                }),
                stroke: new ol.style.Stroke({
                    color: '#fff',
                    width: 1
                })
            })
        });

        this.setStyle(new ol.style.Style({
            fill: new ol.style.Fill({color: 'transparent'}),
            stroke: new ol.style.Stroke({
                color: '#0000FF',
                width: 0.5,
                lineDash: [4, 4]
            })
        }));
    };

    return ol.layer.Manipulation;
});