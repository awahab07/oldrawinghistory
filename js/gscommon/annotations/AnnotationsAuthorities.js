/**
 * Created by Jason Hornbuckle
 */
define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/Stateful",
    "dojo/Deferred",
    "dojo/request/xhr",
    "dojo/_base/array",
    "dojo/store/Memory",
    "dojo/store/Observable"
], function(declare, lang, Stateful, Deferred, xhr, array, Memory, Observable) {

    var AnnotationsAuthorities = {
        PAPERSIZE_AUTHORITIES : [
            {
                id: 1,
                label: 'A4 - 8.27 x 11.7 inches (210 x 297 mm)',
                width: 8.27,
                height: 11.7
            },
            {
                id: 2,
                label: '8 ½ x 14 inches (215.9 x 355.6 mm)',
                width: 8.5,
                height: 14
            },
            {
                id: 3,
                label: '8 1/2 x 11 inches (215.9 x 279.4 mm)',
                width: 8.5,
                height: 11
            },
            {
                id: 4,
                label: 'No Size Specified',
                width: null,
                height: null
            }
        ]
    };

    return AnnotationsAuthorities;
});
