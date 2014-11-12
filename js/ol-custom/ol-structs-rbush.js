/**
 * Definition of ol.structs.RBushWithEvents
 * Script to extend ol.structs.RBush to emit custom events
 */


goog.provide('ol.RBushEvent');
goog.provide('ol.RBushEventType');
goog.provide('ol.structs.RBushWithEvents');

goog.require('goog.events.Event');
goog.require('goog.events.EventType');
goog.require('goog.events.EventTarget');
goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.object');
goog.require('ol.Observable');
goog.require('ol.Object');
goog.require('ol.ext.rbush');


/**
 * @enum {string}
 */
ol.RBushEventType = {
    INSERT: 'rbushinsert',
    LOAD: 'rbushload',
    UPDATE: 'rbushupdate',
    REMOVE: 'rbushremove',
    CLEAR: 'rbushclear'
};



/**
 * @classdesc
 * Events emitted by {@link ol.structs.RBush} instances are instances of
 * this type.
 *
 * @constructor
 * @extends {goog.events.Event}
 * @implements {ol.structs.RBushWithEvents}
 * @param {ol.RBushEventType} type Type.
 * @param {ol.Feature} feature The feature drawn.
 */
ol.RBushEvent = function(type, infoObj) {

    goog.base(this, type);

    this.items = infoObj.items;
    this.item = infoObj.item;
    this.extents = infoObj.extents;
    this.values = infoObj.values;
    this.extent = infoObj.extent;
    this.value = infoObj.value;
};
goog.inherits(ol.RBushEvent, goog.events.Event);



/**
 * Wrapper around the RBush by Vladimir Agafonkin.
 *
 * @constructor
 * @param {number=} opt_maxEntries Max entries.
 * @see https://github.com/mourner/rbush
 * @struct
 * @template T
 */
ol.structs.RBushWithEvents = function(opt_maxEntries) {
    goog.base(this);

    /**
     * @private
     */
    this.rbush_ = ol.ext.rbush(opt_maxEntries);
    /**
     * A mapping between the objects added to this rbush wrapper
     * and the objects that are actually added to the internal rbush.
     * @private
     * @type {Object.<number, Object>}
     */
    this.items_ = {};
    if (goog.DEBUG) {
        /**
         * @private
         * @type {number}
         */
        this.readers_ = 0;
    }
};
goog.inherits(ol.structs.RBushWithEvents, ol.Object);


/**
 * Insert a value into the RBush.
 * @param {ol.Extent} extent Extent.
 * @param {T} value Value.
 */
ol.structs.RBushWithEvents.prototype.insert = function(extent, value) {
    if (goog.DEBUG && this.readers_) {
        throw new Error('Can not insert value while reading');
    }
    var item = [
        extent[0],
        extent[1],
        extent[2],
        extent[3],
        value
    ];
    this.rbush_.insert(item);
// remember the object that was added to the internal rbush
    goog.object.add(this.items_, goog.getUid(value).toString(), item);

    this.dispatchEvent(new ol.RBushEvent(ol.RBushEventType.INSERT, this, this));
};
/**
 * Bulk-insert values into the RBush.
 * @param {Array.<ol.Extent>} extents Extents.
 * @param {Array.<T>} values Values.
 */
ol.structs.RBushWithEvents.prototype.load = function(extents, values) {
    if (goog.DEBUG && this.readers_) {
        throw new Error('Can not insert values while reading');
    }
    goog.asserts.assert(extents.length === values.length);
    var items = [];
    for (var i = 0, l = values.length; i < l; i++) {
        var extent = extents[i];
        var value = values[i];
        var item = [
            extent[0],
            extent[1],
            extent[2],
            extent[3],
            value
        ];
        items.push(item);
        goog.object.add(this.items_, goog.getUid(value).toString(), item);
    }
    this.rbush_.load(items);

    this.dispatchEvent(new ol.RBushEvent(ol.RBushEventType.LOAD,
        {items: this.items_, extents: extents, values: values}));
};

/**
 * Remove a value from the RBush.
 * @param {T} value Value.
 * @return {boolean} Removed.
 */
