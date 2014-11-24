/**
 * Definition of ol.interaction.DrawWithShapes
 * Script to extend and override ol.interaction.Draw to incorporate drawing of custom shapes like Arrow, Star etc.
 */

goog.provide('ol.interaction.DrawModeWithShapes');
goog.provide('ol.interaction.ShapeType');

goog.require('ol.DrawEvent');
goog.require('ol.interaction.Draw');

/**
 * Draw mode with shpes. This collapses multi-part geometry types with their single-part
 * cousins.
 * @enum {string}
 */
ol.interaction.ShapeType = {
    ARROW: 'Arrow'
};



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
    goog.base(this, options);
    
	/**
	 * Custom Shape type.
	 * @type {ol.geom.GeometryType}
	 * @private
	 */
	this.shapeType_ = options.shapeType;

	/**
	 *
	 */
	this.getSketchFeature_ = function(shapeType, coordinates) {
        if(this.testAngle==undefined)this.testAngle = 0;
        else this.testAngle++;
        console.log("test angle: ", this.testAngle );
		switch(shapeType) {
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

                var y3 = startY, y2 = startY - distance/3, y1 = endY,
                    x1 = startX - distance/3, x2 = startX - distance/6, x3 = startX, x4 = startX + distance/6, x5 = startX + distance/ 3;

                /*var rightOuterTip = [x1+distance/2*dividerX, y1+distance/2*dividerY],
                    rightInnerTip = [rightOuterTip[0] - distance/6*Math.cos(0), rightOuterTip[1] - distance/6*Math.sin(0)],
                    rightBottomTip = [rightInnerTip[0] - distance/6*Math.cos(269), rightInnerTip[1] - distance/6*Math.sin(269)];*/
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
		}
	}

    /**
     *@inheritDoc
     */
    this.handlePointerUp = function(event) {
        var downPx = this.downPx_;
        var clickPx = event.pixel;
        var dx = downPx[0] - clickPx[0];
        var dy = downPx[1] - clickPx[1];
        var squaredDistance = dx * dx + dy * dy;
        var pass = true;
        if (squaredDistance <= this.squaredClickTolerance_) {
            this.handlePointerMove_(event);
            if (goog.isNull(this.finishCoordinate_)) {
                this.startDrawing_(event);
            } else if (this.mode_ === ol.interaction.DrawMode.POINT ||
                this.atFinish_(event)) {
                this.finishDrawing_(event);
            } else if (this.shapeType_ != undefined && this.sketchPolygonCoords_[0].length > 2) {
                this.finishDrawing_(event);
            } else {
                this.addToDrawing_(event);
            }
            pass = false;
        }
        return pass;
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
            if (this.shapeType_ === ol.interaction.ShapeType.ARROW) {
                goog.asserts.assertInstanceof(geometry, ol.geom.Polygon);
                potentiallyDone = this.sketchPolygonCoords_[0].length > 2;
                potentiallyFinishCoordinates = this.getSketchFeature_(ol.interaction.ShapeType.ARROW, this.sketchPolygonCoords_);
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
        	if (this.shapeType_ === ol.interaction.ShapeType.ARROW) {
                this.sketchLine_ = new ol.Feature(new ol.geom.LineString([start.slice(),
                    start.slice()]));
                this.sketchPolygonCoords_ = [[start.slice(), start.slice()]];
                this.sketchPolygonCoords_ = this.getSketchFeature_(ol.interaction.ShapeType.ARROW, this.sketchPolygonCoords_);
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
        	if (this.shapeType_ === ol.interaction.ShapeType.ARROW) {
                goog.asserts.assertInstanceof(geometry, ol.geom.Polygon, "ol-custom/ol-interaction.draw.js #148");
                coordinates = [this.sketchPolygonCoords_[0][0], coordinate];
                this.sketchPolygonCoords_ = this.getSketchFeature_(ol.interaction.ShapeType.ARROW, [coordinates]);
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
        if (this.shapeType_ === ol.interaction.ShapeType.ARROW) {
            this.sketchPolygonCoords_[0].push(coordinate.slice());
            goog.asserts.assertInstanceof(geometry, ol.geom.Polygon);
            geometry.setCoordinates(this.sketchPolygonCoords_);
            this.sketchPolygonCoords_ = this.getSketchFeature_(ol.interaction.ShapeType.ARROW, this.sketchPolygonCoords_);
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
        } else if (this.shapeType_ === ol.interaction.ShapeType.ARROW) {
            goog.asserts.assertInstanceof(geometry, ol.geom.Polygon);
            // When we finish drawing a polygon on the last point,
            // the last coordinate is duplicated as for LineString
            // we force the replacement by the first point
            //this.sketchPolygonCoords_[0].pop();
            //this.sketchPolygonCoords_[0].push(this.sketchPolygonCoords_[0][0]);
            this.sketchPolygonCoords_ = this.getSketchFeature_(ol.interaction.ShapeType.ARROW, this.sketchPolygonCoords_);
            geometry.setCoordinates(this.sketchPolygonCoords_);
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