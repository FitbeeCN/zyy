var http = require( 'http' );
var util = require( 'util' );

http.createServer(function ( req, res ) {
  var startT = (new Date()).getTime();
  res.writeHead( 200, { 'Content-Type': 'text/plain' } );
  var endT   = (new Date()).getTime();
  res.send( util.inspect( req ) );
  res.end( '\nHello World.\n' + ( endT - startT ) );
}).listen( 3000, '127.0.0.1' );