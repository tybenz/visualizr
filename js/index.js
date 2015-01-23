var $ = require( 'jquery' );
var context;
window.addEventListener( 'load', init, false );

var $body = $( 'body' );
var playing = false;
var songSource = null;
var songBuffer = null;
var startOffset = 0;
var startTime = 0;
var analyser;
var jsNode;
var canvas = $( 'canvas' )[ 0 ];
var ctx = canvas.getContext( '2d' );
var bars = Array( 60 );

function init() {
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();

        resize();
        $( window ).on( 'resize', resize );

        loadSong( 'https://s3.amazonaws.com/tybenz.assets/really_wanna.mp3' );
    } catch ( err ) {
        console.error( 'Web Audio API is not supported in this browser' );
    }
}

function loadSong( url ) {
    var request = new XMLHttpRequest();
    request.open( 'GET', url, true );
    request.responseType = 'arraybuffer';

    request.onload = function() {
        $body.addClass( 'loaded' );
        context.decodeAudioData( request.response, function( buffer ) {
            songBuffer = buffer;

            analyser = context.createAnalyser();
            analyser.smoothingTimeConstant = 0.3;
            analyser.fftSize = 1024;
            jsNode = context.createScriptProcessor( 2048, 1, 1 );
            jsNode.connect( context.destination );
            // play();
            analyser.connect( jsNode );

            draw();

            jsNode.onaudioprocess = function() {
               // get the average, bincount is fftsize / 2
                var array =  new Uint8Array( analyser.frequencyBinCount );
                analyser.getByteFrequencyData( array );
                var average = getAverageVolume( array ) * 5;

                bars[ 0 ] = average;
                average *= 0.8;
                if ( playing ) {
                    var reduce = 0;
                    for ( var i = 1; i < 60; i++ ) {
                        average = average - Math.sqrt( average ) + 1;
                        if ( average < 0 ) {
                            average = 0;
                        }
                        (function( i, average ) {
                            setTimeout( function() {
                                bars[ i ] = average;
                            }, 10 * i );
                        })( i, average );
                    }
                }
            }

        }, onError );
    }
    request.send();
}

function resize( evt ) {
    var $win = $( window );
    var winWidth = $win.width();
    var winHeight = $win.height();
    canvas.width = winWidth;
    canvas.height = winHeight;
}

function draw() {
    var canvasWidth = canvas.width;
    var canvasHeight = canvas.height;
    var lineWidth = 10;
    var lineGap = 10;

    // clear the current state
    ctx.clearRect( 0, 0, canvasWidth, canvasHeight );

    // set the fill style

    var average = bars[ 0 ];
    var color = getColor( average );
    rect( ( canvasWidth / 2 ) - ( lineWidth / 2 ), ( canvasHeight / 2 ) - ( average / 2 ), lineWidth, average, color );
    for ( var i = 1, len = bars.length; i < len; i++ ) {
        var average = bars[ i ];
        color = getColor( average );

        if ( average === undefined || average <= 0 ) {
            average = 0;
        } else {
            rect( ( canvasWidth / 2 ) - ( lineWidth / 2 ) + ( ( lineWidth + lineGap ) * i ), ( canvasHeight / 2 ) - ( average / 2 ), lineWidth, average, color );
            rect( ( canvasWidth / 2 ) - ( lineWidth / 2 ) - ( ( lineWidth + lineGap ) * i ), ( canvasHeight / 2 ) - ( average / 2 ), lineWidth, average, color );
        }
    }
    requestAnimationFrame( draw );
}

function getColor( val ) {
    var colors = [
        'white',
        'purple',
        'magenta',
        'pink',
        'red',
        'orange',
        'yellow',
        'green',
        'cyan',
        'blue'
    ];

    var colorIndex = Math.floor( val / 50 );
    if ( colorIndex > 8 ) {
        colorIndex = 8;
    } else if ( colorIndex < 0 ) {
        colorIndex = 0;
    }
    return colors[ colorIndex ];
}

function rect( x, y, width, height, color ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect( x, y, width, height );
    ctx.stroke();
    ctx.clip();

    ctx.fillStyle = color;
    ctx.fillRect( 0,0,canvas.width,canvas.height );
    ctx.restore();
}

function getAverageVolume( array ) {
    var values = 0;
    var average;

    var length = array.length;

    // get all the frequency amplitudes
    for ( var i = 0; i < length; i++ ) {
        values += array[ i ];
    }

    average = values / length;
    return average;
}

function play() {
    startTime = context.currentTime;
    songSource = context.createBufferSource();
    songSource.connect( analyser );
    songSource.buffer = songBuffer;
    songSource.connect( context.destination );
    songSource.loop = true;
    songSource.start( 0, startOffset % songBuffer.duration );
    togglePlaying();
}

function stop() {
    songSource.stop( 0 );
    startOffset += context.currentTime - startTime;
    togglePlaying();
}

function togglePlaying() {
    if ( playing ) {
        $body.removeClass( 'playing' );
        playing = false;
    } else {
        $body.addClass( 'playing' );
        playing = true;
    }
}

function onError( err ) {
    console.error( err );
}

$( '.playpause' ).on( 'click', function() {
    if ( playing ) {
        stop();
    } else {
        play();
    }
});
