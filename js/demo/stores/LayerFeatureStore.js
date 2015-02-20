define(["dojo/_base/declare", "dojo/store/JsonRest", "dojo/store/Memory"],
function(declare, JsonRest, Memory){
	return declare(Memory, {
        url: null,
		data: [
            {
                id: 1,
                title: "Layer 01",
                visible: true,
                style: {
                    stroke: {
                        color: 'rgba(250, 100, 60, 1)',
                        width: 3
                    },
                    fill: {
                        color: 'rgba(255, 255, 0, 0.4)'
                    }
                },
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [250, 50]
                        },
                        style:{
                            fill: {
                                color: "rgba(220, 150, 30, 1)"
                            },
                            stroke: {
                                color: "rgba(150, 150, 30, 1)",
                                width: 1
                            }
                        }
                    },
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'MultiPoint',
                            coordinates: [[50, 300], [100, 350]]
                        },
                        style:{
                            fill: {
                                color: "rgba(220, 150, 30, 1)"
                            },
                            stroke: {
                                color: "rgba(150, 150, 30, 1)",
                                width: 1
                            }
                        }
                    },
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: [[300, 300], [300, 400], [400, 400], [400, 300], [300, 300]]
                        },
                        style:{
                            fill: {
                                color: "rgba(220, 150, 30, 1)"
                            },
                            stroke: {
                                color: "rgba(200, 100, 30, 1)",
                                width: 3,
                                fixedWidth: false
                            }
                        }
                    }
                ]
            },
            {
                id: 2,
                title: "Layer 02",
                visible: true,
                style: {
                    stroke: {
                        color: 'rgba(80, 200, 20, 1)',
                        width: 6
                    },
                    fill: {
                        color: 'rgba(250, 5, 5, 0.9)'
                    }
                },
                features: [
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: [[50, 50], [50, 200], [200, 200], [200, 50], [50, 50]]
                        },
                        style:{
                            fill: {
                                color: "rgba(250, 5, 5, 1)"
                            },
                            stroke: {
                                color: "rgba(255, 50, 40, 1)",
                                width: 5,
                                fixedWidth: true
                            }
                        },
                        rotation: 45
                    }
                ]
            },
            {
                id: 3,
                title: "Layer 03",
                visible: true,
                style: {
                    stroke: {
                        color: 'rgba(150, 200, 20, 1)',
                        width: 4,
                        lineDash: [10]
                    },
                    fill: {
                        color: 'rgba(250, 10, 60, 0.9)'
                    }
                },
                features: [
                ]
            }
        ],

        olLayerReferences: [],

        getOLLayerReference: function(layer) {
            return this.olLayerReferences[layer.id];
        },

        getOLLayer: function(layer) {
            var olLayer;
            olLayer = new ol.layer.Vector({
                source: this.getLayerOLSource(layer),
                style: this.getLayerStyleFunction(layer)
            });
            this.olLayerReferences[layer.id] = olLayer;
            return olLayer;
        },

        getLayerOLSource: function(layer) {
            var self = this,
                source = new ol.source.Vector(),
                reader = new ol.format.GeoJSON();
            
            layer.features.forEach(function(rawFeature) {
                var feature = reader.readFeature({type: rawFeature.type, geometry: rawFeature.geometry});
                
                //@ TODO account for custom styles
                feature.setStyle(self.getFeatureStyleFunction(rawFeature));

                // Application specific properties
                feature.set('rotation', rawFeature.rotation || 0);

                source.addFeature(feature);
            });
            return source;
        },

        getFeatureStyleFunction: function(rawFeature) {
            var featureStyleFunction = (function(){
                var image = new ol.style.Circle({
                    radius: 5,
                    fill: null,
                    stroke: new ol.style.Stroke({color: 'orange', width: 2})
                });
                
                return function(resolution) {
                    var styleResolution = resolution || 1,
                        featureStyle = [
                        new ol.style.Style({
                            stroke: new ol.style.Stroke({
                                color: rawFeature.style && rawFeature.style.stroke && rawFeature.style.stroke.color || 'red',
                                width: rawFeature.style && rawFeature.style.stroke && rawFeature.style.stroke.width ? (rawFeature.style.stroke.fixedWidth ?  rawFeature.style.stroke.width / styleResolution : rawFeature.style.stroke.width) : 2 / styleResolution
                            }),
                            fill: new ol.style.Fill({
                                color: rawFeature.style && rawFeature.style.fill && rawFeature.style.fill.color || 'rgba(255, 0, 0, 0.1)'
                            }),
                            image: image
                        })
                    ];
console.log("resolution, styleResolution", resolution, styleResolution);
                    return featureStyle;
                }
            })();

            return featureStyleFunction;
        },

        getLayerStyleFunction: function(layer) {
            var styleFunction = (function() {
                /* jshint -W069 */
                var styles = {};
                var image = new ol.style.Circle({
                    radius: 5,
                    fill: null,
                    stroke: new ol.style.Stroke({color: 'orange', width: 2})
                });
                styles['Point'] = [new ol.style.Style({image: image})];
                styles['Polygon'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: layer.style && layer.style.stroke && layer.style.stroke.color || 'blue',
                        width: layer.style && layer.style.stroke && layer.style.stroke.width ||  3,
                        lineDash: layer.style && layer.style.stroke && layer.style.stroke.lineDash ||  null
                    }),
                    fill: new ol.style.Fill({
                        color: layer.style && layer.style.fill && layer.style.fill.color || 'rgba(0, 0, 255, 0.1)'
                    })
                })];
                styles['MultiLinestring'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'green',
                        width: 3,
                        lineDash: layer.style && layer.style.stroke && layer.style.stroke.lineDash ||  null
                    })
                })];
                styles['LineString'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'green',
                        width: 3,
                        lineDash: layer.style && layer.style.stroke && layer.style.stroke.lineDash ||  null
                    })
                })];
                styles['MultiPolygon'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'yellow',
                        width: 1,
                        lineDash: layer.style && layer.style.stroke && layer.style.stroke.lineDash ||  null
                    }),
                    fill: new ol.style.Fill({
                        color: layer.style && layer.style.fill && layer.style.fill.color || 'rgba(255, 255, 0, 0.1)'
                    })
                })];
                styles['default'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: layer.style && layer.style.stroke && layer.style.stroke.color || 'red',
                        width: layer.style && layer.style.stroke && layer.style.stroke.width || 3,
                        lineDash: layer.style && layer.style.stroke && layer.style.stroke.lineDash ||  null
                    }),
                    fill: new ol.style.Fill({
                        color: layer.style && layer.style.fill && layer.style.fill.color || 'rgba(255, 0, 0, 0.1)'
                    }),
                    image: image
                })];
                
                return function(feature, resolution) {
                    var style = styles[feature.getGeometry().getType()] || styles['default'];
                    if(style[0].stroke) {
                        style[0].stroke.width = 1 / resolution * 1 / resolution;
                        console.log(1 / resolution * 1 / resolution);
                    }
                    return style;
                };
                /* jshint +W069 */
            })();

            var styleStoreFunction = (function(){
                var image = new ol.style.Circle({
                    radius: 5,
                    fill: null,
                    stroke: new ol.style.Stroke({color: 'orange', width: 2})
                });
                
                return function(feature, resolution) {console.log(feature, resolution);
                    return [
                        new ol.style.Style({
                            stroke: new ol.style.Stroke({
                                color: layer.style && layer.style.stroke && layer.style.stroke.color || 'red',
                                width: layer.style && layer.style.stroke && layer.style.stroke.width || 3
                            }),
                            fill: new ol.style.Fill({
                                color: layer.style && layer.style.fill && layer.style.fill.color || 'rgba(255, 0, 0, 0.1)'
                            }),
                            image: image
                        })
                    ];
                }
            })();

            return styleStoreFunction;
        }
	})
});