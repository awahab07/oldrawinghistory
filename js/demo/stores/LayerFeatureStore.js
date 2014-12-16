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
                            coordinates: [487.34909155626224, 528.7831113832901]
                        },
                        style:{
                            fill: {
                                color: "rgba(220, 150, 30)"
                            },
                            stroke: {
                                color: "rgba(150, 150, 30)",
                                width: 1
                            }
                        }
                    },
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'MultiPoint',
                            coordinates: [[727.9740915562622, 433.8178336055123], [717.0365915562622, 377.5678336055123]]
                        },
                        style:{
                            fill: {
                                color: "rgba(220, 150, 30)"
                            },
                            stroke: {
                                color: "rgba(150, 150, 30)",
                                width: 1
                            }
                        }
                    },
                    {
                        type: 'Feature',
                        geometry: {
                            type: 'LineString',
                            coordinates: [[335.2986052686324, 149.7442083623813], [214.98610526863243, 290.3692083623813], [146.23610526863246, 284.1192083623814], [36.8611052686324, 123.1817083623813], [56.95039098291818, 57.5567083623813], [124.13789098291818, 66.9317083623813], [189.76289098291818, 76.3067083623813], [233.51289098291818, 76.3067083623813], [339.7628909829182, 80.9942083623813], [338.2003909829182, 145.0567083623813]]
                        },
                        style:{
                            fill: {
                                color: "rgba(220, 150, 30)"
                            },
                            stroke: {
                                color: "rgba(150, 150, 30)",
                                width: 1
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
                            coordinates: [[271.09375, 267.1875], [385.15625, 303.125], [432.03125, 493.75], [86.71875, 460.9375], [85.15625, 357.8125], [121.09375, 309.375], [114.84375, 268.75], [196.09375, 293.75], [260.15625, 267.1875]]
                        },
                        style:{
                            fill: {
                                color: "rgba(250, 5, 5, 1)"
                            },
                            stroke: {
                                color: "rgba(180, 50, 40, 08)",
                                width: 2
                            }
                        },
                        rotation: 45
                    }
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
            var source = new ol.source.Vector(),
                reader = new ol.format.GeoJSON();
            layer.features.forEach(function(rawFeature) {
                var feature = reader.readFeature({type: rawFeature.type, geometry: rawFeature.geometry});
                //@ TODO account for custom styles
                
                // Application specific properties
                feature.set('rotation', rawFeature.rotation || 0);

                source.addFeature(feature);
            });
            return source;
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
                        width: layer.style && layer.style.stroke && layer.style.stroke.width ||  3
                    }),
                    fill: new ol.style.Fill({
                        color: layer.style && layer.style.fill && layer.style.fill.color || 'rgba(0, 0, 255, 0.1)'
                    })
                })];
                styles['MultiLinestring'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'green',
                        width: 3
                    })
                })];
                styles['MultiPolygon'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'yellow',
                        width: 1
                    }),
                    fill: new ol.style.Fill({
                        color: layer.style && layer.style.fill && layer.style.fill.color || 'rgba(255, 255, 0, 0.1)'
                    })
                })];
                styles['default'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: layer.style && layer.style.stroke && layer.style.stroke.color || 'red',
                        width: layer.style && layer.style.stroke && layer.style.stroke.width || 3
                    }),
                    fill: new ol.style.Fill({
                        color: layer.style && layer.style.fill && layer.style.fill.color || 'rgba(255, 0, 0, 0.1)'
                    }),
                    image: image
                })];
                return function(feature, resolution) {
                    return styles[feature.getGeometry().getType()] || styles['default'];
                };
                /* jshint +W069 */
            })();
            return styleFunction;
        }
	})
});