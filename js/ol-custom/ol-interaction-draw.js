/**
 * Definition of ol.interaction.DrawWithShapes
 * Script to extend and override ol.interaction.Draw to incorporate drawing of custom shapes like Arrow, Star etc.
 */

goog.provide('ol.interaction.DrawModeWithShapes');
goog.provide('ol.interaction.ShapeType');

goog.require('ol.DrawEvent');
goog.require('ol.interaction.Draw');
goog.require('goog.math.angle');

/**
 * Draw mode with shpes. This collapses multi-part geometry types with their single-part
 * cousins.
 * @enum {string}
 */
ol.interaction.ShapeType = {
    ARROW: 'Arrow',
    LINEARROW: 'LineArrow'
};

ol.interaction.ShapeManager = function(drawInteraction) {

    /**
     * Calculates the sketch of custom shape and returns coordinates of desired shape based on start and end drawing coordinates
     * @param  {Arry of ol.Coordinate} coordinates
     * @return {Array of Array of ol.Coordinate} the calculated coordinates of custom shape based on drawig pointer position
     */
    this.getSketchFeatureCoordinates = function(coordinates) {
        switch(drawInteraction.shapeType_) {
            case ol.interaction.ShapeType.ARROW:
                goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
                var startX = coordinates[0][0][0],
                    startY = coordinates[0][0][1],
                    endX = coordinates[0][coordinates[0].length-1][0],
                    endY = coordinates[0][coordinates[0].length-1][1],
                    dx = startX - endX,
                    dy = startY - endY,
                    distance = Math.sqrt(dx * dx + dy * dy) || 0;

                var m = (y2-y1)/(x2-x1)+1, dividerX = 1/Math.sqrt(1+(m*m)), dividerY = m/Math.sqrt(1+(m*m));

                var y3 = startY, y2 = startY - distance/3*dy/Math.abs(dy), y1 = endY,
                    x1 = startX - distance/3, x2 = startX - distance/6, x3 = startX, x4 = startX + distance/6, x5 = startX + distance/ 3;

                var shapePolygonCoordinates = [[
                    [x3, y3],
                    [x5, y2],
                    [x4, y2],
                    [x4, y1],
                    [x2, y1],
                    [x2, y2],
                    [x1, y2]
                ]];

                return shapePolygonCoordinates;
            break;

            case ol.interaction.ShapeType.LINEARROW:
                goog.asserts.assert(coordinates[0].length >= 2, "Not enough coordinates to draw ARROW shape");
                var startX = coordinates[0][0][0],
                    startY = coordinates[0][0][1],
                    endX = coordinates[0][coordinates[0].length-1][0],
                    endY = coordinates[0][coordinates[0].length-1][1],
                    mathEndPoint = new goog.math.Coordinate(endX, endY),
                    dx = startX - endX,
                    dy = startY - endY,
                    distance = Math.sqrt(dx * dx + dy * dy) || 0,
                    angleDegrees = goog.math.angle(startX, startY, endX, endY) - 90;

                var arrowTipCoords = [[endX - 10, endY - 10], [endX, endY], [endX + 10, endY - 10], [endX, endY]];

                arrowTipCoords = arrowTipCoords.map(function(coordinate) {
                    var mathCoordinate = new goog.math.Coordinate(coordinate[0], coordinate[1]);
                    mathCoordinate.rotateDegrees(angleDegrees, mathEndPoint);
                    return [mathCoordinate.x, mathCoordinate.y];
                });

                var shapePolygonCoordinates = [ [startX, startY], [endX, endY] ];

                shapePolygonCoordinates = [ shapePolygonCoordinates.concat(arrowTipCoords) ];

                return shapePolygonCoordinates;
            break;
        }
    }


    /**
     * Create and return the drawing pointer Point Geometry
     * @param {ol.MapBrowserEvent} event Event.
     * @private
     */
    this.getSketchPoint = function(coordinates) {
        switch(drawInteraction.shapeType_) {
            case ol.interaction.ShapeType.ARROW:
                return new ol.Feature(new ol.geom.Point(coordinates));
            break;

            case ol.interaction.ShapeType.LINEARROW:
                return new ol.Feature(new ol.geom.Point(coordinates));
            break;

            default:
                return null;
        }
    }
}

