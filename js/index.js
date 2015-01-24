var $ = require( 'jquery' );
var _ = require( 'lodash' );
window.addEventListener( 'load', init, false );

var context;
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
var bars = Array( 300 );
var forward = true;

// Settings
var barCount = 60;
var lineWidth = 10;
var heightFactor = 5;
var delay = 10;
var animate = 'oscillate';
var animateSwitch = 5 * 1000;

var $out = $( '[name=animate][value=out]' );
var $in = $( '[name=animate][value=in]' );
var $oscillate = $( '[name=animate][value=oscillate]' );
var $hue = $( '[name=hue]' );
var $delay = $( '[name=delay]' );
var $width = $( '[name=width]' );
var $height = $( '[name=height]' );
var $oscillateDelay = $( '[name=animate-oscillate]' );

function init() {
    try {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        context = new AudioContext();

        resize();
        $( window ).on( 'resize', resize );

        flip();
        loadSong( 'audio/song.mp3' );
    } catch ( err ) {
        console.error( 'Web Audio API is not supported in this browser' );
    }
}

function flip() {
    if ( $oscillate[0].checked ) {
        if ( forward ) {
            forward = false;
        } else {
            forward = true;
        }
    }
    setTimeout( flip, animateSwitch );
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
                var average = getAverageVolume( array );
                var average = average * heightFactor;

                bars[ 0 ] = average;
                average *= 0.8;
                if ( playing ) {
                    var reduce = 0;
                    for ( var i = 1; i < barCount; i++ ) {
                        average = average - Math.sqrt( average ) + 1;
                        if ( average < 0 ) {
                            average = 0;
                        }
                        (function( i, average ) {
                            setTimeout( function() {
                                bars[ i ] = average;
                            }, delay * ( forward ? i : 60 - i ) );
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
    barCount = ( winWidth / ( lineWidth * 2 ) ) / 2;
    canvas.width = winWidth;
    canvas.height = winHeight;
}

function draw() {
    var canvasWidth = canvas.width;
    var canvasHeight = canvas.height;
    var lineGap = lineWidth;

    // clear the current state
    ctx.clearRect( 0, 0, canvasWidth, canvasHeight );

    // set the fill style

    var average = bars[ 0 ];
    var color = getColor( average );
    rect( ( canvasWidth / 2 ) - ( lineWidth / 2 ), ( canvasHeight / 2 ) - ( average / 2 ), lineWidth, average, color );
    for ( var i = 1; i < barCount; i++ ) {
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

var originalColors = [
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
var colors = _.extend( [], originalColors );

function getColor( val ) {

    var colorIndex = Math.floor( val / ( 10 * heightFactor ) );
    if ( colorIndex > 9 ) {
        colorIndex = 9;
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

$out.on( 'click', function( evt ) {
    if ( evt.currentTarget.checked ) {
        forward = true;
    }
});

$in.on( 'click', function( evt ) {
    if ( evt.currentTarget.checked ) {
        forward = false;
    }
});

$delay.on( 'input', function() {
    var val = $delay.val();
    // console.log( val * 1.2 );
    delay = Math.floor( val * 1.2 );
});

$width.on( 'input', function() {
    var winWidth = $( window ).width();
    barCount = ( winWidth / ( lineWidth * 2 ) ) / 2;
    lineWidth = Math.floor( 20 * ( $width.val() / 100 ) );
});

$height.on( 'input', function() {
    heightFactor = $height.val() / 10;
});

$oscillateDelay.on( 'input', function() {
    animateSwitch = Math.floor( $oscillateDelay.val() / 10 ) * 1000;
})

$hue.on( 'input', function() {
    var count = Math.floor( $hue.val() / 10 );
    colors = _.extend( [], originalColors );
    for ( var i = 0; i < count; i++ ) {
        colors.unshift( colors.pop() );
    }
    var whiteIndex = colors.indexOf( 'white' );
    colors.splice( whiteIndex, 1 );
    colors.unshift( 'white' );
});
