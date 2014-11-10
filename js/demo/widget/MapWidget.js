var widgetDebug = null; // For Debugging
define([
    "dojo/_base/declare",
    "dojo/_base/fx",
    "dojo/_base/lang",
    "dojo/on",
    "dojo/dom-style",
    "dojo/aspect",
    "dijit/registry",
    "dijit/Toolbar",
    "dijit/form/Button",
    "dijit/_WidgetBase",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/text!./templates/MapWidget.html"
], function(declare, baseFx, lang, on, domStyle, aspect, registry,  Toolbar, Button,  _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, template){
    return declare([_WidgetBase, _TemplatedMixin], {
 
        // Our template - important!
        templateString: template,
 
        // A class to be applied to the root node in our template
        baseClass: "openlayersMapWidget",

        width: '90%',
        height: '90%',

        imageWidth: 200,
        imageHeight: 200,
        imageUrl: require.toUrl('demo/widget/images/no-image.png'),
        pixelProjection: null,
        baseImageLayer: null,
        mapView: null,
        minZoom:0,
        maxZoom:28,
        zoomFactor:2,
        zoom: 1,
        map: null,
        overlayStyle: null,
        selectInteraction: null,
        modifyInteraction: null,
        testVectorLayer: null,


        postMixInProperties: function() {
            this.inherited(arguments);

            // Style function, source and vector layer
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
                        color: 'blue',
                        width: 3
                    }),
                    fill: new ol.style.Fill({
                        color: 'rgba(0, 0, 255, 0.1)'
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
                        color: 'rgba(255, 255, 0, 0.1)'
                    })
                })];
                styles['default'] = [new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: 'red',
                        width: 3
                    }),
                    fill: new ol.style.Fill({
                        color: 'rgba(255, 0, 0, 0.1)'
                    }),
                    image: image
                })];
                return function(feature, resolution) {
                    return styles[feature.getGeometry().getType()] || styles['default'];
                };
                /* jshint +W069 */
            })();

            var source = new ol.source.GeoJSON(
                /** @type {olx.source.GeoJSONOptions} */ ({
                    object: {
                        'type': 'FeatureCollection',
                        'crs': {
                            'type': 'name',
                            'properties': {
                                'name': 'EPSG:3857'
                            }
                        },
                        'features': [
                            {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'Point',
                                    'coordinates': [700, 300]
                                }
                            },
                            {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'MultiPoint',
                                    'coordinates': [[1000, 555], [1200, 555]]
                                }
                            },
                            {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'LineString',
                                    'coordinates': [[400, 100], [800, 200], [900, 200]]
                                }
                            }
                        ]
                    }
                }));

            this.testVectorLayer = new ol.layer.Vector({
                source: source,
                style: styleFunction
            });

            // Map OverlayStyle
            this.overlayStyle = (function() {
                /* jshint -W069 */
                var styles = {};
                styles['Polygon'] = [
                    new ol.style.Style({
                        fill: new ol.style.Fill({
                            color: [255, 255, 255, 0.5]
                        })
                    }),
                    new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: [255, 255, 255, 1],
                            width: 5
                        })
                    }),
                    new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: [0, 153, 255, 1],
                            width: 3
                        })
                    })
                ];
                styles['MultiPolygon'] = styles['Polygon'];

                styles['LineString'] = [
                    new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: [255, 255, 255, 1],
                            width: 5
                        })
                    }),
                    new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: [0, 153, 255, 1],
                            width: 3
                        })
                    })
                ];
                styles['MultiLineString'] = styles['LineString'];

                styles['Point'] = [
                    new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 7,
                            fill: new ol.style.Fill({
                                color: [0, 153, 255, 1]
                            }),
                            stroke: new ol.style.Stroke({
                                color: [255, 255, 255, 0.75],
                                width: 1.5
                            })
                        }),
                        zIndex: 100000
                    })
                ];
                styles['MultiPoint'] = styles['Point'];

                styles['GeometryCollection'] = styles['Polygon'].concat(styles['Point']);

                return function(feature, resolution) {
                    return styles[feature.getGeometry().getType()];
                };
                /* jshint +W069 */
            })();

            this.selectInteraction = new ol.interaction.Select({
                style: this.overlayStyle
            });

            this.modifyInteraction = new ol.interaction.Modify({
                features: this.selectInteraction.getFeatures(),
                style: this.overlayStyle
            });

            // Setting up widget projection
            this.pixelProjection = new ol.proj.Projection({
                code: 'pixel',
                units: 'pixels',
                extent: [0, 0, this.imageWidth, this.imageHeight] // width and height of used image
            });

            // Setting up base image layer
            this.baseImageLayer = new ol.layer.Image({
                source: new ol.source.ImageStatic({
                    url: this.imageUrl,
                    imageSize: [this.imageWidth, this.imageHeight],
                    projection: this.pixelProjection,
                    imageExtent: this.pixelProjection.getExtent()
                })
            });

            // Setting up map view based on pixel project and image size
            this.mapView = new ol.View({
                projection: this.pixelProjection,
                minZoom: this.minZoom,
                maxZoom: this.maxZoom,
                center: ol.extent.getCenter(this.pixelProjection.getExtent()),
                zoom: this.zoom
            })
        },

        postCreate: function() {

            this.inherited(arguments);

            domStyle.set(this.mapDiv, "width", this.width);
            domStyle.set(this.mapDiv, "height", this.height);
            domStyle.set(this.mapDiv, "margin", '0 auto');

            // Instantiating ol map
            this.map = new ol.Map({
                interactions: ol.interaction.defaults().extend([this.selectInteraction, this.modifyInteraction]),
                layers: [this.baseImageLayer, this.testVectorLayer],
                target: this.mapDiv,
                view: this.mapView
            });
            widgetDebug = this;
        },

        startup: function() {
            this.inherited(arguments);
        }
    });
});