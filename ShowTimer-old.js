var ota = new Date();
var mainTick = -1;
var msec_cnt = 0;
var periodicSync = -1;
var noMatterWhat = -1;

var prevSec = -1;

var tickms = 200;

/* skew timing of top of second display */
var dispFudgeMS = -50;

function updTickInter(t) {
    let newt = parseInt(t);
    if ( newt < 10 ) {
	newt = 75;
    }
    tickms = newt;
    console.log("new tick: "+newt);
    syncToTopOfSec();
}

function updFudge(f) {
    dispFudgeMS = parseInt(f);
    console.log("new timing fudge factor: "+dispFudgeMS);
    syncToTopOfSec();
}

function syncToTopOfSec() {

    let n = new Date();
    let msec = n.getMilliseconds();
    var prevTick = mainTick;

    console.log("Before fudge factor, ms is "+msec);
    dispFudgeMS = parseInt(dispFudgeMS);
    msec += dispFudgeMS;
    if ( msec < 0 ) {
	msec += 1000;
    }

    console.log("about to resync, prevTick: "+prevTick+
		", fudge: "+dispFudgeMS+
		", msec: >"+msec+"<, tickms: >"+tickms+
		"<, secs: >"+n.getSeconds());

    window.setTimeout(
	function ( pt ) {
	    if ( noMatterWhat === -1 ) {
		noMatterWhat = window.setInterval(updTime, 1000);
	    }
	    mainTick = window.setInterval(tickHandler, tickms);
	    if ( pt !== -1 ) {
		console.log("about to clear old tick: "+prevTick);
		window.clearInterval(prevTick);
	    }
	}(prevTick),
	msec);
}


/* Stating that setTimeout() and setInterval() have a resolution of
   msecs because their second argument is in terms of msecs is great,
   but on a practical level, when you go to do things like kick off
   the setInterval() as close as you can to the "top of a second,"
   things fall apart rapidly.  You find out that any sort of
   "steering" you try to do, like adding a fudge factor to get ticked
   early so that you can account for processing delays, is futile.
   You'll also have horrible jitter if you try to do it all with
   setTimeout().

   The best you can really do is tick often and do your processing
   when Date().getMilliseconds() is less or equal to some benchmark,
   such as the tick interval.  So for example, you'd like the display
   of time to be within a tenth of a second, tick every tenth of a
   second.  If the real msecs past the second is less than 100, do
   your update.  In order to lessen the load this proggy puts on the
   system, we might call Date() only around the top of second times.
   In this case, we keep a theoretical msec counter, and only do the
   actual time sampling between two times the tick interval of one
   second.  We also clamp the value at 1000 + the ticking interval
   just in case.  We also reset the theoretical msec value to zero
   after we call the update routine.

   Despite all this, which in theory should work flawlessly, there is
   still some bug, some glitch somewhere, which makes this thing miss
   one or several seconds on occasion, inexplicably.  Therefore, as a
   last-ditch defensive measure, there is an unsynchronized
   setInterval of 1000 msec established to call our updTime()
   routine.  It's kind of a kludge, but for most seconds, we'll get
   the higher accuracy display of ticking often, and as a backup, get
   an update at some quasi-random time during the second.  Try as you
   might with setTimeout(), it seems to be impossible to sync to the
   top of the second.

*/


var lastUpdMS = 0;
function tickHandler() {

    let nd;

    msec_cnt += tickms;

    // console.log("tick at "+msec_cnt);
    let presMS = 10000;
    if ( msec_cnt >= (1000 - ( tickms << 1))
		      && msec_cnt <= (1000 + (tickms << 1)) ) {
	console.log("sampling time.");
	nd = new Date();
	presMS = nd.getMilliseconds();
    }
    if ( presMS <= ( tickms << 1 ) ) {
	// console.log("present milliseconds: "+presMS);
	updTime();
	lastUpdMS = presMS;
	msec_cnt = 0;
    }
    if ( msec_cnt >= (1000 + tickms) ) {
	msec_cnt = 0;
    }

    nd = null;
}

function pasteTime(tim, where) {

    let th = tim.getHours();
    if ( th < 10 ) {
	th = "0" + th;
    }
    let tm = tim.getMinutes();
    if ( tm < 10 ) {
	tm = "0" + tm;
    }
    let ts = tim.getSeconds();
    if ( ts < 10 ) {
	ts = "0"+ts;
    }
    let ms = tim.getMilliseconds();
    if ( ms < 10 ) {
	ms = "00"+ms;
    } else if ( ms < 100 ) {
	ms = "0"+ms;
    }


    var d = document.getElementById(where);
    // console.log("I am d, value of "+d);
    d.innerHTML = th + ":" + tm + ":" + ts+"."+ms;
}

function setUpPeriodicResync() {

    if ( 0 ) {
	let n = new Date();
	let s = n.getSeconds();
	let s10 = s % 10;
	let ms = n.getMilliseconds();
	let to10 = 10 - s10;
	console.log("set up per. sync: I am at "+s+
		    ", and I want to delay "+to10+" plus "+ms+" msec.");
	window.setTimeout(
	    function () {
		console.log("periodic sync, here we go.");
		periodicSync = window.setInterval(syncToTopOfSec, 10000);
	    },
	    to10 * 1000 + ms - 800);
    }
}

function updTime() {
    let n = new Date();
    let nmsec = n.getTime();
    ota.setTime(nmsec + 40000);
    let ts = n.getSeconds();
    if ( prevSec >= 0 ) {
	if ( ( ts == 0 && (prevSec != 59 && prevSec != 0) ) ||
	     ( ts > 0 && ts > ( prevSec + 1 ) ) ) {
	    console.log("Hey! skipped! "+prevSec+":"+ts);
	}
    }
    prevSec = ts;
    pasteTime(n, "timenow");
    pasteTime(ota, "timeAtAir");

    n = null;
}


updTime();
setUpPeriodicResync();
syncToTopOfSec();
tickInt.value = tickms;
fudge.value = dispFudgeMS;
