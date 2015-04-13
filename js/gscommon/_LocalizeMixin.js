define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/aspect",
    "gscommon/LocalizationManager"
], function (declare, lang, array, aspect, LocalizationManager) {

    var _LocalizeMixin = declare(null, {
        localize: function (/* Obejct */ localizationProvider, /* Array */ localizeItems) {
            //summary:
            //  localize method that takes an array of localizabgleItems comfirming to the following structure:
            //  localizeItems = {
            //    widget: null,
            //    domNode: null, // if the item is not a widget, it should be a domNode
            //    id: 123,
            //    method: 'useLiteral',  // values: useLiteral, useColumnLabel, useTableLabel, useHierarchyLabel
            //    label: null
            // };
            var locManager, locHandle, adviceHandle, i, item;

            if (localizationProvider) {
                locManager = new LocalizationManager({localizationProvider: localizationProvider});
                i = localizeItems.length - 1;
                for(i; i >= 0; i--){
                    item = localizeItems[i];
                    if(item.widget){
                        locManager[item.method](item.id, item.label, item.widget, true, item.label);
                    }else if(item.domNode){
                        locManager[item.method](item.id, item.label, item.domNode, false);
                    }
                }

                locHandle = locManager.subscribe();

                adviceHandle = aspect.before(this, "destroy", function() {
                    locHandle.cancel();
                    adviceHandle.remove();
                });

            }else{
                throw 'localizationProvider not provided to localize method but is required.';
            }

        },
        localizeDgridColumns: function (/* Obejct */ localizationProvider, /* Object */ grid) {
            //summary:
            //  takes a standard dgrid array of columns from a grid instance that has already been initialized.
            //  and one additional parameter 'localization' has been added to the column definition.
            // localization must be an object with the property literalId or columnId or hiearchyId
            var dgridColumns, col, len, gridColumnDef, gridColumn, gridColLabel, locManager, locHandle, adviceHandle,
                locDef;

            if(localizationProvider){
                locManager = new LocalizationManager({localizationProvider: localizationProvider});
                dgridColumns = grid.get('columns');

                for (col = 0, len = dgridColumns.length; col < len; col++) {
                    gridColumnDef = dgridColumns[col];
                    gridColLabel = "" + gridColumnDef.label;
                    if (locDef = gridColumnDef.localization) {
                        if (locDef.literalId) {
                            locManager.useLiteral(locDef.literalId, gridColLabel, gridColumnDef, true);
                        } else if (locDef.columnId) {
                            locManager.useColumnLabel(locDef.columnId, gridColLabel, gridColumnDef, true);
                        } else if(locDef.hierarchyId){
                            locManager.useHierarchyLabel(locDef.hierarchyId, gridColLabel, gridColumnDef, true);
                        }
                    }
                }

                locHandle = locManager.subscribe(function(){
                    grid.renderHeader();
                });

                adviceHandle = aspect.before(this, "destroy", function() {
                    locHandle.cancel();
                    adviceHandle.remove();
                });

            }else{
                throw 'localizationProvider not provided to localize method but is required.';
            }
        }
    });
    return _LocalizeMixin;
});