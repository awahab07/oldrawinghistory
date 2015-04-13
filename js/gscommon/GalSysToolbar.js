/**
 * Widget template Created by Jason Hornbuckle
 */
define([
    "dojo/_base/declare",
    "dojo/Deferred",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/dom-style",
    "dojo/dom-class",
    "dojo/when",
    "dojo/dom-construct",
    "dijit/form/Button",
    "dijit/Toolbar",
    "gscommon/_LocalizeMixin",
    "gscommon/LocalizationManager"
], function ( declare, Deferred, lang, array, domStyle, domClass, when, domConstruct, Button, Toolbar, _LocalizeMixin,
              LocalizationManager) {

    ///////////////////////////////////
    // instantiation:
    //
    //      var toolbar = new GalSysToolbar();
    //
    //////////////////////////////////

    return declare([Toolbar, _LocalizeMixin], {
        baseClass: 'galSysWidgetToolbar',
        style: null,
        localizationProvider: null,
        _locHandle: null,
        actions: null,
        buttons: null,
        label: null,
        localizationProvider: null,
        _localizeActionItems: null,
        _labelNode: null,
        constructor: function(args) {
            lang.mixin(this, args);
            this.buttons = {};
            this._localizeActionItems = [];
        },
        buildRendering: function (){
            var toolbar, i, action, button, locId, locMethod;

            this.inherited(arguments);

            this._labelNode = domConstruct.create('div', {
                style: 'float:left',
                innerHTML : this.label
            });

            this.domNode.appendChild(this._labelNode);

            for ( i in this.actions) {
                action = this.actions[i];
                if (action.showAsButton) {
                    button = new Button({
                        actionId: action.id,
                        label: action.label,
                        showLabel: action.showButtonLabel,
                        iconClass: action.buttonIconClass,
                        disabled: !action.enableButton,
                        onClick: action.onClickHandler
                    });
                    this.addChild(button);
                    this.buttons[action["id"]] = button;
                    if(action.localization){
                        if(action.localization.literalId){
                            locId = action.localization.literalId;
                            locMethod = 'useLiteral';
                        }else if(action.localization.columnId){
                            locId = action.localization.columnId;
                            locMethod = 'useColumnLabel';
                        }else if(action.localization.tableId){
                            locId = action.localization.tableId;
                            locMethod = 'useTableLabel';
                        }
                        else if(action.localization.hierarchyId){
                            locId = action.localization.hierarchyId;
                            locMethod = 'useHierarchyLabel';
                        }
                        this._localizeActionItems.push({
                            widget: button,
                            id: locId,
                            method: locMethod,
                            label: 'label'
                        });
                    }
                }
            }

        },
        postCreate: function () {
            var locManager;

            this.inherited(arguments);

            if (this.localizationProvider) {
                //localize Actions.
                this.localize(this.localizationProvider, this._localizeActionItems);
            }
        },
        startup: function () {
            this.inherited(arguments);
        },
        destroy: function () {
            this._locHandle && this._locHandle.cancel();
            this.destroyDescendants();
            this.inherited(arguments);
        },
        updateButtonState: function () {
            var action, button, i;

            for (i in this.actions) {
                if(this.actions.hasOwnProperty(i)){
                    action = this.actions[i];
                    if (this.buttons) {
                        button = this.buttons[action.id];
                        if (button) {
                            button.set({
                                iconClass: action.buttonIconClass,
                                disabled: !action.enableButton
                            });
                        }
                    }
                }

            }
        },
        _setLabelAttr: function (/* string */ value) {
            this._labelNode.innerHTML = value;
            this.label = value;
        }
    });
});
