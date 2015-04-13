define([
    "dojox/editor/plugins/SafePaste",
    "dojo/_base/declare",
    "dojo/aspect",
    "dijit/_editor/RichText"
], function(SafePaste, declare, aspect, RichText) {

    var GalSysSafePaste = declare([SafePaste],{
        // summary:
        //		This plugin extends the dojox SafePaste for the sole purpose of preventing an unnecessary
        // non-breaking space from being inserted into the editor.
        _openDialog: function(){
            ////////////////////
            // overriding this private method of PastFromWord in order to use extended version of RichText which
            //removies unnecessary and unwanted non-breaking space in editor. The source code intentially adds the
            //non-breaking space in reference to some allegeded but which I have not been able to reproduce. Removing
            //the space seems to have no negative effect and having it is undesirable as it introduced content that
            //the user does not want.  See old dojo ticket: https://bugs.dojotoolkit.org/ticket/13696
            /////////////////////
            this._dialog.show();
            if(!this._rte){
                // RTE hasn't been created yet, so we need to create it now that the
                // dialog is showing up.
                var CustomRichText = declare([RichText], {
                    onLoad: function(){
                        this.inherited(arguments);
                        this._focusOnEditNodeHandler = function () {
                            //this overrides internal dojo code that adds a non breaking space to an empty
                            //editor.
                            var currentHTML = this.innerHTML;
                            if(currentHTML === '&nbsp;'){
                                this.innerHTML = '';
                            }
                        };
                        this.editNode.addEventListener('focus', this._focusOnEditNodeHandler, false);
                    },
                    destroy: function () {
                        this.editNode.removeEventListener('focus', this._focusOnEditNodeHandler);
                        this.inherited(arguments);
                    }
                });

                setTimeout(dojo.hitch(this, function() {
                    this._rte = new CustomRichText({height: this.height || "300px"}, this._uId + "_rte");
                    this._rte.startup();
                    //this._rte.editNode.addEventListener('focus', focusOnEditNodeHandler, false);
                    this._rte.onLoadDeferred.addCallback(dojo.hitch(this, function() {
                        dojo.animateProperty({
                            node: this._rte.domNode, properties: { opacity: { start: 0.001, end: 1.0 } }
                        }).play();
                    }));
                }), 100);
            }
        }
    });

// Register this plugin.
    dojo.subscribe(dijit._scopeName + ".Editor.getPlugin",null,function(o){
        if(o.plugin){ return; }
        var name = o.args.name.toLowerCase();
        if(name === "galsyssafepaste"){
            o.plugin = new GalSysSafePaste({
                width: (o.args.hasOwnProperty("width"))?o.args.width:"400px",
                height: (o.args.hasOwnProperty("height"))?o.args.width:"300px",
                stripTags: (o.args.hasOwnProperty("stripTags"))?o.args.stripTags:null
            });
        }
    });

    return GalSysSafePaste;

});
