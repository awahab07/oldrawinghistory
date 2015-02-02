/**
 * ol.interaction.Manipulate
 * A consolidated Interaction that will hold the ol.interaction.Select and ol.interaction.Modify while routing the
 * browser events appropriately to its flow control.
 * 
 * Ii should be placed after the ol.interaction.Draw in sequence so that ol.interaction.Draw may pass control to
 * this Interaction when needed.
 * 
 * This Interaction is created to incorporate similar flow of drawing behavior as in svg-edit.googlecode.com
 * 
 * It will inherit directly form ol.interaction.Modify while will incorporate functionality from
 * ol.Interactin.Select
 */

goog.provide('ol.ManipulateEvent');
goog.provide('ol.ManipulateEventType');
goog.provide('ol.interaction.Manipulate');

goog.require('goog.events.Event');
goog.require('ol.Feature');
goog.require('ol.source.Vector');
goog.require('ol.interaction.Modify');


/**
 * @enum {string}
 */
ol.ManipulateEventType = {
    /**
     * Triggered upon feature manipulation starts
     * @event ol.ManipulateEvent#manipulatestart
     * @api experimental
     */
    MANIPULATESTART: 'manipulatestart',

    /**
     * Triggered upon feature modification ends
     * @event ol.ManipulateEvent#manipulateend
     * @api experimental
     */
    MANIPULATEEND: 'manipulateend',

    /**
     * Triggered when feature is selected for geometry addition
     * @event ol.ManipulateEvent#beforefeatureadd
     * @api experimental
     */
    FEATUREADD: 'featureadd',

    /**
     * Triggered when feature is selected for geometry subtraction
     * @event ol.ManipulateEvent#beforefeatureadd
     * @api experimental
     */
    FEATUREREMOVE: 'featureremove'
};



/**
 * @classdesc
 * Events emitted by {@link ol.interaction.Manipulate} instances are instances of
 * this type.
 *
 * @constructor
 * @extends {goog.events.Event}
 * @implements {oli.ManipulateEvent}
 * @param {ol.ManipulateEventType} type Type.
 * @param {ol.Feature} feature The feature drawn.
 */
ol.ManipulateEvent = function(type, featureCollection) {
    goog.base(this, type);

    /**
     * Collection of features being modified.
     * @type {ol.Feature}
     * @api stable
     */
    this.featureCollection = featureCollection;
};
goog.inherits(ol.ManipulateEvent, goog.events.Event);



/**
 * @classdesc
 * Interaction for modifying vector data while emitting necessary events.
 *
 * @constructor
 * @extends {ol.interaction.Pointer}
 * @param {olx.interaction.ModifyOptions} options Options.
 * @api stable
 */