/**
 * @classdesc
 * Interaction that allows drawing geometries with provision of custom shapes.
 *
 * @constructor
 * @extends {ol.interaction.Draw}
 * @fires ol.DrawEvent
 * @param {olx.interaction.DrawOptions} options Options.
 * @api stable
 */
ol.interaction.DrawWithShapes = function(options) {
    options.type = options.type || "Polygon";

    goog.base(this, options);
    
    // Initially Deactivate
    this.setActive(false);

    this.downCoordinate_ = null;

    this.layerToDrawOn_ = null;

	/**
	 * Custom Shape type.
	 * @type {ol.geom.GeometryType}
	 * @private
	 */
	this.shapeType_ = options.shapeType;

    /**
     * Custom Shape Manager, to return definitions of drawings
     */
    this.shapeManager_ = new ol.interaction.ShapeManager(this);

    this.activateShapeDrawingOnLayer = function(shapeType, drawingLayer) {
        if(goog.isDef(ol.interaction.ShapeType[shapeType.toUpperCase()])) {
            this.shapeType_ = shapeType;
            if(this.shapeType_ == ol.interaction.ShapeType.LINEARROW) {
                this.type_ = "LineString";
            } else {
                this.type_ = "Polygon";
            }
        } else {
            this.shapeType_ = null;
            this.type_ = shapeType;
        }

        this.features_ = null;
        this.source_ = drawingLayer.getSource();
        this.layerToDrawOn_ = drawingLayer;

        this.setActive(true);
    }

    this.isDrawing_ = function() {
        return !goog.isNull(this.finishCoordinate_);
    }

    this.isWithinClickTolerance_ = function(currentEventPixel) {
        var downPx = this.downPx_,
            dx = downPx[0] - currentEventPixel[0],
            dy = downPx[1] - currentEventPixel[1],
            squaredDistance = dx * dx + dy * dy;
        
        return squaredDistance <= this.squaredClickTolerance_;
    }

    this.isPressDragReleaseDrawing_ = function() {
        return goog.isDefAndNotNull(this.shapeType_)
    }

    this.createNewSketchFeature_ = function() {
        return new ol.Feature();
    }

    this.addCreatedFeatureToDrawingLayer_ = function(createdFeature) {
        this.layerToDrawOn_.getSource().addFeature(createdFeature);
    }

    /**
     * @inheritDoc
     */
    this.handleMapBrowserEvent = function(event) {
      
        var map = event.map;
        if (!map.isDef()) {
        return true;
        }

        var pass = true;

        if(event.type === ol.MapBrowserEvent.EventType.POINTERDOWN) {
            pass = this.handlePointerDown(event);
        }

        if (this.isPressDragReleaseDrawing_()) {
        
            if(event.type === ol.MapBrowserEvent.EventType.POINTERDRAG) {
                if(goog.isNull(this.sketchFeature_) && !this.isWithinClickTolerance_(event.pixel)) {
                    // Start Drawing
                    this.sketchFeature_ = this.createNewSketchFeature_();
                    this.finishCoordinate_ = event.coordinate;
                    var sketchFeatureGeometry = new ol.geom.Polygon(this.shapeManager_.getSketchFeatureCoordinates([[this.downCoordinate_, this.finishCoordinate_]]));
                    this.sketchFeature_.setGeometry(sketchFeatureGeometry);

                    this.dispatchEvent(new ol.DrawEvent(ol.DrawEventType.DRAWSTART, this.sketchFeature_));
                }

                if(!goog.isNull(this.sketchFeature_)) {
                    this.finishCoordinate_ = event.coordinate;
                    var sketchFeatureCoordinates = this.shapeManager_.getSketchFeatureCoordinates([[this.downCoordinate_, this.finishCoordinate_]]);
                    this.sketchFeature_.getGeometry().setCoordinates(sketchFeatureCoordinates);
                    
                    this.createOrUpdateSketchPoint_(event);
                    this.updateSketchFeatures_();
                    pass = false;
                }
            }
            
            if(event.type === ol.MapBrowserEvent.EventType.POINTERUP) {
                // Finish Drawing
                var sketchFeature = this.abortDrawing_();
                if(!goog.isNull(sketchFeature)) {
                    this.addCreatedFeatureToDrawingLayer_(sketchFeature);
                    
                    this.dispatchEvent(new ol.DrawEvent(ol.DrawEventType.DRAWEND, sketchFeature));

                    pass = false;
                } else {
                    // Deactivate the interaction when a down-up events are performed without a drag
                    this.setActive(false);
                    pass = true;
                }
            }
        
        } else if(!goog.isNull(this.type_)) {
            // For click-double click drawings
            if (event.type === ol.MapBrowserEvent.EventType.POINTERMOVE) {
                pass = this.handlePointerMove_(event);
            } else if (event.type === ol.MapBrowserEvent.EventType.DBLCLICK) {
                pass = false;
            }
            return (goog.base(this, 'handleMapBrowserEvent', event) && pass && !this.isDrawing_());
        }

    };

    /**
     * Handle down events.
     * @param {ol.MapBrowserEvent} event A down event.
     * @return {boolean} Pass the event to other interactions.
     */
    this.handlePointerDown = function(event) {
      if (this.condition_(event)) {
        this.downPx_ = event.pixel;
        this.downCoordinate_ = event.coordinate;
        return true;
      } else {
        return false;
      }
    };


    /**
     * Handle move events.
     * @param {ol.MapBrowserEvent} event A move event.
     * @return {boolean} Pass the event to other interactions.
     * @private
     */
    this.handlePointerMove_ = function(event) {
      if (this.mode_ === ol.interaction.DrawMode.POINT &&
          goog.isNull(this.finishCoordinate_)) {
        this.startDrawing_(event);
      } else if (!goog.isNull(this.finishCoordinate_)) {
        this.modifyDrawing_(event);
      } else {
        this.createOrUpdateSketchPoint_(event);
      }
      return true;
    };


    /**
     * @inheritDoc
     */
    this.handlePointerUp = function(event) {
        var pass = true,
            isWithinClickTolerance = this.isWithinClickTolerance_(event.pixel),
            isPressDragReleaseDrawing = this.isPressDragReleaseDrawing_();

        // If there is significant drag (as determined by squaredClickTolerance), process for press-drag-release
        if(!isWithinClickTolerance && isPressDragReleaseDrawing) {
            if(!goog.isNull(this.finishCoordinate_)) {
                this.finishDrawing_(event);
                pass = false;
            }
        } else if(isWithinClickTolerance && !isPressDragReleaseDrawing) {
            this.handlePointerMove_(event);
            if (goog.isNull(this.finishCoordinate_)) {
                this.startDrawing_(event);
            } else if (this.mode_ === ol.interaction.DrawMode.POINT ||
                this.atFinish_(event)) {
                this.finishDrawing_(event);
            } else {
                this.addToDrawing_(event);
            }
            pass = false;
        }
        return pass;
    };


    /**
     * Accounts for custom shape pointer
     * @inheritDoc
     */
    this.createOrUpdateSketchPoint_ = function(event) {
      var coordinates = event.coordinate.slice();
      if (goog.isNull(this.sketchPoint_)) {
        this.sketchPoint_ = this.shapeType_ && this.shapeManager_.getSketchPoint(coordinates) || new ol.Feature(new ol.geom.Point(coordinates));

        // Taggign Sketch Point Feature for Manipulate Interaction
        //this.sketchPoint_.isDrawingFeature = true;

        this.updateSketchFeatures_();
      } else {
        var sketchPointGeom = this.sketchPoint_.getGeometry();
        goog.asserts.assertInstanceof(sketchPointGeom, ol.geom.Point);
        sketchPointGeom.setCoordinates(coordinates);
      }
    };


    /**
     * @inheritDoc
     */
    this.getMode_ = function(type) {
        var mode;
        if (type === ol.geom.GeometryType.POINT ||
            type === ol.geom.GeometryType.MULTI_POINT) {
            mode = ol.interaction.DrawMode.POINT;
        } else if (type === ol.geom.GeometryType.LINE_STRING ||
            type === ol.geom.GeometryType.MULTI_LINE_STRING) {
            mode = ol.interaction.DrawMode.LINE_STRING;
        } else if (type === ol.geom.GeometryType.POLYGON ||
            type === ol.geom.GeometryType.MULTI_POLYGON) {
            mode = ol.interaction.DrawMode.POLYGON;
        }
        goog.asserts.assert(goog.isDef(mode), "ol-custom/ol-interaction.draw.js #57");
        return mode;
    };

    /**
     * @inheritDoc
     */
    this.atFinish_ = function(event) {
        var at = false;
        if (!goog.isNull(this.sketchFeature_)) {
            var geometry = this.sketchFeature_.getGeometry();
            var potentiallyDone = false;
            var potentiallyFinishCoordinates = [this.finishCoordinate_];
            if (goog.isDef(this.shapeType_) && !goog.isNull(this.shapeType_)) {
                goog.asserts.assertInstanceof(geometry, ol.geom.Polygon);
                potentiallyDone = true;
                potentiallyFinishCoordinates = this.shapeManager_.getSketchFeatureCoordinates(this.sketchPolygonCoords_);
            } else if (this.mode_ === ol.interaction.DrawMode.LINE_STRING) {
                goog.asserts.assertInstanceof(geometry, ol.geom.LineString);
                potentiallyDone = geometry.getCoordinates().length > 2;
            } else if (this.mode_ === ol.interaction.DrawMode.POLYGON) {
                goog.asserts.assertInstanceof(geometry, ol.geom.Polygon);
                potentiallyDone = geometry.getCoordinates()[0].length >
                    this.minPointsPerRing_;
                potentiallyFinishCoordinates = [this.sketchPolygonCoords_[0][0],
                    this.sketchPolygonCoords_[0][this.sketchPolygonCoords_[0].length - 2]];
            }
            if (potentiallyDone) {
                var map = event.map;
                for (var i = 0, ii = potentiallyFinishCoordinates.length; i < ii; i++) {
                    var finishCoordinate = potentiallyFinishCoordinates[i];
                    var finishPixel = map.getPixelFromCoordinate(finishCoordinate);
                    var pixel = event.pixel;
                    var dx = pixel[0] - finishPixel[0];
                    var dy = pixel[1] - finishPixel[1];
                    at = Math.sqrt(dx * dx + dy * dy) <= this.snapTolerance_;
                    if (at) {
                        this.finishCoordinate_ = finishCoordinate;
                        break;
                    }
                }
            }
        }
        return at;
    };

    /**
     * @inheritDoc
     */
    this.startDrawing_ = function(event) {
        var start = event.coordinate;
        this.finishCoordinate_ = start;
        var geometry;
        if (this.mode_ === ol.interaction.DrawMode.POINT) {
            geometry = new ol.geom.Point(start.slice());
        } else {
        	if (goog.isDef(this.shapeType_) && !goog.isNull(this.shapeType_)) {
                this.sketchLine_ = new ol.Feature(new ol.geom.LineString([start.slice(),
                    start.slice()]));
                this.sketchPolygonCoords_ = [[start.slice(), start.slice()]];
                this.sketchPolygonCoords_ = this.shapeManager_.getSketchFeatureCoordinates(this.sketchPolygonCoords_);
                geometry = new ol.geom.Polygon(this.sketchPolygonCoords_);
            } else if (this.mode_ === ol.interaction.DrawMode.LINE_STRING) {
                geometry = new ol.geom.LineString([start.slice(), start.slice()]);
            } else if (this.mode_ === ol.interaction.DrawMode.POLYGON) {
                this.sketchLine_ = new ol.Feature(new ol.geom.LineString([start.slice(),
                    start.slice()]));
                this.sketchPolygonCoords_ = [[start.slice(), start.slice()]];
                geometry = new ol.geom.Polygon(this.sketchPolygonCoords_);
            }
        }
        goog.asserts.assert(goog.isDef(geometry));
        this.sketchFeature_ = new ol.Feature();
        if (goog.isDef(this.geometryName_)) {
            this.sketchFeature_.setGeometryName(this.geometryName_);
        }
        this.sketchFeature_.setGeometry(geometry);
        this.updateSketchFeatures_();
        this.dispatchEvent(new ol.DrawEvent(ol.DrawEventType.DRAWSTART,
            this.sketchFeature_));
    };

    /**
     * @inheritDoc
     */
    this.modifyDrawing_ = function(event) {
        var coordinate = event.coordinate;
        var geometry = this.sketchFeature_.getGeometry();
        var coordinates, last;
        if (this.mode_ === ol.interaction.DrawMode.POINT) {
            goog.asserts.assertInstanceof(geometry, ol.geom.Point);
            last = geometry.getCoordinates();
            last[0] = coordinate[0];
            last[1] = coordinate[1];
            geometry.setCoordinates(last);
        } else {
        	if (goog.isDef(this.shapeType_) && !goog.isNull(this.shapeType_)) {
                goog.asserts.assertInstanceof(geometry, ol.geom.Polygon, "ol-custom/ol-interaction.draw.js #148");
                coordinates = [this.sketchPolygonCoords_[0][0], coordinate];
                console.log("modifyDrawing_", coordinates);
                this.sketchPolygonCoords_ = this.shapeManager_.getSketchFeatureCoordinates([coordinates]);
            } else if (this.mode_ === ol.interaction.DrawMode.LINE_STRING) {
                goog.asserts.assertInstanceof(geometry, ol.geom.LineString, "ol-custom/ol-interaction.draw.js #149");
                coordinates = geometry.getCoordinates();
            } else if (this.mode_ === ol.interaction.DrawMode.POLYGON) {
                goog.asserts.assertInstanceof(geometry, ol.geom.Polygon, "ol-custom/ol-interaction.draw.js #155");
                coordinates = this.sketchPolygonCoords_[0];
            }
            
            if (this.atFinish_(event)) {
                // snap to finish
                coordinate = this.finishCoordinate_.slice();
            }
            var sketchPointGeom = this.sketchPoint_.getGeometry();
            goog.asserts.assertInstanceof(sketchPointGeom, ol.geom.Point, "ol-custom/ol-interaction.draw.js #163");
            sketchPointGeom.setCoordinates(coordinate);
            last = coordinates[coordinates.length - 1];
            last[0] = coordinate[0];
            last[1] = coordinate[1];
            if (this.mode_ === ol.interaction.DrawMode.LINE_STRING) {
                goog.asserts.assertInstanceof(geometry, ol.geom.LineString, "ol-custom/ol-interaction.draw.js #169");
                geometry.setCoordinates(coordinates);
            } else if (this.mode_ === ol.interaction.DrawMode.POLYGON) {
                var sketchLineGeom = this.sketchLine_.getGeometry();
                goog.asserts.assertInstanceof(sketchLineGeom, ol.geom.LineString, "ol-custom/ol-interaction.draw.js #173");
                sketchLineGeom.setCoordinates(coordinates);
                goog.asserts.assertInstanceof(geometry, ol.geom.Polygon, "ol-custom/ol-interaction.draw.js #175");
                geometry.setCoordinates(this.sketchPolygonCoords_);
            }
        }
        this.updateSketchFeatures_();
    };

    /**
     * @inheritDoc
     */
    this.addToDrawing_ = function(event) {
        var coordinate = event.coordinate;
        var geometry = this.sketchFeature_.getGeometry();
        var coordinates;
        if (goog.isDef(this.shapeType_) && !goog.isNull(this.shapeType_)) {
            this.sketchPolygonCoords_[0].push(coordinate.slice());
            goog.asserts.assertInstanceof(geometry, ol.geom.Polygon);
            geometry.setCoordinates(this.sketchPolygonCoords_);
            this.sketchPolygonCoords_ = this.shapeManager_.getSketchFeatureCoordinates(this.sketchPolygonCoords_);
        } else if (this.mode_ === ol.interaction.DrawMode.LINE_STRING) {
            this.finishCoordinate_ = coordinate.slice();
            goog.asserts.assertInstanceof(geometry, ol.geom.LineString);
            coordinates = geometry.getCoordinates();
            coordinates.push(coordinate.slice());
            geometry.setCoordinates(coordinates);
        } else if (this.mode_ === ol.interaction.DrawMode.POLYGON) {
            this.sketchPolygonCoords_[0].push(coordinate.slice());
            goog.asserts.assertInstanceof(geometry, ol.geom.Polygon);
            geometry.setCoordinates(this.sketchPolygonCoords_);
        }
        this.updateSketchFeatures_();
    };

    /**
     * Stop drawing and add the sketch feature to the target layer.
     * @param {ol.MapBrowserEvent} event Event.
     * @private
     */
    this.finishDrawing_ = function(event) {
        var sketchFeature = this.abortDrawing_();
        goog.asserts.assert(!goog.isNull(sketchFeature));
        var coordinates;
        var geometry = sketchFeature.getGeometry();
        if (this.mode_ === ol.interaction.DrawMode.POINT) {
            goog.asserts.assertInstanceof(geometry, ol.geom.Point);
            coordinates = geometry.getCoordinates();
        } else if(goog.isDef(this.shapeType_) && !goog.isNull(this.shapeType_)) {
            goog.asserts.assertInstanceof(geometry, ol.geom.Polygon);
            // When we finish drawing a polygon on the last point,
            // the last coordinate is duplicated as for LineString
            // we force the replacement by the first point
            //this.sketchPolygonCoords_[0].pop();
            //this.sketchPolygonCoords_[0].push(this.sketchPolygonCoords_[0][0]);
            this.sketchPolygonCoords_ = this.shapeManager_.getSketchFeatureCoordinates(this.sketchPolygonCoords_);
            //geometry.setCoordinates(this.sketchPolygonCoords_);
            coordinates = geometry.getCoordinates();
            sketchFeature.setGeometry(geometry);
        } else if (this.mode_ === ol.interaction.DrawMode.LINE_STRING) {
            goog.asserts.assertInstanceof(geometry, ol.geom.LineString);
            coordinates = geometry.getCoordinates();
            // remove the redundant last point
            coordinates.pop();
            geometry.setCoordinates(coordinates);
        } else if (this.mode_ === ol.interaction.DrawMode.POLYGON) {
            goog.asserts.assertInstanceof(geometry, ol.geom.Polygon);
            // When we finish drawing a polygon on the last point,
            // the last coordinate is duplicated as for LineString
            // we force the replacement by the first point
            this.sketchPolygonCoords_[0].pop();
            this.sketchPolygonCoords_[0].push(this.sketchPolygonCoords_[0][0]);
            geometry.setCoordinates(this.sketchPolygonCoords_);
            coordinates = geometry.getCoordinates();
        }

        // cast multi-part geometries
        if (this.type_ === ol.geom.GeometryType.MULTI_POINT) {
            sketchFeature.setGeometry(new ol.geom.MultiPoint([coordinates]));
        } else if (this.type_ === ol.geom.GeometryType.MULTI_LINE_STRING) {
            sketchFeature.setGeometry(new ol.geom.MultiLineString([coordinates]));
        } else if (this.type_ === ol.geom.GeometryType.MULTI_POLYGON) {
            sketchFeature.setGeometry(new ol.geom.MultiPolygon([coordinates]));
        }

        if (!goog.isNull(this.features_)) {
            this.features_.push(sketchFeature);
        }
        if (!goog.isNull(this.source_)) {
            this.source_.addFeature(sketchFeature);
        }
        this.dispatchEvent(new ol.DrawEvent(ol.DrawEventType.DRAWEND, sketchFeature));
    };
};
goog.inherits(ol.interaction.DrawWithShapes, ol.interaction.Draw);