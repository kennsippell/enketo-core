'use strict';

/**
 * Updates calculated items
 *
 * @param  {{nodes:Array<string>=, repeatPath: string=, repeatIndex: number=}=} updated The object containing info on updated data nodes
 */

var $ = require( 'jquery' );
var config = require( 'enketo/config' );

module.exports = {
    update: function( updated, filter ) {
        var $nodes;
        var that = this;

        // Filter is used in custom applications that make a distinction between types of calculations.
        filter = filter || '';

        if ( !this.form ) {
            throw new Error( 'Calculation module not correctly instantiated with form property.' );
        }

        updated = updated || {};

        if ( updated.relevantPath ) {
            // Questions that are descendants of a group:
            $nodes = this.form.getRelatedNodes( 'data-calculate', '[name^="' + updated.relevantPath + '/"]' + filter )
                // Individual questions:
                .add( this.form.getRelatedNodes( 'data-calculate', '[name="' + updated.relevantPath + '"]' + filter ) )
                // Individual radiobutton questions with a calculate....:
                .add( this.form.getRelatedNodes( 'data-calculate', '[data-name="' + updated.relevantPath + '"]' + filter ) );
        } else {
            $nodes = this.form.getRelatedNodes( 'data-calculate', filter, updated );
        }

        $nodes.each( function() {
            var index;
            var $control = $( this );
            var name = that.form.input.getName( $control );
            var dataNodeName = ( name.lastIndexOf( '/' ) !== -1 ) ? name.substring( name.lastIndexOf( '/' ) + 1 ) : name;
            var expr = that.form.input.getCalculation( $control );
            var dataType = that.form.input.getXmlType( $control );
            var relevantExpr = that.form.input.getRelevant( $control );
            var dataNodesObj = that.form.model.node( name );
            var dataNodes = dataNodesObj.get();

            if ( dataNodes.length > 1 ) {
                if ( updated.repeatPath && name.indexOf( updated.repeatPath ) !== -1 ) {
                    /*
                     * If the update was triggered by a datanode inside a repeat
                     * and the dependent node is inside the same repeat, we can prevent the expensive index determination
                     */
                    var $dataNode = that.form.model.node( updated.repeatPath, updated.repeatIndex ).get().find( dataNodeName );
                    index = $( dataNodes ).index( $dataNode );
                    updateCalc( index );
                } else if ( $control[ 0 ].type === 'hidden' ) {
                    /*
                     * This case is the consequence of the unfortunate decision to place calculated items without a visible form control,
                     * as a separate group (.or-calculated-items), instead of in the Form DOM in the locations where they belong.
                     * This occurs when update is called with empty updated object and multiple repeats are present.
                     */
                    dataNodes.each( function( index ) {
                        updateCalc( index );
                    } );
                } else {
                    /* 
                     * This occurs when the updated object contains a relevantPath that refers to a repeat and multiple repeats are 
                     * present, without calculated items that HAVE a visible form control.
                     */
                    var $repeatSiblings = $control.closest( '.or-repeat' ).siblings( '.or-repeat' ).addBack();
                    if ( $repeatSiblings.length === dataNodes.length ) {
                        index = $repeatSiblings.index( $control.closest( '.or-repeat' ) );
                        updateCalc( index );
                    }
                }
            } else if ( dataNodes.length === 1 ) {
                index = 0;
                updateCalc( index );
            }

            function updateCalc( index ) {
                var pathParts = name.split( '/' );
                /*
                 * First determine immediate group parent of node, which will always be in correct location in DOM. This is where
                 * we can use the index to be guaranteed to get the correct node.
                 * (also for nodes in #calculated-items).
                 *
                 * Then get all the group parents of that node.
                 * 
                 * TODO: determine index at every level to properly support repeats and nested repeats
                 * 
                 * Note: getting the parents of $control wouldn't work for nodes inside #calculated-items!
                 */
                var parentPath = pathParts.splice( 0, pathParts.length - 1 ).join( '/' );
                var $parentGroups = that.form.view.$.find( '.or-group[name="' + parentPath + '"],.or-group-data[name="' + parentPath + '"]' ).eq( index )
                    .parents( '.or-group, .or-group-data' ).addBack();

                if ( $parentGroups.length ) {
                    // Start at the highest level, and traverse down to the DOM to the immediate parent group.
                    var relevant = $parentGroups.filter( '[data-relevant]' ).reverse().get().map( function( group ) {
                        var $group = $( group );
                        var nm = that.form.input.getName( $group );

                        return {
                            context: nm,
                            // thankfully relevants on repeats are not possible with XLSForm-produced forms
                            index: that.form.view.$.find( '.or-group[name="' + nm + '"], .or-group-data[name="' + nm + '"]' ).index( $group ), // performance....
                            expr: that.form.input.getRelevant( $group )
                        };
                    } ).concat( [ {
                        context: name,
                        index: index,
                        expr: relevantExpr
                    } ] ).every( function( item ) {
                        return ( item.expr ) ? that.form.model.evaluate( item.expr, 'boolean', item.context, item.index ) : true;
                    } );
                } else {
                    relevant = ( relevantExpr ) ? that.form.model.evaluate( relevantExpr, 'boolean', name, index ) : true;
                }

                // not sure if using 'string' is always correct
                var newExpr = that.form.replaceChoiceNameFn( expr, 'string', name, index );

                // it is possible that the fixed expr is '' which causes an error in XPath
                var result = ( relevant && newExpr ) ? that.form.model.evaluate( newExpr, 'string', name, index ) : '';

                // filter the result set to only include the target node
                dataNodesObj.setIndex( index );

                // set the value
                dataNodesObj.setVal( result, dataType );

                // Not the most efficient to use input.setVal here as it will do another lookup
                // of the node, that we already have...
                // We should not use value "result" here because node.setVal() may have done a data type conversion
                that.form.input.setVal( $control, dataNodesObj.getVal()[ 0 ] );

                /*
                 * We need to specifically call validate on the question itself, because the validationUpdate
                 * in the evaluation cascade only updates questions with a _dependency_ on this question.
                 */
                if ( config.validateContinuously === true ) {
                    that.form.validateInput( $control );
                }
            }
        } );
    }
};
