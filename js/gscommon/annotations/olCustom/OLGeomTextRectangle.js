define([
    "dojo/_base/lang",
    "dojo/_base/array"
], function (lang, array) {
    /**
     * Implementation of geometries needed for drawing (ol.interaction.Draw) functionality
     * Provides geometries compatible with routines used to get/set coordinates inside ol.interaction.draw
     */


    goog.require('ol.geom.GeometryType');
    goog.require('ol.geom.Polygon');
    goog.provide('ol.geom.TextRectangle');


// Meeting the formalities for a new geometry to be drawable by vector context
// 1 - Registering Oval Geometry Type
    ol.geom.GeometryType.TEXTRECTANGLE = 'TextRectangle';

// 2
    ol.render.IVectorContext.prototype.drawTextRectangleGeometry =
        function(textRectangleGeometry, data) {
        };

// 3
    ol.render.canvas.Immediate.prototype.drawTextRectangleGeometry =
        function(polygonGeometry, data) {
            if (!ol.extent.intersects(this.extent_, polygonGeometry.getExtent())) {
                return;
            }
            if (!goog.isNull(this.strokeState_) || !goog.isNull(this.fillState_)) {
                if (!goog.isNull(this.fillState_)) {
                    this.setContextFillState_(this.fillState_);
                }
                if (!goog.isNull(this.strokeState_)) {
                    this.setContextStrokeState_(this.strokeState_);
                }
                var context = this.context_;
                context.beginPath();
                this.drawRings_(polygonGeometry.getOrientedFlatCoordinates(),
                    0, polygonGeometry.getEnds(), polygonGeometry.getStride());
                if (!goog.isNull(this.fillState_)) {
                    context.fill();
                }
                if (!goog.isNull(this.strokeState_)) {
                    context.stroke();
                }
            }
            if (this.text_ !== '') {
                var flatInteriorPoint = polygonGeometry.getFlatInteriorPoint();
                this.drawText_(flatInteriorPoint, 0, 2, 2);
            }
        };

// 4
    ol.render.canvas.Immediate.GEOMETRY_RENDERERS_['TextRectangle'] = ol.render.canvas.Immediate.prototype.drawTextRectangleGeometry;

// 5
    //ol.render.canvas.Instruction['TEXTRECTANGLE'] = ?14;

// 6 Rewrite/Override of ol.render.canvas.Replay.prototype.replay_ to include the newly added instruction
//   Overriden at the end of the file as is likely be overriden for other geometries too

// 7
    ol.render.canvas.Replay.prototype.drawTextRectangleGeometry = goog.abstractMethod;

// 8
    ol.render.canvas.PolygonReplay.prototype.drawTextRectangleGeometry =
        function(polygonGeometry, data) {
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
            ol.extent.extend(this.extent_, polygonGeometry.getExtent());
            this.setFillStrokeStyles_();
            this.beginGeometry(polygonGeometry, data);
            // always fill the polygon for hit detection
            this.hitDetectionInstructions.push(
                [ol.render.canvas.Instruction.SET_FILL_STYLE,
                    ol.color.asString(ol.render.canvas.defaultFillStyle)]);
            if (goog.isDef(state.strokeStyle)) {
                this.hitDetectionInstructions.push(
                    [ol.render.canvas.Instruction.SET_STROKE_STYLE,
                        state.strokeStyle, state.lineWidth, state.lineCap, state.lineJoin,
                        state.miterLimit, state.lineDash]);
            }
            var ends = polygonGeometry.getEnds();
            var flatCoordinates = polygonGeometry.getOrientedFlatCoordinates();
            var stride = polygonGeometry.getStride();
            this.drawFlatCoordinatess_(flatCoordinates, 0, ends, stride);
            this.endGeometry(polygonGeometry, data);
        };

// 9
    /**
     * @param {ol.render.IReplayGroup} replayGroup Replay group.
     * @param {ol.geom.Geometry} geometry Geometry.
     * @param {ol.style.Style} style Style.
     * @param {Object} data Opaque data object.
     * @private
     */
    ol.renderer.vector.renderTextRectangleGeometry_ =
        function(replayGroup, geometry, style, data) {
            goog.asserts.assertInstanceof(geometry, ol.geom.Polygon);
            var fillStyle = style.getFill();
            var strokeStyle = style.getStroke();
            if (!goog.isNull(fillStyle) || !goog.isNull(strokeStyle)) {
                var polygonReplay = replayGroup.getReplay(
                    style.getZIndex(), ol.render.ReplayType.POLYGON);
                polygonReplay.setFillStrokeStyle(fillStyle, strokeStyle);
                polygonReplay.drawPolygonGeometry(geometry, data);
            }
            var textStyle = style.getText();
            if (!goog.isNull(textStyle)) {
                var textReplay = replayGroup.getReplay(
                    style.getZIndex(), ol.render.ReplayType.TEXT);
                textReplay.setTextStyle(textStyle);
                textReplay.drawText(
                    geometry.getFlatInteriorPoint(), 0, 2, 2, geometry, data);
            }

            /**
             * This place can be used to draw carota text snapshot
             * replayGroup.resolution_ // Current resolution
             * data // current shape object, ol.Feature/ol.ShapeFeature
             *
             * drawing carota image using image replay
             */
            var imageReplay = replayGroup.getReplay(style.getZIndex(), ol.render.ReplayType.IMAGE),
                topLeftTextExtent = ol.extent.getTopLeft(data.getTextExtent()),
                styleImageObj = {
                    image_: document.querySelector('img'),
                    hitDetectionImage_: document.querySelector('img'),
                    anchorX_: topLeftTextExtent[0],
                    anchorY_: topLeftTextExtent[1],
                    height_: 60,
                    opacity_: 1,
                    originX_: 0,
                    originY_: 0,
                    rotateWithView_: true,
                    rotation_: 0,
                    scale_: 1,
                    snapToPixel_: undefined,
                    width_: 60
                };

            //imageReplay.setImageStyle(styleImage);
            //imageReplay.drawPointGeometry(new ol.geom.Point(topLeftTextExtent), data);

            // Copied from ol.render.canvas.ImageReplay.prototype.drawPointGeometry            
            imageReplay.beginGeometry(geometry, data);
            var flatCoordinates = geometry.getFlatCoordinates();
            var stride = geometry.getStride();
            var myBegin = imageReplay.coordinates.length;
            var myEnd = imageReplay.drawCoordinates_(
              flatCoordinates, 0, flatCoordinates.length, stride);
            imageReplay.instructions.push([
            ol.render.canvas.Instruction.DRAW_IMAGE, myBegin, myEnd, styleImageObj.image_,
            // Remaining arguments to DRAW_IMAGE are in alphabetical order
            styleImageObj.anchorX_, styleImageObj.anchorY_, styleImageObj.height_, styleImageObj.opacity_,
            styleImageObj.originX_, styleImageObj.originY_, styleImageObj.rotateWithView_, styleImageObj.rotation_,
            styleImageObj.scale_, styleImageObj.snapToPixel_, styleImageObj.width_
            ]);
            imageReplay.hitDetectionInstructions.push([
            ol.render.canvas.Instruction.DRAW_IMAGE, myBegin, myEnd,
            styleImageObj.hitDetectionImage_,
            // Remaining arguments to DRAW_IMAGE are in alphabetical order
            styleImageObj.anchorX_, styleImageObj.anchorY_, styleImageObj.height_, styleImageObj.opacity_,
            styleImageObj.originX_, styleImageObj.originY_, styleImageObj.rotateWithView_, styleImageObj.rotation_,
            styleImageObj.scale_, styleImageObj.snapToPixel_, styleImageObj.width_
            ]);
            imageReplay.endGeometry(geometry, data);
        };


// 10
    ol.renderer.vector.GEOMETRY_RENDERERS_['TextRectangle'] = ol.renderer.vector.renderTextRectangleGeometry_;


// 11 ol.geom.Marker
    ol.geom.TextRectangle = function(coordinates, opt_layout) {
        goog.base(this, coordinates, opt_layout);

        // Manipulation Configuration, describes if geom has custom manipulation logic
        this.manipulationConfig = {};
        this.manipulationConfig.handlesResize = false;
        this.manipulationConfig.handlesRotation = false;
        this.manipulationConfig.handlesTranslation = false;
    };
    goog.inherits(ol.geom.TextRectangle, ol.geom.Polygon);

    /**
     * @inheritDoc
     * @api stable
     */
    ol.geom.TextRectangle.prototype.getType = function() {
      return ol.geom.GeometryType.TEXTRECTANGLE;
    };

    /**
     * @inheritDoc
     */
    ol.geom.TextRectangle.prototype.getSimplifiedGeometryInternal =
        function(squaredTolerance) {
      var simplifiedFlatCoordinates = [];
      var simplifiedEnds = [];
      simplifiedFlatCoordinates.length = ol.geom.flat.simplify.quantizes(
          this.flatCoordinates, 0, this.ends_, this.stride,
          Math.sqrt(squaredTolerance),
          simplifiedFlatCoordinates, 0, simplifiedEnds);
      var simplifiedPolygon = new ol.geom.TextRectangle(null);
      simplifiedPolygon.setFlatCoordinates(
          ol.geom.GeometryLayout.XY, simplifiedFlatCoordinates, simplifiedEnds);
      return simplifiedPolygon;
    };

    return ol.geom.TextRectangle;
});