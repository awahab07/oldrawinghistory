/**
 * Created with JetBrains WebStorm.
 * User: olegg
 * Date: 8/1/13
 * Time: 3:48 PM
 * To change this template use File | Settings | File Templates.
 */
define([
    "dojo/_base/lang",
    "dojo/_base/declare"
], function(lang, declare) {
    return declare (null, {
        defaultViewStore: null,
        viewStore: null,
        constructor: function(args) {
            lang.mixin(this, args);
            var self = this;
            if (self.app && self.app.stores) {
                if (self.app.stores.defaultViewStore) {
                    self.defaultViewStore = self.app.stores.defaultViewStore.store;
                }
                if (self.app.stores.viewStore) {
                    self.viewStore = self.app.stores.viewStore.store;
                }
            }
        },
        getDefaultView: function(/*Integer*/ contextId, /*Integer*/ itemId) {
            var headers = this.app.galSysSessionInfo && this.app.galSysSessionInfo.headers;
            return this.defaultViewStore.query({contextId: contextId, itemId: itemId}, {headers: headers});
        },
        getView: function(/*Integer*/ viewId) {
            var headers = this.app.galSysSessionInfo && this.app.galSysSessionInfo.headers;
            return this.viewStore.get(viewId, {headers: headers});
        }
    });
});