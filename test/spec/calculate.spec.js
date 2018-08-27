var loadForm = require( '../helpers/loadForm' );

describe( 'calculate functionality', function() {

    it( 'updates inside multiple repeats when repeats become relevant', function() {
        var form = loadForm( 'repeat-relevant-calculate.xml' );
        form.init();

        // This triggers a form.calc.update with this object: { relevantPath: '/data/rg' };
        form.view.$.find( '[name="/data/yn"]' ).prop( 'checked', true ).trigger( 'change' );

        expect( form.model.node( '/data/rg/row' ).get().get().map( node => node.textContent ).join( ',' ) ).toEqual( '1,2,3' );
        expect( form.view.$.find( '[name="/data/rg/row"]' )[ 0 ].value ).toEqual( '1' );
        expect( form.view.$.find( '[name="/data/rg/row"]' )[ 1 ].value ).toEqual( '2' );
        expect( form.view.$.find( '[name="/data/rg/row"]' )[ 2 ].value ).toEqual( '3' );
    } );


    it( 'updates inside multiple repeats a repeat is removed and position(..) changes', function() {
        var form = loadForm( 'repeat-relevant-calculate.xml' );
        form.init();

        form.view.$.find( '[name="/data/yn"]' ).prop( 'checked', true ).trigger( 'change' );

        // remove first repeat to the calculation in both remaining repeats needs to be updated.
        form.view.html.querySelector( '.btn.remove' ).click();

        expect( form.model.node( '/data/rg/row' ).get().get().map( node => node.textContent ).join( ',' ) ).toEqual( '1,2' );
        expect( form.view.$.find( '[name="/data/rg/row"]' )[ 0 ].value ).toEqual( '1' );
        expect( form.view.$.find( '[name="/data/rg/row"]' )[ 1 ].value ).toEqual( '2' );
    } );
} );
