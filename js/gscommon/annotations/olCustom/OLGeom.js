define([
    "dojo/_base/lang",
    "dojo/_base/array",
    "gscommon/annotations/olCustom/OLGeomMarker"
], function (lang, array, OLGeomMarker) {
    /**
     * Implementation of geometries needed for drawing (ol.interaction.Draw) functionality
     * Provides geometries compatible with routines used to get/set coordinates inside ol.interaction.draw
     */

    goog.require('ol.geom.GeometryType');
    goog.require('ol.geom.Marker');
    goog.provide('ol.geom.Ellipse');

    /**
     * Attaching generic getGeometryCoordinates to ol.geom.SimpleGeometry so that geometry coordinates
     * can be accessible seamlessly for both getCoordinates and getManipulationCoordinates type geoms
     */
    ol.geom.SimpleGeometry.prototype.getGeometryCoordinates = function() {
        if(typeof this.getCoordinatesForManipulation == "function") {
            return this.getCoordinatesForManipulation();
        } else {
            return this.getCoordinates();
        }
    };

    /**
     * Attaching generic setGeometryCoordinates to ol.geom.SimpleGeometry so that geometry coordinates
     * can be accessible seamlessly for both setCoordinates and setManipulationCoordinates type geoms
     */
    ol.geom.SimpleGeometry.prototype.setGeometryCoordinates = function(coordinates) {
        if(typeof this.setCoordinatesForManipulation == "function") {
            return this.setCoordinatesForManipulation(coordinates);
        } else {
            return this.setCoordinates(coordinates);
        }
    };

// Meeting the formalities for a new geometry to be drawable by vector context
// 1 - Registering Oval Geometry Type
    ol.geom.GeometryType.ELLIPSE = 'Ellipse';

// 2
    ol.render.IVectorContext.prototype.drawEllipseGeometry =
        function(ellipseGeometry, data) {
        };

// 3
    ol.render.canvas.Immediate.prototype.drawEllipseGeometry =
        function(ellipseGeometry, data) {
            if (!ol.extent.intersects(this.extent_, ellipseGeometry.getExtent())) {
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
                    ellipseGeometry, this.transform_, this.pixelCoordinates_);
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
                this.drawText_(ellipseGeometry.getCenter(), 0, 2, 2);
            }
        };

// 4
    ol.render.canvas.Immediate.GEOMETRY_RENDERERS_['Ellipse'] = ol.render.canvas.Immediate.prototype.drawEllipseGeometry;

// 5
    ol.render.canvas.Instruction['ELLIPSE'] = 13;

// 6 Rewrite/Override of ol.render.canvas.Replay.prototype.replay_ to include the newly added instruction
//   Overriden at the end of the file as is likely be overriden for other geometries too

// 7
    ol.render.canvas.Replay.prototype.drawEllipseGeometry = goog.abstractMethod;

// 8
    ol.render.canvas.PolygonReplay.prototype.drawEllipseGeometry =
        function(ellipseGeometry, data) {
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
            ol.extent.extend(this.extent_, ellipseGeometry.getExtent());
            this.setFillStrokeStyles_();
            this.beginGeometry(ellipseGeometry, data);
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
            var flatCoordinates = ellipseGeometry.getFlatCoordinates();
            var stride = ellipseGeometry.getStride();
            var myBegin = this.coordinates.length;
            this.appendFlatCoordinates(
                flatCoordinates, 0, flatCoordinates.length, stride, false);
            var beginPathInstruction = [ol.render.canvas.Instruction.BEGIN_PATH];
            var ellipseInstruction = [ol.render.canvas.Instruction.ELLIPSE, myBegin];
            this.instructions.push(beginPathInstruction, ellipseInstruction);
            this.hitDetectionInstructions.push(beginPathInstruction, ellipseInstruction);
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
            this.endGeometry(ellipseGeometry, data);
        };

// 9
    /**
     * @param {ol.render.IReplayGroup} replayGroup Replay group.
     * @param {ol.geom.Geometry} geometry Geometry.
     * @param {ol.style.Style} style Style.
     * @param {Object} data Opaque data object.
     * @private
     */
    ol.renderer.vector.renderEllipseGeometry_ =
        function(replayGroup, geometry, style, data) {
            goog.asserts.assertInstanceof(geometry, ol.geom.Ellipse);
            var fillStyle = style.getFill();
            var strokeStyle = style.getStroke();
            if (!goog.isNull(fillStyle) || !goog.isNull(strokeStyle)) {
                var polygonReplay = replayGroup.getReplay(
                    style.getZIndex(), ol.render.ReplayType.POLYGON);
                polygonReplay.setFillStrokeStyle(fillStyle, strokeStyle);
                polygonReplay.drawEllipseGeometry(geometry, data);
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
    ol.renderer.vector.GEOMETRY_RENDERERS_['Ellipse'] = ol.renderer.vector.renderEllipseGeometry_;


// 11 ol.geom.Ellipse
    ol.geom.Ellipse = function(center, opt_radiusX, opt_radiusY, opt_rotation, opt_layout) {
        goog.base(this);
        var center = goog.isArray(center) && center.length > 1 && center.slice(0, 2) || [0, 0], // To avoid errors where empty geometry instantiation is needed
            radiusX = goog.isDef(opt_radiusX) ? opt_radiusX : 0,
            radiusY = goog.isDef(opt_radiusY) ? opt_radiusY : (goog.isDef(opt_radiusX) ? opt_radiusX : 0),
            rotation = goog.isDef(opt_rotation) ? opt_rotation : 0;

        this.setCenterAndRadii(center, radiusX, radiusY,
            /** @type {ol.geom.GeometryLayout|undefined} */ (opt_layout));
        this.setRotation(rotation);

        // Manipulation Configuration, describes if geom has custom manipulation logic
        this.manipulationConfig = {};
        this.manipulationConfig.handlesResize = true;
        this.manipulationConfig.handlesRotation = true;
        this.manipulationConfig.handlesTranslation = true;
    };
    goog.inherits(ol.geom.Ellipse, ol.geom.SimpleGeometry);


    /**
     * Make a complete copy of the geometry.
     * @return {!ol.geom.Circle} Clone.
     * @api
     */
    ol.geom.Ellipse.prototype.clone = function() {
        var ellipse = new ol.geom.Ellipse([this.getCenter(), this.getRadiusX(), this.getRadiusY(), this.getRotation()]);
        ellipse.setFlatCoordinates(this.layout, this.flatCoordinates.slice());
        return ellipse;
    };


    /**
     * @inheritDoc
     */
    ol.geom.Ellipse.prototype.closestPointXY =
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
    ol.geom.Ellipse.prototype.containsXY = function(x, y) {
        // Rotating x, y by current geometry rotation in opposite direction to correct the calculations
        var currentRotation = this.getRotation();
        if(currentRotation) {
            var mathPoint = new goog.math.Coordinate(x, y),
                center = this.getCenter();
            mathPoint.rotateDegrees(-1 * currentRotation, new goog.math.Coordinate(center[0], center[1]));

            x = mathPoint.x;
            y = mathPoint.y;
        }

        var flatCoordinates = this.flatCoordinates;
        var rx2 = this.getRadiusXSquared_(),
            ry2 = this.getRadiusYSquared_(),
            center = this.getCenter(),
            h = center[0],
            k = center[1];

        return ((x - h) * (x - h)) / rx2 + ((y - k) * (y - k)) / ry2 <= 1;
    };


    /**
     * @return {ol.Coordinate} Center.
     * @api
     */
    ol.geom.Ellipse.prototype.getCenter = function() {
        return this.flatCoordinates.slice(0, this.stride);
    };


    /**
     * @inheritDoc
     * @api
     */
    ol.geom.Ellipse.prototype.getExtent = function(opt_extent) {
        if (this.extentRevision != this.getRevision()) {
            var flatCoordinates = this.flatCoordinates,
                stride = this.stride;

            var xRX = Math.abs(this.flatCoordinates[stride] - this.flatCoordinates[0]),
                yRY = Math.abs(this.flatCoordinates[stride*2 + 1] - this.flatCoordinates[1]);

            this.extent = ol.extent.createOrUpdate(
                    flatCoordinates[0] - xRX, flatCoordinates[1] - yRY,
                    flatCoordinates[0] + xRX, flatCoordinates[1] + yRY,
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
    ol.geom.Ellipse.prototype.getRadiusX = function() {
        return Math.sqrt(this.getRadiusXSquared_());
    };


    /**
     * @private
     * @return {number} Radius squared.
     */
    ol.geom.Ellipse.prototype.getRadiusXSquared_ = function() {
        var dx = this.flatCoordinates[this.stride] - this.flatCoordinates[0];
        var dy = this.flatCoordinates[this.stride + 1] - this.flatCoordinates[1];
        return dx * dx + dy * dy;
    };


    /**
     * @return {number} Radius.
     * @api
     */
    ol.geom.Ellipse.prototype.getRadiusY = function() {
        return Math.sqrt(this.getRadiusYSquared_());
    };


    /**
     * @private
     * @return {number} Radius squared.
     */
    ol.geom.Ellipse.prototype.getRadiusYSquared_ = function() {
        var dx = this.flatCoordinates[this.stride*2] - this.flatCoordinates[0];
        var dy = this.flatCoordinates[this.stride*2 + 1] - this.flatCoordinates[1];
        return dx * dx + dy * dy;
    };


    /**
     * @inheritDoc
     * @api
     */
    ol.geom.Ellipse.prototype.getType = function() {
        return ol.geom.GeometryType.ELLIPSE;
    };

    ol.geom.Ellipse.prototype.translate = function(differenceCoordinate) {
        var currentCenter = this.getCenter();
        this.setCenter([ currentCenter[0]+differenceCoordinate[0], currentCenter[1]+differenceCoordinate[1] ]);
    };

    /**
     * @param {ol.Coordinate} center Center.
     * @api
     */
    ol.geom.Ellipse.prototype.setCenter = function(center) {
        var stride = this.stride;
        goog.asserts.assert(center.length == stride);
        var xRX = this.flatCoordinates[stride] - this.flatCoordinates[0],
            xRY = this.flatCoordinates[stride + 1] - this.flatCoordinates[1],
            yRX = this.flatCoordinates[stride*2] - this.flatCoordinates[0],
            yRY = this.flatCoordinates[stride*2 + 1] - this.flatCoordinates[1];

        var flatCoordinates = center.slice();
        flatCoordinates[stride] = flatCoordinates[0] + xRX;
        flatCoordinates[stride + 1] = flatCoordinates[1] + xRY;
        flatCoordinates[stride*2] = flatCoordinates[0] + yRX;
        flatCoordinates[stride*2 + 1] = flatCoordinates[1] + yRY;
        /*var i;
        for (i = 1; i < stride; ++i) {
            flatCoordinates[stride + i] = center[i];
        }*/
        this.setFlatCoordinates(this.layout, flatCoordinates);
    };

    /**
     * @param {decimal} rotation Degrees, incremental rotation. Will rotate the already rotated coordinates for more
     * than one invocation of the function.
     * @api experimental
     */
    ol.geom.Ellipse.prototype.rotate = function(rotation) {
        this.setRotation(rotation);
    };

    /**
     * @param {decimal} rotation Degrees.
     * @api experimental
     */
    ol.geom.Ellipse.prototype.setRotation = function(rotation) {
        var flatCoordinates = this.flatCoordinates,
            d = 0,
            centerX = flatCoordinates[d],
            centerY = flatCoordinates[d + 1],
            mathCenter = new goog.math.Coordinate(centerX, centerY),
            xRX = flatCoordinates[d + 2],
            xRY = flatCoordinates[d + 3],
            mathX = new goog.math.Coordinate(xRX, xRY),
            yRX = flatCoordinates[d + 4],
            yRY = flatCoordinates[d + 5],
            mathY = new goog.math.Coordinate(yRX, yRY);

        mathX.rotateDegrees(rotation, mathCenter);
        mathY.rotateDegrees(rotation, mathCenter);

        flatCoordinates[d + 2] = mathX.x;
        flatCoordinates[d + 3] = mathX.y;

        flatCoordinates[d + 4] = mathY.x;
        flatCoordinates[d + 5] = mathY.y;

        this.setFlatCoordinates(this.layout, flatCoordinates);
    };

    /**
     * Calculates and returns the current rotation based on current flatCoordinates
     * @returns {number} Current angle in Degrees
     */
    ol.geom.Ellipse.prototype.getRotation = function() {
        var flatCoordinates = this.flatCoordinates,
            d = 0,
            centerX = flatCoordinates[d],
            centerY = flatCoordinates[d + 1],
            xRX = flatCoordinates[d + 2],
            xRY = flatCoordinates[d + 3];

        return goog.math.angle(centerX, centerY, xRX, xRY);
    };

    /**
     * @param {ol.Coordinate} center Center.
     * @param {number} radius Radius.
     * @param {ol.geom.GeometryLayout=} opt_layout Layout.
     * @api
     */
    ol.geom.Ellipse.prototype.setCenterAndRadii =
        function(center, radiusX, radiusY, opt_layout) {
            if (goog.isNull(center)) {
                this.setFlatCoordinates(ol.geom.GeometryLayout.XY, null);
            } else {
                this.setLayout(opt_layout, center, 0);
                if (goog.isNull(this.flatCoordinates)) {
                    this.flatCoordinates = [];
                }
                /** @type {Array.<number>} */
                var flatCoordinates = this.flatCoordinates;
                var offset = ol.geom.flat.deflate.coordinate(flatCoordinates, 0, center, this.stride);

                flatCoordinates[offset++] = flatCoordinates[0] + radiusX;
                var i, ii;
                for (i = 1, ii = this.stride; i < ii; ++i) {
                    flatCoordinates[offset++] = flatCoordinates[i];
                }

                flatCoordinates[offset++] = flatCoordinates[0];
                flatCoordinates[offset++] = flatCoordinates[1] + radiusY;
                var i, ii;
                for (i = 2, ii = this.stride; i < ii; ++i) {
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
    ol.geom.Ellipse.prototype.setFlatCoordinates =
        function(layout, flatCoordinates) {
            this.setFlatCoordinatesInternal(layout, flatCoordinates);
            this.changed();
        };


    /**
     * The radius is in the units of the projection.
     * @param {number} radius Radius.
     * @api
     */
    ol.geom.Ellipse.prototype.setRadii = function(radiusX, radiusY) {
        goog.asserts.assert(!goog.isNull(this.flatCoordinates));
        this.flatCoordinates[this.stride] = this.flatCoordinates[0] + radiusX;
        this.flatCoordinates[this.stride*2] = this.flatCoordinates[0];
        this.flatCoordinates[this.stride*2 + 1] = this.flatCoordinates[1] + radiusY;
        this.changed();
    };


    /**
     * Method to provide interface for setCoordinate as Polygon, LineString provides
     * Needed to have a Circle geometry that is drawable by ol.interaction.Draw
     * @param  {[ol.Coordinate, radius]} coordinates Custom structure that contains center coordinate and radius
     */
    ol.geom.Ellipse.prototype.setCoordinates = function(coordinates) {
        var center = coordinates[0],
            radiusX = coordinates[1],
            radiusY = coordinates[2];

        this.setCenter(center);
        this.setRadii(radiusX, radiusY);
    };

    /**
     * Method to provide interface for getCoordinate as Polygon, LineString provides needed for ol.interaction.Draw
     * @return {[ol.Coordinate, radius]} coordinates Custom structure that contains center coordinate and radius
     */
    ol.geom.Ellipse.prototype.getCoordinates = function() {
        return [this.getCenter(), this.getRadiusX(), this.getRadiusY()];
    };

    /**
     * Method to accept a custom array of formed coordinates from Manipulation functionality
     * 'setCoordinates' can't be used here as it is utilized by drawInteraction (ol.interaction.DrawWithShapes)
     * @param {Array<[x, y]>} coordinates array of coordinates as [centerCoordinate, xRadiusCoordinate, yRadiusCoordinate]
     */
    ol.geom.Ellipse.prototype.setCoordinatesForManipulation = function(coordinates) {
        var stride = this.stride,
            flatCoordinates = this.flatCoordinates,
            center = coordinates[0],
            xR = coordinates[1],
            yR = coordinates[2];

        flatCoordinates[0] = center[0];
        flatCoordinates[1] = center[1];
        flatCoordinates[stride] = xR[0];
        flatCoordinates[stride + 1] = xR[1];
        flatCoordinates[stride*2] = yR[0];
        flatCoordinates[stride*2 + 1] = yR[1];

        this.setFlatCoordinates(this.layout, flatCoordinates);
    };

    /**
     * 'getCoordinates' can't be used here as it is utilized by drawInteraction (ol.interaction.DrawWithShapes)
     * @returns {*[]} formed coordinates array for manipulation
     */
    ol.geom.Ellipse.prototype.getCoordinatesForManipulation = function() {
        var stride = this.stride,
            flatCoordinates = this.flatCoordinates,
            center = [ flatCoordinates[0], flatCoordinates[1] ],
            xR = [ flatCoordinates[stride], flatCoordinates[stride + 1] ],
            yR = [ flatCoordinates[stride*2], flatCoordinates[stride*2 + 1] ];

        return [center, xR, yR];
    };


// Overriding replay_ to incorporate custom instructions
    /**
     * @private
     * @param {CanvasRenderingContext2D} context Context.
     * @param {number} pixelRatio Pixel ratio.
     * @param {goog.vec.Mat4.Number} transform Transform.
     * @param {number} viewRotation View rotation.
     * @param {Object} skippedFeaturesHash Ids of features to skip.
     * @param {Array.<*>} instructions Instructions array.
     * @param {function(ol.geom.Geometry, Object): T|undefined} geometryCallback
     *     Geometry callback.
     * @return {T|undefined} Callback result.
     * @template T
     */
    ol.render.canvas.Replay.prototype.replay_ = function(
        context, pixelRatio, transform, viewRotation, skippedFeaturesHash,
        instructions, geometryCallback) {
        /** @type {Array.<number>} */
        var pixelCoordinates;
        if (ol.vec.Mat4.equals2D(transform, this.renderedTransform_)) {
            pixelCoordinates = this.pixelCoordinates_;
        } else {
            pixelCoordinates = ol.geom.flat.transform.transform2D(
                this.coordinates, 0, this.coordinates.length, 2,
                transform, this.pixelCoordinates_);
            goog.vec.Mat4.setFromArray(this.renderedTransform_, transform);
            goog.asserts.assert(pixelCoordinates === this.pixelCoordinates_);
        }
        var i = 0; // instruction index
        var ii = instructions.length; // end of instructions
        var d = 0; // data index
        var dd; // end of per-instruction data
        var localTransform = this.tmpLocalTransform_;
        while (i < ii) {
            var instruction = instructions[i];
            var type = /** @type {ol.render.canvas.Instruction} */ (instruction[0]);
            var data, fill, geometry, stroke, text, x, y;
            switch (type) {
                case ol.render.canvas.Instruction.BEGIN_GEOMETRY:
                    geometry = /** @type {ol.geom.Geometry} */ (instruction[1]);
                    data = /** @type {Object} */ (instruction[2]);
                    var dataUid = goog.getUid(data).toString();
                    if (!goog.isDef(goog.object.get(skippedFeaturesHash, dataUid))) {
                        ++i;
                    } else {
                        i = /** @type {number} */ (instruction[3]);
                    }
                    break;
                case ol.render.canvas.Instruction.BEGIN_PATH:
                    context.beginPath();
                    ++i;
                    break;
                case ol.render.canvas.Instruction.CIRCLE:
                    goog.asserts.assert(goog.isNumber(instruction[1]));
                    d = /** @type {number} */ (instruction[1]);
                    var x1 = pixelCoordinates[d];
                    var y1 = pixelCoordinates[d + 1];
                    var x2 = pixelCoordinates[d + 2];
                    var y2 = pixelCoordinates[d + 3];
                    var dx = x2 - x1;
                    var dy = y2 - y1;
                    var r = Math.sqrt(dx * dx + dy * dy);
                    context.arc(x1, y1, r, 0, 2 * Math.PI, true);
                    ++i;
                    break;
                case ol.render.canvas.Instruction.CLOSE_PATH:
                    context.closePath();
                    ++i;
                    break;
                case ol.render.canvas.Instruction.DRAW_IMAGE:
                    goog.asserts.assert(goog.isNumber(instruction[1]));
                    d = /** @type {number} */ (instruction[1]);
                    goog.asserts.assert(goog.isNumber(instruction[2]));
                    dd = /** @type {number} */ (instruction[2]);
                    var image =  /** @type {HTMLCanvasElement|HTMLVideoElement|Image} */
                        (instruction[3]);
                    // Remaining arguments in DRAW_IMAGE are in alphabetical order
                    var anchorX = /** @type {number} */ (instruction[4]) * pixelRatio;
                    var anchorY = /** @type {number} */ (instruction[5]) * pixelRatio;
                    var height = /** @type {number} */ (instruction[6]);
                    var opacity = /** @type {number} */ (instruction[7]);
                    var originX = /** @type {number} */ (instruction[8]);
                    var originY = /** @type {number} */ (instruction[9]);
                    var rotateWithView = /** @type {boolean} */ (instruction[10]);
                    var rotation = /** @type {number} */ (instruction[11]);
                    var scale = /** @type {number} */ (instruction[12]);
                    var snapToPixel = /** @type {boolean} */ (instruction[13]);
                    var width = /** @type {number} */ (instruction[14]);
                    if (rotateWithView) {
                        rotation += viewRotation;
                    }
                    for (; d < dd; d += 2) {
                        x = pixelCoordinates[d] - anchorX;
                        y = pixelCoordinates[d + 1] - anchorY;
                        if (snapToPixel) {
                            x = (x + 0.5) | 0;
                            y = (y + 0.5) | 0;
                        }
                        if (scale != 1 || rotation !== 0) {
                            var centerX = x + anchorX;
                            var centerY = y + anchorY;
                            ol.vec.Mat4.makeTransform2D(
                                localTransform, centerX, centerY, scale, scale,
                                rotation, -centerX, -centerY);
                            context.setTransform(
                                goog.vec.Mat4.getElement(localTransform, 0, 0),
                                goog.vec.Mat4.getElement(localTransform, 1, 0),
                                goog.vec.Mat4.getElement(localTransform, 0, 1),
                                goog.vec.Mat4.getElement(localTransform, 1, 1),
                                goog.vec.Mat4.getElement(localTransform, 0, 3),
                                goog.vec.Mat4.getElement(localTransform, 1, 3));
                        }
                        var alpha = context.globalAlpha;
                        if (opacity != 1) {
                            context.globalAlpha = alpha * opacity;
                        }

                        context.drawImage(image, originX, originY, width, height,
                            x, y, width * pixelRatio, height * pixelRatio);

                        if (opacity != 1) {
                            context.globalAlpha = alpha;
                        }
                        if (scale != 1 || rotation !== 0) {
                            context.setTransform(1, 0, 0, 1, 0, 0);
                        }
                    }
                    ++i;
                    break;
                case ol.render.canvas.Instruction.DRAW_TEXT:
                    goog.asserts.assert(goog.isNumber(instruction[1]));
                    d = /** @type {number} */ (instruction[1]);
                    goog.asserts.assert(goog.isNumber(instruction[2]));
                    dd = /** @type {number} */ (instruction[2]);
                    goog.asserts.assert(goog.isString(instruction[3]));
                    text = /** @type {string} */ (instruction[3]);
                    goog.asserts.assert(goog.isNumber(instruction[4]));
                    var offsetX = /** @type {number} */ (instruction[4]) * pixelRatio;
                    goog.asserts.assert(goog.isNumber(instruction[5]));
                    var offsetY = /** @type {number} */ (instruction[5]) * pixelRatio;
                    goog.asserts.assert(goog.isNumber(instruction[6]));
                    rotation = /** @type {number} */ (instruction[6]);
                    goog.asserts.assert(goog.isNumber(instruction[7]));
                    scale = /** @type {number} */ (instruction[7]) * pixelRatio;
                    goog.asserts.assert(goog.isBoolean(instruction[8]));
                    fill = /** @type {boolean} */ (instruction[8]);
                    goog.asserts.assert(goog.isBoolean(instruction[9]));
                    stroke = /** @type {boolean} */ (instruction[9]);
                    for (; d < dd; d += 2) {
                        x = pixelCoordinates[d] + offsetX;
                        y = pixelCoordinates[d + 1] + offsetY;
                        if (scale != 1 || rotation !== 0) {
                            ol.vec.Mat4.makeTransform2D(
                                localTransform, x, y, scale, scale, rotation, -x, -y);
                            context.setTransform(
                                goog.vec.Mat4.getElement(localTransform, 0, 0),
                                goog.vec.Mat4.getElement(localTransform, 1, 0),
                                goog.vec.Mat4.getElement(localTransform, 0, 1),
                                goog.vec.Mat4.getElement(localTransform, 1, 1),
                                goog.vec.Mat4.getElement(localTransform, 0, 3),
                                goog.vec.Mat4.getElement(localTransform, 1, 3));
                        }
                        if (stroke) {
                            context.strokeText(text, x, y);
                        }
                        if (fill) {
                            context.fillText(text, x, y);
                        }
                        if (scale != 1 || rotation !== 0) {
                            context.setTransform(1, 0, 0, 1, 0, 0);
                        }
                    }
                    ++i;
                    break;
                case ol.render.canvas.Instruction.END_GEOMETRY:
                    if (goog.isDef(geometryCallback)) {
                        geometry = /** @type {ol.geom.Geometry} */ (instruction[1]);
                        data = /** @type {Object} */ (instruction[2]);
                        var result = geometryCallback(geometry, data);
                        if (result) {
                            return result;
                        }
                    }
                    ++i;
                    break;
                case ol.render.canvas.Instruction.FILL:
                    context.fill();
                    ++i;
                    break;
                case ol.render.canvas.Instruction.MOVE_TO_LINE_TO:
                    goog.asserts.assert(goog.isNumber(instruction[1]));
                    d = /** @type {number} */ (instruction[1]);
                    goog.asserts.assert(goog.isNumber(instruction[2]));
                    dd = /** @type {number} */ (instruction[2]);
                    context.moveTo(pixelCoordinates[d], pixelCoordinates[d + 1]);
                    for (d += 2; d < dd; d += 2) {
                        context.lineTo(pixelCoordinates[d], pixelCoordinates[d + 1]);
                    }
                    ++i;
                    break;
                case ol.render.canvas.Instruction.SET_FILL_STYLE:
                    goog.asserts.assert(goog.isString(instruction[1]));
                    context.fillStyle = /** @type {string} */ (instruction[1]);
                    ++i;
                    break;
                case ol.render.canvas.Instruction.SET_STROKE_STYLE:
                    goog.asserts.assert(goog.isString(instruction[1]));
                    goog.asserts.assert(goog.isNumber(instruction[2]));
                    goog.asserts.assert(goog.isString(instruction[3]));
                    goog.asserts.assert(goog.isString(instruction[4]));
                    goog.asserts.assert(goog.isNumber(instruction[5]));
                    goog.asserts.assert(!goog.isNull(instruction[6]));
                    var usePixelRatio = goog.isDef(instruction[7]) ? instruction[7] : true;
                    var lineWidth = /** @type {number} */ (instruction[2]);
                    context.strokeStyle = /** @type {string} */ (instruction[1]);
                    context.lineWidth = usePixelRatio ? lineWidth * pixelRatio : lineWidth;
                    context.lineCap = /** @type {string} */ (instruction[3]);
                    context.lineJoin = /** @type {string} */ (instruction[4]);
                    context.miterLimit = /** @type {number} */ (instruction[5]);
                    if (ol.has.CANVAS_LINE_DASH) {
                        context.setLineDash(/** @type {Array.<number>} */ (instruction[6]));
                    }
                    ++i;
                    break;
                case ol.render.canvas.Instruction.SET_TEXT_STYLE:
                    goog.asserts.assert(goog.isString(instruction[1]));
                    goog.asserts.assert(goog.isString(instruction[2]));
                    goog.asserts.assert(goog.isString(instruction[3]));
                    context.font = /** @type {string} */ (instruction[1]);
                    context.textAlign = /** @type {string} */ (instruction[2]);
                    context.textBaseline = /** @type {string} */ (instruction[3]);
                    ++i;
                    break;
                case ol.render.canvas.Instruction.STROKE:
                    context.stroke();
                    ++i;
                    break;
                case ol.render.canvas.Instruction.ELLIPSE:
                    // FlatCoordinatesStructure for ELLIPSE:
                    //      d       d+1         d+2          d+3  d+4  d+5
                    // [centerX, centerY, xRX(Right most X), xRY, yRX, yRY]
                    // Angle between points (xRX, xRY), (X-axis) along (centerX, centerY) will determine
                    // the current rotation of shape
                    goog.asserts.assert(goog.isNumber(instruction[1]));
                    var d = /** @type {number} */ (instruction[1]),
                        centerX = pixelCoordinates[d],
                        centerY = pixelCoordinates[d + 1],
                        xRX = pixelCoordinates[d + 2],
                        xRY = pixelCoordinates[d + 3],
                        dxW = centerX - xRX,
                        dyW = centerY - xRY,
                        width = Math.sqrt(dxW*dxW + dyW*dyW),
                        yRX = pixelCoordinates[d + 4],
                        yRY = pixelCoordinates[d + 5],
                        dxH = centerX - yRX,
                        dyH = centerY - yRY,
                        height = Math.sqrt(dxH*dxH + dyH*dyH),
                        angle = goog.math.angle(centerX, centerY, xRX, xRY);

                    context.save();
                    context.translate(centerX, centerY);
                    context.rotate(goog.math.toRadians(angle));
                    context.translate(-1 * width, -1 * height);
                    context.scale(width, height);
                    context.arc(1, 1, 1, 0, 2 * Math.PI, false);
                    context.restore();
                    ++i;
                    break;
                case ol.render.canvas.Instruction.MARKER:
                    goog.asserts.assert(goog.isNumber(instruction[1]));
                    d = /** @type {number} */ (instruction[1]);
                    var x1 = pixelCoordinates[d];
                    var y1 = pixelCoordinates[d + 1];
                    var x2 = pixelCoordinates[d + 2];
                    var y2 = pixelCoordinates[d + 3];
                    var dx = x2 - x1;
                    var dy = y2 - y1;
                    var r = Math.sqrt(dx * dx + dy * dy);

                    context.save();
                    context.translate(x1, y1);
                    context.scale(0.9, 1.5);
                    context.translate(0, 1);
                    context.moveTo(0, r);
                    context.lineTo(r, 0);
                    context.arc(0, 0, r, 0, Math.PI, true);
                    context.lineTo(0, r);
                    context.restore();
                    ++i;
                    break;
                default:
                    goog.asserts.fail();
                    ++i; // consume the instruction anyway, to avoid an infinite loop
                    break;
            }
        }
        // assert that all instructions were consumed
        goog.asserts.assert(i == instructions.length);
        return undefined;
    };

    return ol.geom;
});