ol.interaction.Manipulate = function(opt_options) {

	// ol.interaction.Select initialization
	var options = goog.isDef(opt_options) ? opt_options : {};

	/**
	* @private
	* @type {ol.events.ConditionType}
	*/
	this.condition_ = goog.isDef(options.condition) ?
	  options.condition : ol.events.condition.singleClick;

	/**
	* @private
	* @type {ol.events.ConditionType}
	*/
	this.addCondition_ = goog.isDef(options.addCondition) ?
	  options.addCondition : ol.events.condition.never;

	/**
	* @private
	* @type {ol.events.ConditionType}
	*/
	this.removeCondition_ = goog.isDef(options.removeCondition) ?
	  options.removeCondition : ol.events.condition.never;

	/**
	* @private
	* @type {ol.events.ConditionType}
	*/
	this.toggleCondition_ = goog.isDef(options.toggleCondition) ?
	  options.toggleCondition : ol.events.condition.shiftKeyOnly;


	var layerFilter;
	if (goog.isDef(options.layers)) {
		if (goog.isFunction(options.layers)) {
		  layerFilter = options.layers;
		} else {
		  var layers = options.layers;
		  layerFilter =
		      /**
		       * @param {ol.layer.Layer} layer Layer.
		       * @return {boolean} Include.
		       */
		      function(layer) {
		    return goog.array.contains(layers, layer);
		  };
		}
	} else {
		layerFilter = goog.functions.TRUE;
	}

	/**
	* @private
	* @type {function(ol.layer.Layer): boolean}
	*/
	this.layerFilter_ = layerFilter;

	/**
	* @private
	* @type {ol.FeatureOverlay}
	*/
	this.featureOverlayForSelect_ = new ol.FeatureOverlay({
		style: goog.isDef(options.style) ? options.style :
		    ol.interaction.Select.getDefaultStyleFunction()
	});

	this.features_ = this.featureOverlayForSelect_.getFeatures();
	
	// ol.interaction.Modify Initialization
	options.features = this.features_;
    goog.base(this, options);

    this.manipulatableBaseLayer_ = opt_options.manipulatableBaseLayer;

    // Manipulation variables
    this.manipulationLayer_ = new ol.layer.Manipulation({
    	iconsBaseUrl: opt_options.iconsBaseUrl,
    	manipulatableBaseLayer: this.manipulatableBaseLayer_
    });
    
    // Defining filter to detect event on selected layers
    // Include the drawing layer if this.layerToManipulateOn_ is configured to a lyer
    // Also inlude the manipulation layer
    this.layerFilter_ = function(layer) {
    	var isSelectedLayerOnly = this.layerToManipulateOn_ ? this.layerToManipulateOn_ == layer : true;
    	isSelectedLayerOnly = isSelectedLayerOnly || (goog.isDef(layer.isHandlesLayer) && layer.isHandlesLayer);
    	
    	return !(goog.isDef(layer.isManipulationLayer) && layer.isManipulationLayer) && isSelectedLayerOnly;
    }
    
    this.mapDefaultCursorStyle_ = null; // Needed to preserve original map cursor style
    this.draggingFeature_ = null; // To hold the reference of the feature being dragged
    this.manipulatingFeature_ = null; // For undo redo events
    this.dragFromPx_ = null; // Pixel from which the dragging started
    this.downPx_ = null; // Pixel at which the Pointer had been downed

    // Flags that will determine in which mode the Map currently is
    this.isInGeometryModificationMode_ = false; // Free Hand / Vertices modification mode
    this.isInSelectMode_ = true; // Resize/Rotate/Move

    /**
     * dispatchFeatureEvent: dispatching feature modify events while assigning fid
     * @param type feature type, features featureCollection
     */
    this.dispatchFeatureEvent = function(type, features) {
        features.forEach(function(feature){
            if(feature.fid == undefined || !feature.fid) {
                feature.fid = goog.getUid(feature);
                feature.setId(feature.fid);
            }
        });

        this.dispatchEvent(new ol.ManipulateEvent(type,
            features));
    }

    // Determines if feature is valid to be selected for manipulation
    // Prevents manipulation of gab handles
    this.isCandidateFeature_ = function(feature) {
    	if(goog.isDef(feature) && goog.isDef(feature.isDrawingFeature) && feature.isDrawingFeature) {
    		return false;
    	}
    	
    	return true;
    }

    /**
     * @inheritDoc
     */
    this.handlePointerDown = function(evt) {
        var eventHandled = goog.base(this, 'handlePointerDown', evt);
        if(eventHandled) {
            this.dispatchFeatureEvent(ol.ManipulateEventType.MANIPULATESTART,
                this.features_);
        }
        return eventHandled;
    }

    /**
     * @inheritDoc
     */
    this.addFeature_ = function(feature) {
        goog.base(this, 'addFeature_', feature);

        this.dispatchEvent(new ol.ManipulateEvent(ol.ManipulateEventType.FEATUREADD,
            feature));
    };

	/**
	 * @param {ol.CollectionEvent} evt Event.
	 * @private
	 */
	this.handleFeatureAdd_ = function(evt) {
		this.addSelectedFeature_(evt);
		
		goog.base(this, 'handleFeatureAdd_', evt);
	};

    /**
     * @inheritDoc
     */
    this.handleFeatureRemove_ = function(evt) {
    	this.removeSelectedFeature_(evt);

        goog.base(this, 'handleFeatureRemove_', evt);

        if (!goog.isNull(this.vertexFeature_) && this.features_.getLength() === 0) {
            this.dispatchEvent(new ol.ManipulateEvent(ol.ManipulateEventType.FEATUREREMOVE,
                evt.element));
        }
    }

    /**
     * @inheritDoc
     */
    this.handlePointerUp = function(evt) {
        var returnedValue = goog.base(this, 'handlePointerUp', evt);
        if(this.dragSegments_.length) {
            this.dispatchFeatureEvent(ol.ManipulateEventType.MANIPULATEEND,
                this.features_);
        }
        return returnedValue;
    };

	/**
	 * @inheritDoc
	 * Checks if Browser Event handled by the Select Functionality of features
	 */
	this.handleMapBrowserEventForSelect_ = function(mapBrowserEvent) {
		// Handle PointerDrag and PointerUp Events for Movement of Shapes or grab Handle features if this.draggingFeature_ is not null
		if(!goog.isNull(this.draggingFeature_) && !goog.isNull(this.dragFromPx_)) {

			// If a feature is dragged, ask to manipulation layer to modify accordingly
            if(mapBrowserEvent.type === ol.MapBrowserEvent.EventType.POINTERDRAG ) {
				this.manipulationLayer_.featureDragged(this.map_, this.draggingFeature_, this.dragFromPx_, mapBrowserEvent.pixel, mapBrowserEvent);

				// updating dragFromPx
                this.dragFromPx_ = mapBrowserEvent.pixel;
            }

            // If pointer is up after feature was selected, ask manipulation layer that dragging is finished
            if(mapBrowserEvent.type == ol.MapBrowserEvent.EventType.POINTERUP) {
            	this.manipulationLayer_.draggingDone(this.draggingFeature_);
                this.dragFromPx_ = null;
            }
        }

		var selectFeatures = this.featureOverlayForSelect_.getFeatures();

		// Check whether pointer is over a feature
		if(mapBrowserEvent.type === ol.MapBrowserEvent.EventType.POINTERMOVE) {
			this.updateMapCursorStyle_(mapBrowserEvent);
		}

		if(mapBrowserEvent.type === ol.MapBrowserEvent.EventType.POINTERDOWN) {
			this.downPx_ = mapBrowserEvent.pixel;
			
			if(this.isInSelectMode_ && !this.isInGeometryModificationMode_) {
				this.dragFromPx_ = this.downPx_;
			}

			// Replace the currently selected feature(s) with the feature at the pixel,
			// or clear the selected feature(s) if there is no feature at the pixel.
			/** @type {ol.Feature|undefined} */
			var feature = this.map_.forEachFeatureAtPixel(mapBrowserEvent.pixel,
			    function(feature, layer) {
			      return feature;
			    }, undefined, this.layerFilter_);
			
			if(!this.isCandidateFeature_(feature)) {
				return true;
			}

			if (goog.isDef(feature) &&
			    selectFeatures.getLength() == 1 &&
			    selectFeatures.item(0) == feature) {
			  // No change
			} else {
				if (selectFeatures.getLength() !== 0) {
					selectFeatures.clear();
				}
				if (goog.isDef(feature)) {
					if(this.isInGeometryModificationMode_) {
						selectFeatures.push(feature);
					}
					
					this.featureSelected_(feature);
				} else {
					this.featureUnSelected_(feature);
				}
			}

            if(goog.isDef(feature))
                return false;
		}
		return true;
	};

	/**
	 * Changes the cursor style of map viewport
	 * Detects handle features on filtered layers on manipulateInteraction as well as handlesLayer also confirms from this.isCandidateFeature_
	 * If detected feature is handle feature, queries the cursorStyle property of handle
	 * If detected feature is not a handle feature (Shape feature), applied the "move" cursor style
	 * 
	 * @param  {ol.MapBrowserEvent} mapBrowserEvent Current state of Pointer event
	 * @return {undefined}
	 */
	this.updateMapCursorStyle_ = function(mapBrowserEvent) {
		// Detecting shape and handle features
		var manipulateInteraction = this;
		var shapeOrHandleFeature = this.map_.forEachFeatureAtPixel(
			mapBrowserEvent.pixel,
		    function(shapeOrHandleFeature, layer) {
		      return shapeOrHandleFeature;
		    }, 
		    undefined, 
		    function(layer) {
		    	return manipulateInteraction.layerFilter_(layer) || goog.isDefAndNotNull(layer.isHandlerLayer);
		    });

		if(goog.isDef(shapeOrHandleFeature) && this.isCandidateFeature_(shapeOrHandleFeature)) {
			if(goog.isDefAndNotNull(shapeOrHandleFeature.isHandleFeature))
				this.changeCursorTo_(shapeOrHandleFeature.cursorStyle);
			else
				this.changeCursorTo_("move");
		} else {
			this.changeCursorToDefault_();
		}		
	}

	/**
	 * Determine is event type is suitable to detect Select Event
	 * @param  {ol.MapBrowserEvent} mapBrowserEvent Current state of Pointer Event
	 * @return {bool} Whether or not the event should be routed to select functionality
	 */
	this.shouldRouteToSelect_ = function(mapBrowserEvent) {
		if(!this.isInSelectMode_)
			return false;
		
		if(	mapBrowserEvent.type === ol.MapBrowserEvent.EventType.POINTERDRAG ||
			mapBrowserEvent.type === ol.MapBrowserEvent.EventType.POINTERDOWN ||
			mapBrowserEvent.type === ol.MapBrowserEvent.EventType.POINTERUP ||
			mapBrowserEvent.type === ol.MapBrowserEvent.EventType.POINTERMOVE) {
				return true;
		}
		
		return false;
	}

	/**
	 * @inheritDoc
	 */
	this.handleMapBrowserEvent = function(mapBrowserEvent) {
	  var handled = false;
	  if(this.shouldRouteToSelect_(mapBrowserEvent)) {
	  	
	  	// Also if a manipulatable baseLayer is provided, pass the event to Manipulation Layer to allow it to check if
	  	// there's any need to show baseLayer manipulation handles based on the current pointer position
	  	if( goog.isDefAndNotNull(this.manipulatableBaseLayer_) ) {
	  		this.manipulationLayer_.showOrHideBaseLayerManipulationHandles(this.getMap(), mapBrowserEvent);
	  	}

	  	handled = this.handleMapBrowserEventForSelect_(mapBrowserEvent);
	  }
	  
	  if(this.isInGeometryModificationMode_)
	  	return goog.base(this, 'handleMapBrowserEvent', mapBrowserEvent) && !handled;
	  else
	  	return handled;
	};

	/**
	 * Remove the interaction from its current map, if any,  and attach it to a new
	 * map, if any. Pass `null` to just remove the interaction from the current map.
	 * @param {ol.Map} map Map.
	 * @api stable
	 */
	this.setMap = function(map) {
	  var currentMap = this.getMap();
	  var selectedFeatures = this.featureOverlayForSelect_.getFeatures();
	  if (!goog.isNull(currentMap)) {
	    selectedFeatures.forEach(currentMap.unskipFeature, currentMap);
	  }
	  goog.base(this, 'setMap', map);
	  this.featureOverlayForSelect_.setMap(map);
	  if (!goog.isNull(map)) {
	    selectedFeatures.forEach(map.skipFeature, map);
	  }
	};

    /**
	 * Get the selected features.
	 * @return {ol.Collection.<ol.Feature>} Features collection.
	 * @api stable
	 */
	this.getFeatures = function() {
	  return this.featureOverlayForSelect_.getFeatures();
	};

	/**
	 * @return {ol.style.StyleFunction} Styles.
	 */
	this.getDefaultStyleFunction = function() {
	  var styles = ol.style.createDefaultEditingStyles();
	  goog.array.extend(styles[ol.geom.GeometryType.POLYGON],
	      styles[ol.geom.GeometryType.LINE_STRING]);
	  goog.array.extend(styles[ol.geom.GeometryType.GEOMETRY_COLLECTION],
	      styles[ol.geom.GeometryType.LINE_STRING]);

	  /*return function(feature, resolution) {
	    return styles[feature.getGeometry().getType()];
	  };*/

	  /*var style = ol.style.createDefaultEditingStyles();*/
	  return function(feature, resolution) {
	    return style[ol.geom.GeometryType.POINT];
	  };
	};

	/**
	 * @param {ol.CollectionEvent} evt Event.
	 * @private
	 */
	this.addSelectedFeature_ = function(evt) {
	  var feature = evt.element;
	  var map = this.getMap();
	  goog.asserts.assertInstanceof(feature, ol.Feature);
	  if (!goog.isNull(map)) {
	    map.skipFeature(feature);
	  }
	};


	/**
	 * @param {ol.CollectionEvent} evt Event.
	 * @private
	 */
	this.removeSelectedFeature_ = function(evt) {
	  var feature = evt.element;
	  var map = this.getMap();
	  goog.asserts.assertInstanceof(feature, ol.Feature);
	  if (!goog.isNull(map)) {
	    map.unskipFeature(feature);
	  }
	};

	/**
     * Makes the mouse cursor to "given" style
     */
    this.changeCursorTo_ = function(cursorStyle) {
        if(goog.isNull(this.mapDefaultCursorStyle_))
            this.mapDefaultCursorStyle_ = this.map_.getViewport().style.cursor;
        
        this.map_.getViewport().style.cursor = goog.isDefAndNotNull(cursorStyle) ? cursorStyle : this.mapDefaultCursorStyle_;
    }

    /**
     * Makes the mouse cursor to original/default style
     */
    this.changeCursorToDefault_ = function() {
        this.map_.getViewport().style.cursor = this.mapDefaultCursorStyle_;
    }

    this.featureSelected_ = function(feature) {
    	// Adding manipulation layer to map if not added
    	if(!goog.array.contains(this.map_.getLayers().getArray(), this.manipulationLayer_)) {
        	this.getMap().addLayer(this.manipulationLayer_);
        }

        // Adding handles layer to map if not added
        if(!goog.array.contains(this.map_.getLayers().getArray(), this.manipulationLayer_.handlesLayer)) {
        	this.map_.addLayer(this.manipulationLayer_.handlesLayer);
        }

        // Informing manipulation layer that shape is selected and manipulation is going to start
        if(!(goog.isDef(feature.isHandleFeature) && feature.isHandleFeature)) {
        	this.manipulationLayer_.shapeSelectedForManipulation(this.getMap(), feature);
        }
        
        // Reference to which feature is going to be dragged for manipulation
        this.draggingFeature_ = feature;
        
        // For manipulation events
        var eventFeatureCollection = new ol.Collection();
        eventFeatureCollection.push(feature);
        
        this.manipulatingFeature_ = null; // To be populated when edited, probably by manipulation layer
    }

    this.featureUnSelected_ = function(feature) {console.log("feature unselected");
    	this.draggingFeature_ = null;

    	// Informing manipulation layer that feature is unselected
    	this.manipulationLayer_.shapeUnSelected(feature);
    }

};
goog.inherits(ol.interaction.Manipulate, ol.interaction.Modify);