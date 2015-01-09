/**
 * Definition of ol.interaction.SelectWithMove
 * Script to extend and override ol.interaction.Select to incorporate moving of features while dragging.
 */

goog.provide('ol.interaction.SelectWithMove');

goog.require('ol.interaction.Select');
goog.require('ol.MapBrowserEvent.EventType');
goog.require('ol.geom.GeometryLayout');
goog.require('goog.math.Coordinate');
goog.require('goog.array.map');


/**
 * @classdesc
 * Interaction that allows Selection and Moving of Features.
 *
 * @constructor
 * @extends {ol.interaction.Draw}
 * @fires ol.DrawEvent
 * @param {olx.interaction.DrawOptions} options Options.
 * @api stable
 */
ol.interaction.SelectWithMove = function(options) {
    goog.base(this, options);

    this.draggingFeature_ = null;
    this.downPx_ = null;
    this.fromPx_ = null;

    this.mapDefaultCursorStyle_ = null;

    /**
     * Makes the mouse cursor to "move" style
     */
    this.changeCursorToMove_ = function() {
        if(goog.isNull(this.mapDefaultCursorStyle_))
            this.mapDefaultCursorStyle_ = this.map_.getViewport().style.cursor;
        
        this.map_.getViewport().style.cursor = "move";
    }

    /**
     * Makes the mouse cursor to original/default style
     */
    this.changeCursorToDefault_ = function() {
        this.map_.getViewport().style.cursor = this.mapDefaultCursorStyle_;
    }

    this.olCoordToMathCoord_ = function(olCoordinate) {
        return new goog.math.Coordinate(olCoordinate[0], olCoordinate[1]);
    }

    this.translateFeature_ = function(feature, formPx, toPx) {
        var interaction = this,
            fromCoordinate = this.map_.getCoordinateFromPixel(formPx),
            toCoordinate = this.map_.getCoordinateFromPixel(toPx);
        var differenceMathCoordinate = goog.math.Coordinate.difference(interaction.olCoordToMathCoord_(toCoordinate), interaction.olCoordToMathCoord_(fromCoordinate));

        var coordinates = feature.getGeometry().getCoordinates();
        if(goog.isDef(coordinates[0][0]) && goog.isDef(coordinates[0][0][0])) {
            coordinates = [ goog.array.map(coordinates[0], function(olCoordinate) {
                var translatedMathCoordinate = interaction.olCoordToMathCoord_(olCoordinate).translate(differenceMathCoordinate);
                return [translatedMathCoordinate.x, translatedMathCoordinate.y];
            }, this) ];
        } else if(!goog.isDef(coordinates[0][0])) {
            coordinates = goog.array.map([coordinates], function(olCoordinate) {
                var translatedMathCoordinate = interaction.olCoordToMathCoord_(olCoordinate).translate(differenceMathCoordinate);
                return [translatedMathCoordinate.x, translatedMathCoordinate.y];
            }, this)[0];
        } else {
            coordinates = goog.array.map(coordinates, function(olCoordinate) {
                var translatedMathCoordinate = interaction.olCoordToMathCoord_(olCoordinate).translate(differenceMathCoordinate);
                return [translatedMathCoordinate.x, translatedMathCoordinate.y];
            }, this);
        }
        
        feature.getGeometry().setCoordinates(coordinates);
    }

    /**
     * @inheritDoc
     */
    this.handleMapBrowserEvent =
    function(mapBrowserEvent) {

        if(!goog.isNull(this.draggingFeature_)) {
            if(mapBrowserEvent.type == ol.MapBrowserEvent.EventType.POINTERDRAG ) {
                this.translateFeature_(this.draggingFeature_, this.fromPx_, mapBrowserEvent.pixel);
                this.fromPx_ = mapBrowserEvent.pixel;

            }

            if(mapBrowserEvent.type == ol.MapBrowserEvent.EventType.POINTERUP) {
                    this.downPx_ = null;
                    this.draggingFeature_ = null;
            }

            //return false;
        }

        /*if (!this.condition_(mapBrowserEvent)) {
            return true;
        }*/
        var add = this.addCondition_(mapBrowserEvent);
        var remove = this.removeCondition_(mapBrowserEvent);
        var toggle = this.toggleCondition_(mapBrowserEvent);
        var set = !add && !remove && !toggle;
        var map = mapBrowserEvent.map;
        var features = this.featureOverlay_.getFeatures();
        if (set) {
            // Replace the currently selected feature(s) with the feature at the pixel,
            // or clear the selected feature(s) if there is no feature at the pixel.
            /** @type {ol.Feature|undefined} */
            var feature = map.forEachFeatureAtPixel(mapBrowserEvent.pixel,
                /**
                 * @param {ol.Feature} feature Feature.
                 * @param {ol.layer.Layer} layer Layer.
                 */
                function(feature, layer) {
                  return feature;
                }, undefined, this.layerFilter_);
            if (goog.isDef(feature) &&
                features.getLength() == 1 &&
                features.item(0) == feature) {
              // No change
            } else {
              if (features.getLength() !== 0) {
                features.clear();
              }
              if (goog.isDef(feature)) {
                features.push(feature);
              }
            }

            if(goog.isDef(feature)) {
                this.changeCursorToMove_();
                if(mapBrowserEvent.type == ol.MapBrowserEvent.EventType.POINTERDOWN) {
                    this.downPx_ = mapBrowserEvent.pixel;
                    this.fromPx_ = mapBrowserEvent.pixel;
                    this.draggingFeature_ = feature;
                }
                return false;
            } else {
                this.changeCursorToDefault_();
            }

        } else {
        // Modify the currently selected feature(s).
        var /** @type {Array.<number>} */ deselected = [];
        var /** @type {Array.<ol.Feature>} */ selected = [];
        map.forEachFeatureAtPixel(mapBrowserEvent.pixel,
            /**
             * @param {ol.Feature} feature Feature.
             * @param {ol.layer.Layer} layer Layer.
             */
            function(feature, layer) {
              var index = goog.array.indexOf(features.getArray(), feature);
              if (index == -1) {
                if (add || toggle) {
                  selected.push(feature);
                }
              } else {
                if (remove || toggle) {
                  deselected.push(index);
                }
              }
            }, undefined, this.layerFilter_);
        var i;
        for (i = deselected.length - 1; i >= 0; --i) {
          features.removeAt(deselected[i]);
        }
        features.extend(selected);
        }
        return true;
    };
};
goog.inherits(ol.interaction.SelectWithMove, ol.interaction.Select);