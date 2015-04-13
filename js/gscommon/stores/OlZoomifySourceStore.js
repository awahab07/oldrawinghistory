/**
 * Created jason
 * 1/8/15
 */
define(["dojo/_base/declare",
        "dojo/store/JsonRest",
        "dojo/Deferred",
        "dojo/store/util/QueryResults",
        "dojox/data/XmlStore",
        "dojo/_base/lang"
], function(declare, JsonRest, Deferred, QueryResults, XmlStore, lang){

    var getMaxZoomLevel = function(width, height, tileSize) {
        var maxZoom = 0,
            dimension = width > height ? width : height;

        while(Math.pow(2, ++maxZoom) * tileSize < dimension);

        return maxZoom;
    }

    return declare(JsonRest, {
        target: null,
        ///////////////
        //service to request data about media.
        //    returns cacheType = 0 for static and 1 for tiled.
        //////////////
        mediaDataUrl: null,
        queryMedia: function (query, options) {
            var deferred = new Deferred();

            this.target = lang.replace(this.mediaDataUrl, query);

            this.query({}, options).then(function (result) {
                var xmlStore, mediaData, dimenSubstring, imgDimension, splitUrl, tileMetaPath, minZoom = 0, maxZoom,
                    zoom;

                mediaData = {
                    baseImageType: null,
                    baseImageUrl: null,
                    baseImageMeta: {
                        width: 0,
                        height: 0,
                        minZoom: 0,
                        maxZoom: 1,
                        zoom: 0
                    }
                };

                //MOCK tiling data until tiling services is working.
                //result.cacheType = 1;
                //result.largestImageUrl = 'http://jason-pc:8080/galsys/zommableImages/scroll';

                mediaData.baseImageUrl = result.largestImageUrl;

                if(result.cacheType == 0){//image is static
                    mediaData.baseImageType = 'static';
                    dimenSubstring = mediaData.baseImageUrl.substring(mediaData.baseImageUrl.indexOf('/cache/') + 7);
                    imgDimension = parseInt(dimenSubstring.split('/')[0]);
                    maxZoom = 1;
                    mediaData.baseImageMeta.width = imgDimension;
                    mediaData.baseImageMeta.height = imgDimension;
                    mediaData.baseImageMeta.minZoom = minZoom;
                    mediaData.baseImageMeta.maxZoom = maxZoom;
                    mediaData.baseImageMeta.zoom = maxZoom/2;
                    deferred.resolve(mediaData);
                }else if(result.cacheType == 1){// image is tiled
                    mediaData.baseImageType = 'tile';
                    mediaData.baseImageUrl += '/';
                    splitUrl =  mediaData.baseImageUrl.split('/');
                    tileMetaPath = splitUrl[(splitUrl.length - 2)] + '/ImageProperties.xml';
                    xmlStore = new XmlStore({
                        url: mediaData.baseImageUrl + tileMetaPath,
                        rootItem: 'IMAGE_PROPERTIES'
                    });
                    xmlStore.fetch({ query: {}, onComplete: function (items) {
                        var rootEle, attrs;

                        rootEle = items[0];
                        attrs = rootEle.element.attributes;

                        mediaData.baseImageMeta.width = Number(attrs["WIDTH"].value);
                        mediaData.baseImageMeta.height = Number(attrs["HEIGHT"].value);

                        maxZoom = getMaxZoomLevel(
                            mediaData.baseImageMeta.width,
                            mediaData.baseImageMeta.height,
                            Number(attrs["TILESIZE"].value)
                        );

                        mediaData.baseImageMeta.minZoom = minZoom;
                        mediaData.baseImageMeta.maxZoom = maxZoom;
                        mediaData.baseImageMeta.zoom = maxZoom/2;

                        deferred.resolve(mediaData);
                    }, onError: function () {
                        if(console && console.error){
                            console.error('OlZoomifySourceStore failed to find ImageProperties.xml file for tiled image');
                        }
                        //resolve so as not to break down the application but log error.
                        deferred.resolve();
                    }});
                }else{
                    throw "Unrecognized cacheType value";
                }
            });
            return deferred.promise;
        }
        //target: '',
//        query: function(query, options) {
//            var results = this.inherited(arguments);
//
//            results = QueryResults(results.filter(function (item) {
//                return item.id > 0
//            }));
//
//            // convert language id to string - otherwise Select widget cannot work properly
//            results.forEach(function(item, index, allitems){
//                allitems[index].id = "" + item.id;
//            });
//            return results;
//        }
    });
});
