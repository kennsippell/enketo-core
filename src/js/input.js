'use strict';
/**
 * Form control (input, select, textarea) helper functions.
 */

module.exports = {
    // Multiple nodes are limited to ones of the same input type (better implemented as JQuery plugin actually)
    getWrapNodes: function( $inputs ) {
        var type = this.getInputType( $inputs.eq( 0 ) );
        return ( type === 'fieldset' ) ? $inputs : $inputs.closest( '.question, .calculation' );
    },
    /** very inefficient, should actually not be used **/
    getProps: function( $input ) {
        if ( $input.length !== 1 ) {
            return console.error( 'getProps(): no input node provided or multiple' );
        }
        return {
            path: this.getName( $input ),
            ind: this.getIndex( $input ),
            inputType: this.getInputType( $input ),
            xmlType: this.getXmlType( $input ),
            constraint: this.getConstraint( $input ),
            calculation: this.getCalculation( $input ),
            relevant: this.getRelevant( $input ),
            readonly: this.getReadonly( $input ),
            val: this.getVal( $input ),
            required: this.getRequired( $input ),
            enabled: this.isEnabled( $input ),
            multiple: this.isMultiple( $input )
        };
    },
    getInputType: function( $input ) {
        var nodeName;
        if ( $input.length !== 1 ) {
            return ''; //console.error('getInputType(): no input node provided or multiple');
        }
        nodeName = $input.prop( 'nodeName' ).toLowerCase();
        if ( nodeName === 'input' ) {
            if ( $input.data( 'drawing' ) ) {
                return 'drawing';
            }
            if ( $input.attr( 'type' ).length > 0 ) {
                return $input.attr( 'type' ).toLowerCase();
            }
            return console.error( '<input> node has no type' );

        } else if ( nodeName === 'select' ) {
            return 'select';
        } else if ( nodeName === 'textarea' ) {
            return 'textarea';
        } else if ( nodeName === 'fieldset' || nodeName === 'section' ) {
            return 'fieldset';
        } else {
            return console.error( 'unexpected input node type provided' );
        }
    },
    getConstraint: function( $input ) {
        return $input.attr( 'data-constraint' );
    },
    getRequired: function( $input ) {
        // only return value if input is not a table heading input
        if ( $input.parentsUntil( '.or', '.or-appearance-label' ).length === 0 ) {
            return $input.attr( 'data-required' );
        }
    },
    getRelevant: function( $input ) {
        return $input.attr( 'data-relevant' );
    },
    getReadonly: function( $input ) {
        return $input.is( '[readonly]' );
    },
    getCalculation: function( $input ) {
        return $input.attr( 'data-calculate' );
    },
    getXmlType: function( $input ) {
        if ( $input.length !== 1 ) {
            return console.error( 'getXMLType(): no input node provided or multiple' );
        }
        return $input.attr( 'data-type-xml' );
    },
    getName: function( $input ) {
        var name;
        if ( $input.length !== 1 ) {
            return console.error( 'getName(): no input node provided or multiple' );
        }
        name = $input.attr( 'data-name' ) || $input.attr( 'name' );
        return name || console.error( 'input node has no name' );
    },
    /**
     * Used to retrieve the index of a question amidst all questions with the same name.
     * The index that can be used to find the corresponding node in the model.
     * NOTE: this function should be used sparingly, as it is CPU intensive!
     */
    getIndex: function( $input ) {
        if ( $input.length !== 1 ) {
            return console.error( 'getIndex(): no input node provided or multiple' );
        }
        return this.form.repeats.getIndex( $input[ 0 ].closest( '.or-repeat' ) );
    },
    isMultiple: function( $input ) {
        return ( this.getInputType( $input ) === 'checkbox' || $input.attr( 'multiple' ) !== undefined ) ? true : false;
    },
    isEnabled: function( $input ) {
        return !( $input.prop( 'disabled' ) || $input.parentsUntil( '.or', '.disabled' ).length > 0 );
    },
    getVal: function( $input ) {
        var inputType;
        var values = [];
        var name;

        if ( $input.length !== 1 ) {
            return console.error( 'getVal(): no inputNode provided or multiple' );
        }
        inputType = this.getInputType( $input );
        name = this.getName( $input );

        if ( inputType === 'radio' ) {
            return this.getWrapNodes( $input ).find( 'input:checked' ).val() || '';
        }
        // checkbox values bug in jQuery as (node.val() should work)
        if ( inputType === 'checkbox' ) {
            this.getWrapNodes( $input ).find( 'input[name="' + name + '"]:checked' ).each( function() {
                values.push( this.value );
            } );
            return values;
        }
        return $input.val() || '';
    },
    find: function( name, index ) {
        var attr = 'name';
        if ( this.getInputType( this.form.view.$.find( '[data-name="' + name + '"]:not(.ignore)' ).eq( 0 ) ) === 'radio' ) {
            attr = 'data-name';
        }
        return this.getWrapNodes( this.form.view.$.find( '[' + attr + '="' + name + '"]' ) ).eq( index ).find( '[' + attr + '="' + name + '"]:not(.ignore)' ).eq( 0 );
    },
    setVal: function( $input, value ) {
        var $inputs;
        var type = this.getInputType( $input );
        var $question = this.getWrapNodes( $input );
        var name = this.getName( $input );

        if ( type === 'radio' ) {
            $inputs = $question.find( '[data-name="' + name + '"]:not(.ignore)' );
        } else {
            // why not use this.getIndex?
            $inputs = $question.find( '[name="' + name + '"]:not(.ignore)' );

            if ( type === 'file' ) {
                $input.attr( 'data-loaded-file-name', value );
                // console.error('Cannot set value of file input field (value: '+value+'). If trying to load '+
                //  'this record for editing this file input field will remain unchanged.');
                return false;
            }

            if ( type === 'date' || type === 'datetime' ) {
                // convert current value (loaded from instance) to a value that a native datepicker understands
                // TODO: test for IE, FF, Safari when those browsers start including native datepickers
                value = this.form.model.types[ type ].convert( value );
            }

            if ( type === 'time' ) {
                // convert to a local time value that HTML time inputs and the JS widget understand (01:02)
                if ( /(\+|-)/.test( value ) ) {
                    // Use today's date to incorporate daylight savings changes,
                    // Strip the thousands of a second, because most browsers fail to parse such a time.
                    // Add a space before the timezone offset to satisfy some browsers.
                    // For IE11, we also need to strip the Left-to-Right marks \u200E...
                    var ds = new Date().toLocaleDateString( 'en', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    } ).replace( /\u200E/g, '' ) + ' ' + value.replace( /(\d\d:\d\d:\d\d)(\.\d{1,3})(\s?((\+|-)\d\d))(:)?(\d\d)?/, '$1 GMT$3$7' );
                    var d = new Date( ds );
                    if ( d.toString() !== 'Invalid Date' ) {
                        value = d.getHours().toString().pad( 2 ) + ':' + d.getMinutes().toString().pad( 2 );
                    } else {
                        console.error( 'could not parse time:', value );
                    }
                }
            }
        }

        if ( this.isMultiple( $input ) === true ) {
            value = value.split( ' ' );
        } else if ( type === 'radio' ) {
            value = [ value ];
        }

        // Trigger an 'inputupdate' event which can be used in widgets to update the widget when the value of its 
        // original input element has changed **programmatically**.
        if ( $inputs.length ) {
            var curVal = this.getVal( $input );
            if ( curVal === undefined || curVal.toString() !== value.toString() ) {
                $inputs.val( value );
                // don't trigger on all radiobuttons/checkboxes
                $inputs.eq( 0 ).trigger( 'inputupdate.enketo' );
            }
        }

        return $inputs[ 0 ];
    },
    validate: function( $input ) {
        return this.form.validateInput( $input );
    }
};
