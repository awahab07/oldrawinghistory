/**
 * Definition of ol.interaction.SelectWithMove
 * Script to extend and override ol.interaction.Select to incorporate moving of features while dragging.
 */

goog.provide('ol.MoveEvent');
goog.provide('ol.MoveEventType');
goog.provide('ol.interaction.SelectWithMove');

goog.require('ol.interaction.Select');
goog.require('ol.MapBrowserEvent.EventType');
goog.require('ol.geom.GeometryLayout');
goog.require('ol.Feature');
goog.require('goog.math.Coordinate');
goog.require('goog.array.map');
goog.require('goog.events.Event');




/**
 * @enum {string}
 */
ol.MoveEventType = {
    /**
     * Triggered upon feature move starts
     * @event ol.MoveEvent#movestart
     * @api experimental
     */
    MOVESTART: 'movestart',

    /**
     * Triggered upon feature move ends
     * @event ol.ModifyEvent#moveend
     * @api experimental
     */
    MOVEEND: 'moveend'
};



/**
 * @classdesc
 * Events emitted by {@link ol.interaction.Modify} instances are instances of
 * this type.
 *
 * @constructor
 * @extends {goog.events.Event}
 * @implements {oli.MoveEvent}
 * @param {ol.MoveEventType} type Type.
 * @param {ol.Feature} feature The feature drawn.
 */
ol.MoveEvent = function(type, featureCollection) {
    goog.base(this, type);

    /**
     * Collection of features being modified.
     * @type {ol.Feature}
     * @api stable
     */
    this.featureCollection = featureCollection;
};
goog.inherits(ol.MoveEvent, goog.events.Event);



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
     * dispatchFeatureEvent: dispatching feature move events while assigning fid
     * @param type feature type, features featureCollection
     */
    this.dispatchFeatureEvent = function(type, features) {
        features.forEach(function(feature){
            if(feature.fid == undefined || !feature.fid) {
                feature.fid = goog.getUid(feature);
                feature.setId(feature.fid);
            }
        });

        this.dispatchEvent(new ol.MoveEvent(type,
            features));
    }

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

    /**
     * Wrapping the ol.Coordinate to goog.math.Coordinate to allow matrix operations
     * @param  {ol.Coordinate} olCoordinate The coordinate to wrap into a math coordinate
     * @return {goog.math.Coordinate} returned new math coordinate
     */
    this.olCoordToMathCoord_ = function(olCoordinate) {
        return new goog.math.Coordinate(olCoordinate[0], olCoordinate[1]);
    }

    /**
     * Translate the Feature by applying ol.math.Coordinate.translate on feature coordinates by first converting
     * them to goog.math.Coordinate
     * @param  {ol.Feature} feature The feature to translate to
     * @param  {ol.Pixel} fromPx Pixel from which the translation should start.
     * @param  {ol.Pixel} toPx Pixel at which the translation should end.
     */
    this.translateFeature_ = function(feature, fromPx, toPx) {
        var interaction = this,
            fromCoordinate = this.map_.getCoordinateFromPixel(fromPx),
            toCoordinate = this.map_.getCoordinateFromPixel(toPx);
        var differenceMathCoordinate = goog.math.Coordinate.difference(interaction.olCoordToMathCoord_(toCoordinate), interaction.olCoordToMathCoord_(fromCoordinate));

        var coordinates = feature.getGeometry().getCoordinates();
        if(goog.isDef(coordinates[0][0])) {
            if(goog.isDef(coordinates[0][0][0])) {
                coordinates = [ goog.array.map(coordinates[0], function(olCoordinate) {
                    var translatedMathCoordinate = interaction.olCoordToMathCoord_(olCoordinate).translate(differenceMathCoordinate);
                    return [translatedMathCoordinate.x, translatedMathCoordinate.y];
                }, this) ];
            } else {
                coordinates = goog.array.map(coordinates, function(olCoordinate) {
                    var translatedMathCoordinate = interaction.olCoordToMathCoord_(olCoordinate).translate(differenceMathCoordinate);
                    return [translatedMathCoordinate.x, translatedMathCoordinate.y];
                }, this);
            }
            
        } else {
            coordinates = goog.array.map([coordinates], function(olCoordinate) {
                var translatedMathCoordinate = interaction.olCoordToMathCoord_(olCoordinate).translate(differenceMathCoordinate);
                return [translatedMathCoordinate.x, translatedMathCoordinate.y];
            }, this)[0];
        }
        
        feature.getGeometry().setCoordinates(coordinates);
    }

    /**
     * getSelectBoxFeature_ returns a feature to display a dashed rectangle around the extent of the selected
     * feature to depict the feature is selected and can be moved by dragging
     * @param  {ol.Feature} feature Fature to use for determining coordinates of SelectBox Polygon (Rectangle)
     * @return {ol.Feature}         new feature that represents the bouding rectangle
     */
    this.getSelectBoxFeature_ = function(feature) {
      var extentCoordinates = feature.getGeometry().getExtent(),
          resizePolygonCoordinates = [[
            [ extentCoordinates[0], extentCoordinates[1] ],
            [ extentCoordinates[0], extentCoordinates[3] ],
            [ extentCoordinates[2], extentCoordinates[3] ],
            [ extentCoordinates[2], extentCoordinates[1] ]
          ]];
      var resizePolygon = new ol.geom.Polygon(resizePolygonCoordinates, ol.geom.GeometryLayout.XY),
          resizeBoxFeature = new ol.Feature({geometry: resizePolygon});
      var boxFeatureStyle = new ol.style.Style({
          fill: new ol.style.Fill({color: 'transparent'}),
          stroke: new ol.style.Stroke({
              color: '#0000FF',
              width: 0.5,
              lineDash: [4, 4]
          })
      })
      resizeBoxFeature.setStyle(boxFeatureStyle);
      return resizeBoxFeature;
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
                var featureCollection = new ol.Collection();
                featureCollection.push(this.draggingFeature_);
                this.dispatchFeatureEvent(ol.ModifyEventType.MOVEEND, featureCollection);

                this.downPx_ = null;
                this.draggingFeature_ = null;
            }
            
            return false;
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
                features.push(this.getSelectBoxFeature_(feature));
                if(mapBrowserEvent.type == ol.MapBrowserEvent.EventType.POINTERDOWN) {
                    this.downPx_ = mapBrowserEvent.pixel;
                    this.fromPx_ = mapBrowserEvent.pixel;
                    this.draggingFeature_ = feature;

                    var featureCollection = new ol.Collection();
                    featureCollection.push(this.draggingFeature_);
                    this.dispatchFeatureEvent(ol.ModifyEventType.MOVESTART, featureCollection);
                }
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
        return false;
    };
};
goog.inherits(ol.interaction.SelectWithMove, ol.interaction.Select);