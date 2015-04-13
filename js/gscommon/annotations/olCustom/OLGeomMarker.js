define([
    "dojo/_base/lang",
    "dojo/_base/array"
], function (lang, array) {
    /**
     * Implementation of geometries needed for drawing (ol.interaction.Draw) functionality
     * Provides geometries compatible with routines used to get/set coordinates inside ol.interaction.draw
     */


    goog.require('ol.geom.GeometryType');
    goog.provide('ol.geom.Marker');


// Meeting the formalities for a new geometry to be drawable by vector context
// 1 - Registering Oval Geometry Type
    ol.geom.GeometryType.MARKER = 'Marker';

// 2
    ol.render.IVectorContext.prototype.drawMarkerGeometry =
        function(markerGeometry, data) {
        };

// 3
    ol.render.canvas.Immediate.prototype.drawMarkerGeometry =
        function(markerGeometry, data) {
            if (!ol.extent.intersects(this.extent_, markerGeometry.getExtent())) {
                return;
            }
            if (!goog.isNull(this.fillState_) || !goog.isNull(this.strokeState_)) {
                if (!goog.isNull(this.fillState_)) {
                    this.setContextFillState_(this.fillState_);
                }
                if (!goog.isNull(this.strokeState_)) {
                    this.setContextStrokeState_(this.strokeState_);
                }
                var pixelCoordinates = ol.geom.transformSimpleGeometry2D(
                    markerGeometry, this.transform_, this.pixelCoordinates_);
                var dx = pixelCoordinates[2] - pixelCoordinates[0];
                var dy = pixelCoordinates[3] - pixelCoordinates[1];
                var radius = Math.sqrt(dx * dx + dy * dy);
                var context = this.context_;
                context.beginPath();
                context.arc(
                    pixelCoordinates[0], pixelCoordinates[1], radius, 0, 2 * Math.PI);
                if (!goog.isNull(this.fillState_)) {
                    context.fill();
                }
                if (!goog.isNull(this.strokeState_)) {
                    context.stroke();
                }
            }
            if (this.text_ !== '') {
                this.drawText_(markerGeometry.getCenter(), 0, 2, 2);
            }
        };

// 4
    ol.render.canvas.Immediate.GEOMETRY_RENDERERS_['Marker'] = ol.render.canvas.Immediate.prototype.drawMarkerGeometry;

// 5
    ol.render.canvas.Instruction['MARKER'] = 14;

// 6 Rewrite/Override of ol.render.canvas.Replay.prototype.replay_ to include the newly added instruction
//   Overriden at the end of the file as is likely be overriden for other geometries too

// 7
    ol.render.canvas.Replay.prototype.drawMarkerGeometry = goog.abstractMethod;

// 8
    ol.render.canvas.PolygonReplay.prototype.drawMarkerGeometry =
        function(markerGeometry, data) {
            var state = this.state_;
            goog.asserts.assert(!goog.isNull(state));
            var fillStyle = state.fillStyle;
            var strokeStyle = state.strokeStyle;
            if (!goog.isDef(fillStyle) && !goog.isDef(strokeStyle)) {
                return;
            }
            if (goog.isDef(strokeStyle)) {
                goog.asserts.assert(goog.isDef(state.lineWidth));
            }
            ol.extent.extend(this.extent_, markerGeometry.getExtent());
            this.setFillStrokeStyles_();
            this.beginGeometry(markerGeometry, data);
            // always fill the circle for hit detection
            this.hitDetectionInstructions.push(
                [ol.render.canvas.Instruction.SET_FILL_STYLE,
                    ol.color.asString(ol.render.canvas.defaultFillStyle)]);
            if (goog.isDef(state.strokeStyle)) {
                this.hitDetectionInstructions.push(
                    [ol.render.canvas.Instruction.SET_STROKE_STYLE,
                        state.strokeStyle, state.lineWidth, state.lineCap, state.lineJoin,
                        state.miterLimit, state.lineDash]);
            }
            var flatCoordinates = markerGeometry.getFlatCoordinates();
            var stride = markerGeometry.getStride();
            var myBegin = this.coordinates.length;
            this.appendFlatCoordinates(
                flatCoordinates, 0, flatCoordinates.length, stride, false);
            var beginPathInstruction = [ol.render.canvas.Instruction.BEGIN_PATH];
            var markerInstruction = [ol.render.canvas.Instruction.MARKER, myBegin];
            this.instructions.push(beginPathInstruction, markerInstruction);
            this.hitDetectionInstructions.push(beginPathInstruction, markerInstruction);
            var fillInstruction = [ol.render.canvas.Instruction.FILL];
            this.hitDetectionInstructions.push(fillInstruction);
            if (goog.isDef(state.fillStyle)) {
                this.instructions.push(fillInstruction);
            }
            if (goog.isDef(state.strokeStyle)) {
                goog.asserts.assert(goog.isDef(state.lineWidth));
                var strokeInstruction = [ol.render.canvas.Instruction.STROKE];
                this.instructions.push(strokeInstruction);
                this.hitDetectionInstructions.push(strokeInstruction);
            }
            this.endGeometry(markerGeometry, data);
        };

// 9
    /**
     * @param {ol.render.IReplayGroup} replayGroup Replay group.
     * @param {ol.geom.Geometry} geometry Geometry.
     * @param {ol.style.Style} style Style.
     * @param {Object} data Opaque data object.
     * @private
     */
    ol.renderer.vector.renderMarkerGeometry_ =
        function(replayGroup, geometry, style, data) {
            goog.asserts.assertInstanceof(geometry, ol.geom.Marker);
            var fillStyle = style.getFill();
            var strokeStyle = style.getStroke();
            if (!goog.isNull(fillStyle) || !goog.isNull(strokeStyle)) {
                var polygonReplay = replayGroup.getReplay(
                    style.getZIndex(), ol.render.ReplayType.POLYGON);
                polygonReplay.setFillStrokeStyle(fillStyle, strokeStyle);
                polygonReplay.drawMarkerGeometry(geometry, data);
            }
            var textStyle = style.getText();
            if (!goog.isNull(textStyle)) {
                var textReplay = replayGroup.getReplay(
                    style.getZIndex(), ol.render.ReplayType.TEXT);
                textReplay.setTextStyle(textStyle);
                textReplay.drawText(geometry.getCenter(), 0, 2, 2, geometry, data);
            }
        };


// 10
    ol.renderer.vector.GEOMETRY_RENDERERS_['Marker'] = ol.renderer.vector.renderMarkerGeometry_;


// 11 ol.geom.Marker
    ol.geom.Marker = function(center, opt_radius, opt_layout) {
        center = goog.isArray(center) && center.length > 1 ? center : [0, 0];
        goog.base(this, center, opt_radius, opt_layout);
        var radius = goog.isDef(opt_radius) ? opt_radius : 10;

        this.setCenterAndRadius(center, radius,
            /** @type {ol.geom.GeometryLayout|undefined} */ (opt_layout));

        // Manipulation Configuration, describes if geom has custom manipulation logic
        this.manipulationConfig = {};
        this.manipulationConfig.handlesResize = false;
        this.manipulationConfig.handlesRotation = false;
        this.manipulationConfig.handlesTranslation = true;
    };
    goog.inherits(ol.geom.Marker, ol.geom.SimpleGeometry);


    /**
     * Make a complete copy of the geometry.
     * @return {!ol.geom.Circle} Clone.
     * @api
     */
    ol.geom.Marker.prototype.clone = function() {
        var marker = new ol.geom.Marker([this.getCenter(), this.getRadius()]);
        marker.setFlatCoordinates(this.layout, this.flatCoordinates.slice());
        return marker;
    };


    /**
     * @inheritDoc
     */
    ol.geom.Marker.prototype.closestPointXY =
        function(x, y, closestPoint, minSquaredDistance) {
            var flatCoordinates = this.flatCoordinates;
            var dx = x - flatCoordinates[0];
            var dy = y - flatCoordinates[1];
            var squaredDistance = dx * dx + dy * dy;
            if (squaredDistance < minSquaredDistance) {
                var i;
                if (squaredDistance === 0) {
                    for (i = 0; i < this.stride; ++i) {
                        closestPoint[i] = flatCoordinates[i];
                    }
                } else {
                    var delta = this.getRadius() / Math.sqrt(squaredDistance);
                    closestPoint[0] = flatCoordinates[0] + delta * dx;
                    closestPoint[1] = flatCoordinates[1] + delta * dy;
                    for (i = 2; i < this.stride; ++i) {
                        closestPoint[i] = flatCoordinates[i];
                    }
                }
                closestPoint.length = this.stride;
                return squaredDistance;
            } else {
                return minSquaredDistance;
            }
        };


    /**
     * @inheritDoc
     */
    ol.geom.Marker.prototype.containsXY = function(x, y) {
        var flatCoordinates = this.flatCoordinates;
        var dx = x - flatCoordinates[0];
        var dy = y - flatCoordinates[1];
        return dx * dx + dy * dy <= this.getRadiusSquared_();
    };


    /**
     * @return {ol.Coordinate} Center.
     * @api
     */
    ol.geom.Marker.prototype.getCenter = function() {
        return this.flatCoordinates.slice(0, this.stride);
    };


    /**
     * @inheritDoc
     * @api
     */
    ol.geom.Marker.prototype.getExtent = function(opt_extent) {
        if (this.extentRevision != this.getRevision()) {
            var flatCoordinates = this.flatCoordinates;
            var radius = flatCoordinates[this.stride] - flatCoordinates[0];
            this.extent = ol.extent.createOrUpdate(
                    flatCoordinates[0] - radius, flatCoordinates[1] - radius,
                    flatCoordinates[0] + radius, flatCoordinates[1] + radius,
                this.extent);
            this.extentRevision = this.getRevision();
        }
        goog.asserts.assert(goog.isDef(this.extent));
        return ol.extent.returnOrUpdate(this.extent, opt_extent);
    };


    /**
     * @return {number} Radius.
     * @api
     */
    ol.geom.Marker.prototype.getRadius = function() {
        return Math.sqrt(this.getRadiusSquared_());
    };


    /**
     * @private
     * @return {number} Radius squared.
     */
    ol.geom.Marker.prototype.getRadiusSquared_ = function() {
        var dx = this.flatCoordinates[this.stride] - this.flatCoordinates[0];
        var dy = this.flatCoordinates[this.stride + 1] - this.flatCoordinates[1];
        return dx * dx + dy * dy;
    };


    /**
     * @inheritDoc
     * @api
     */
    ol.geom.Marker.prototype.getType = function() {
        return ol.geom.GeometryType.MARKER;
    };

    ol.geom.Marker.prototype.translate = function(differenceCoordinate) {
        var currentCenter = this.getCenter();
        this.setCenter([ currentCenter[0]+differenceCoordinate[0], currentCenter[1]+differenceCoordinate[1] ]);
    };

    /**
     * @param {ol.Coordinate} center Center.
     * @api
     */
    ol.geom.Marker.prototype.setCenter = function(center) {
        var stride = this.stride;
        goog.asserts.assert(center.length == stride);
        var radius = this.flatCoordinates[stride] - this.flatCoordinates[0];
        var flatCoordinates = center.slice();
        flatCoordinates[stride] = flatCoordinates[0] + radius;
        var i;
        for (i = 1; i < stride; ++i) {
            flatCoordinates[stride + i] = center[i];
        }
        this.setFlatCoordinates(this.layout, flatCoordinates);
    };

    /**
     * @param {ol.Coordinate} center Center.
     * @param {number} radius Radius.
     * @param {ol.geom.GeometryLayout=} opt_layout Layout.
     * @api
     */
    ol.geom.Marker.prototype.setCenterAndRadius =
        function(center, radius, opt_layout) {
            if (goog.isNull(center)) {
                this.setFlatCoordinates(ol.geom.GeometryLayout.XY, null);
            } else {
                this.setLayout(opt_layout, center, 0);
                if (goog.isNull(this.flatCoordinates)) {
                    this.flatCoordinates = [];
                }
                /** @type {Array.<number>} */
                var flatCoordinates = this.flatCoordinates;
                var offset = ol.geom.flat.deflate.coordinate(
                    flatCoordinates, 0, center, this.stride);
                flatCoordinates[offset++] = flatCoordinates[0] + radius;
                var i, ii;
                for (i = 1, ii = this.stride; i < ii; ++i) {
                    flatCoordinates[offset++] = flatCoordinates[i];
                }
                flatCoordinates.length = offset;
                this.changed();
            }
        };


    /**
     * @param {ol.geom.GeometryLayout} layout Layout.
     * @param {Array.<number>} flatCoordinates Flat coordinates.
     */
    ol.geom.Marker.prototype.setFlatCoordinates =
        function(layout, flatCoordinates) {
            this.setFlatCoordinatesInternal(layout, flatCoordinates);
            this.changed();
        };


    /**
     * The radius is in the units of the projection.
     * @param {number} radius Radius.
     * @api
     */
    ol.geom.Marker.prototype.setRadius = function(radius) {
        goog.asserts.assert(!goog.isNull(this.flatCoordinates));
        this.flatCoordinates[this.stride] = this.flatCoordinates[0] + radius;
        this.changed();
    };


/**
     * Method to provide interface for setCoordinate as Polygon, LineString provides
     * Needed to have a Circle geometry that is drawable by ol.interaction.Draw
     * @param  {[ol.Coordinate, radius]} coordinates Custom structure that contains center coordinate and radius
     */
    ol.geom.Marker.prototype.setCoordinates = function(coordinates) {
        var center = coordinates[0],
            radius = coordinates[1];

        this.setCenter(center);
        this.setRadius(radius);
    };

    /**
     * Method to provide interface for getCoordinate as Polygon, LineString provides needed for ol.interaction.Draw
     * @return {[ol.Coordinate, radius]} coordinates Custom structure that contains center coordinate and radius
     */
    ol.geom.Marker.prototype.getCoordinates = function() {
        return [this.getCenter(), this.getRadiuX()];
    };

    /**
     * Method to accept a custom array of formed coordinates from Manipulation functionality
     * 'setCoordinates' can't be used here as it is utilized by drawInteraction (ol.interaction.DrawWithShapes)
     * @param {Array<[x, y]>} coordinates array of coordinates as [centerCoordinate, xRadiusCoordinate, yRadiusCoordinate]
     */
    ol.geom.Marker.prototype.setCoordinatesForManipulation = function(coordinates) {
        this.setCenter(coordinates[0]);
    };

    /**
     * 'getCoordinates' can't be used here as it is utilized by drawInteraction (ol.interaction.DrawWithShapes)
     * @returns {*[]} formed coordinates array for manipulation
     */
    ol.geom.Marker.prototype.getCoordinatesForManipulation = function() {
        return [this.getCenter()];
    };

    return ol.geom.Marker;
});