ol.structs.RBushWithEvents.prototype.remove = function(value) {
    if (goog.DEBUG && this.readers_) {
        throw new Error('Can not remove value while reading');
    }
    var uid = goog.getUid(value).toString();
    goog.asserts.assert(goog.object.containsKey(this.items_, uid));
// get the object in which the value was wrapped when adding to the
// internal rbush. then use that object to do the removal.
    var item = goog.object.get(this.items_, uid);
    goog.object.remove(this.items_, uid);

    this.dispatchEvent(new ol.RBushEvent(ol.RBushEventType.REMOVE,
        {items: this.items_, value: value}));

    return this.rbush_.remove(item) !== null;
};
/**
 * Update the extent of a value in the RBush.
 * @param {ol.Extent} extent Extent.
 * @param {T} value Value.
 */
ol.structs.RBushWithEvents.prototype.update = function(extent, value) {
    this.remove(value);
    this.insert(extent, value);

    this.dispatchEvent(new ol.RBushEvent(ol.RBushEventType.UPDATE,
        {items: this.items_, extent: extent, value: value}));
};
/**
 * Return all values in the RBush.
 * @return {Array.<T>} All.
 */
ol.structs.RBush.prototype.getAll = function() {
    var items = this.rbush_.all();
    return goog.array.map(items, function(item) {
        return item[4];
    });
};
/**
 * Return all values in the given extent.
 * @param {ol.Extent} extent Extent.
 * @return {Array.<T>} All in extent.
 */
ol.structs.RBushWithEvents.prototype.getInExtent = function(extent) {
    var items = this.rbush_.search(extent);
    return goog.array.map(items, function(item) {
        return item[4];
    });
};
/**
 * Calls a callback function with each value in the tree.
 * If the callback returns a truthy value, this value is returned without
 * checking the rest of the tree.
 * @param {function(this: S, T): *} callback Callback.
 * @param {S=} opt_this The object to use as `this` in `callback`.
 * @return {*} Callback return value.
 * @template S
 */
ol.structs.RBushWithEvents.prototype.forEach = function(callback, opt_this) {
    if (goog.DEBUG) {
        ++this.readers_;
        try {
            return this.forEach_(this.getAll(), callback, opt_this);
        } finally {
            --this.readers_;
        }
    } else {
        return this.forEach_(this.getAll(), callback, opt_this);
    }
};
/**
 * Calls a callback function with each value in the provided extent.
 * @param {ol.Extent} extent Extent.
 * @param {function(this: S, T): *} callback Callback.
 * @param {S=} opt_this The object to use as `this` in `callback`.
 * @return {*} Callback return value.
 * @template S
 */
ol.structs.RBushWithEvents.prototype.forEachInExtent =
    function(extent, callback, opt_this) {
        if (goog.DEBUG) {
            ++this.readers_;
            try {
                return this.forEach_(this.getInExtent(extent), callback, opt_this);
            } finally {
                --this.readers_;
            }
        } else {
            return this.forEach_(this.getInExtent(extent), callback, opt_this);
        }
    };
/**
 * @param {Array.<T>} values Values.
 * @param {function(this: S, T): *} callback Callback.
 * @param {S=} opt_this The object to use as `this` in `callback`.
 * @private
 * @return {*} Callback return value.
 * @template S
 */
ol.structs.RBushWithEvents.prototype.forEach_ = function(values, callback, opt_this) {
    var result;
    for (var i = 0, l = values.length; i < l; i++) {
        result = callback.call(opt_this, values[i]);
        if (result) {
            return result;
        }
    }
    return result;
};
/**
 * @return {boolean} Is empty.
 */
ol.structs.RBushWithEvents.prototype.isEmpty = function() {
    return goog.object.isEmpty(this.items_);
};
/**
 * Remove all values from the RBush.
 */
ol.structs.RBushWithEvents.prototype.clear = function() {
    this.rbush_.clear();
    goog.object.clear(this.items_);

    this.dispatchEvent(new ol.RBushEvent(ol.RBushEventType.CLEAR,
        {items: this.items_}));
};
/**
 * @param {ol.Extent=} opt_extent Extent.
 * @return {ol.Extent} Extent.
 */
ol.structs.RBushWithEvents.prototype.getExtent = function(opt_extent) {
// FIXME add getExtent() to rbush
    return this.rbush_.data.bbox;
};