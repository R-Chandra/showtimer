
// alert("top.");

var timenow = document.getElementById("timenow");
if ( timenow === null ) {
    alert("Huh? What happened to the 'timenow' <div>?");
}

var utc = document.getElementById("UTC");
var otatime = document.getElementById("OTAtime");
var nxtbreaktm = document.getElementById("nxtbreak");
var tmtilbreak = document.getElementById("tilbreak");

var globalRealOff = 0;
// global real offset; starts at zero, MAY be calculated at
// runtime, e.g. by invoking a Web service or something.
// Zero in effect means, "assume local clock is accurate"

var OTAoff = 40;
var showRef;
showRef = otatime;
var brk = new Array();
var remind = new Array();
var showBegin;

var tmobj = [ utc, timenow, otatime, nxtbreaktm, tmtilbreak ];

var fastTickerObj = null;
var slowTickerObj = null;
var stopping = false;
var outOfTolCnt = 0;
var syncing = 0;
var dispoff = 0;
var showMillis = false;
var elapsedStat;

function getNewDate() {
    // get the current time (new Date()), apply the timing offset
    // (globalRealOff), and return the resultant object
    dobj = new Date();
    dobj.setTime(dobj.getTime() + globalRealOff)

    return dobj;
}


function stopST(evt) {
    // There is the global variable "stopping" because if we're in the
    // unsynchronized state, there will be the fast ticking routine
    // going on, which may asynchronously set the slow ticker.  It's
    // part of the slow ticker routine to check this global and
    // unschedule itself.
    console.log("*** stop requested.");
    but = evt.target;
    but.textContent = "stopping";
    chg_color(timenow, "white");
    stopping = true;
}

function handle_blink(blk) {
    // This makes the time displayed at "blk" appear to blink by
    // alternating between the blink fg/bg and normal fg/bg
}

function chg_milli_state(evt) {
    var tgt = evt.target;

    dbg(2, "target is "+tgt);
    var chkd = tgt.getAttribute("checked");

    dbg(2, "status of showMillis checkbox is "+tgt.checked);

    showMillis = tgt.checked;

    return true;
}

function ST_init(argv) {

    var i, l, o, now;
    var bod;

    now = new Date();

    dbg(0, "started ST_init at "+now.toTimeString());

    stopping = false;

    elapsedStat = document.getElementById("tickHandleTime");

    var bod = document.getElementsByTagName("body");
    bod = bod[0];
    bod.style.background = "";


    o = document.getElementById("stopST");
    o.addEventListener("click", stopST, false);
    o.textContent = "STOP!";

    o = document.getElementById("showms");
    o.addEventListener("change", chg_milli_state, false);

    o = document.getElementById("dbgChanger");
    o.value = dbug;

    o = document.getElementById("fudge");
    o.value = dispoff;

    l = tmobj.length;
    for ( i = 0; i < l; i++ ) {
	o = tmobj[i];
	dbg(0, "trying to init obj >"+o+"<");
	if ( o === null ) {
	    dbg(0, "o not an object, skipping.");
	} else {
	    o.st = new stObj(o);
	}
    }

    timenow.st.dtobj = now;
    utc.st.offFromReal = timenow.st.dtobj.getTimezoneOffset() * 60;
    // alert("initializing time: "+timenow.st.dtobj.toTimeString());

    otatime.st.offFromReal = OTAoff;

    showBegin = now;
    showBegin.setHours(14);
    showBegin.setMinutes(6);
    showBegin.setSeconds(0);
    showBegin.setMilliseconds(0);

    nxtbreaktm.st.dtobj = showBegin;

    tmupd(nxtbreaktm);

    sync2ToS();

    dbg(0, "leaving ST_init");

    brk = load_breaks("techguy");

}

// timenow.innerHTML = "This worked.";

function updDbg(newLvl) {
    var lvl = parseInt(newLvl);
    dbug = lvl;
    console.log("++++++++New debug level (dbug) set to "+dbug+".");
    return true;
}

function updFudge(ffactObj) {
    if ( ffactObj.value == "" ) {
	ffactObj.value = "0";
    }
    dispoff = parseInt(ffactObj.value);
    ffactObj.value = dispoff;
    dbg(-8, "updFudge(): 'this' is "+this+" and myself is "+updFudge);
}

function chg_color(obj, newcolor) {
    // change the color of "obj" and all descendants to string "newcolor"

    obj.style.color = newcolor;

    if ( false ) {
	var olist = obj.getElementsByTagName("*");
	var l = olist.length;
	var i;
	for ( i=0; i < l; i++ ) {
	    var o = olist[i];
	    o.style.color = newcolor;
	}
    }
}

function colorObj(fg, bg, blinkfg, blinkbg, blinkmilli) {
    this.blink = new Object();
    this.fg = fg;
    this.bg = bg;
    if ( blinkfg === "" ) {
	blinkfg = fg;
    }
    if ( blinkbg === "" ) {
	blinkfg = bg;
    }
    this.blink.fg = blinkfg;
    this.blink.bg = blinkbg;
    this.blink.timer = -1;
    this.blink.millis = blinkmilli;
}


// constructor for the "Show Timer" (st) object
function stObj(parentObj) {
    this.color = new Object();
    // characteristics for out of synchronization
    this.color.oos = new colorObj("pink", "black", "", "", 500);
    this.color.normal = new colorObj("green", "black", "", "", 500);
    this.color.soon = new colorObj("yellow", "black", "", "", 500);
    this.color.reallysoon = new colorObj("red", "black", "black", "red", 500);
    this.soon = 30;
    this.verysoon = 5;

    this.dtobj = new Date(0);
    this.offFromReal = null;
    this.hr = parentObj.querySelector("[data-STrole=hr]");
    this.min = parentObj.querySelector("[data-STrole=min]");
    this.sec = parentObj.querySelector("[data-STrole=sec]");
    this.millis = parentObj.querySelector("[data-STrole=millis]");
    this.millisShowing = false;

    this.state = 0;

    // return this;
}

function tmupd(blk) {
    // update block "blk" (an HTML object with a ".st" member)
    
    var st = blk.st
    var tim = blk.st.dtobj;

    var secs = tim.getSeconds();
    var milli = tim.getMilliseconds();

    if ( showMillis ) {
	st.millis.style.visibility = "visible";
	// I would have thought the prevSib of the millis item would be the
	// td of the dot (styled by default as hidden), but it's two
	// siblings back.  The first one back is a text node, which
	// apparently cannot be styled.
	st.millis.previousSibling.previousSibling.style.visibility = "visible";
	st.millis.textContent = zeropad(tim.getMilliseconds(), 3);
	st.millisShowing = true;
    } else {
	if ( milli >= 500 ) {
	    secs++;
	    tim.setMilliseconds(0);
	    tim.setSeconds(secs);
	}
	if ( st.millisShowing ) {
	    st.millis.style.visibility = "";
	    st.millis.previousSibling.previousSibling.style.visibility = "";
	    st.millisShowing = false;
	}
    }

    st.hr.textContent = zeropad(tim.getHours(), 2);
    st.min.textContent = zeropad(tim.getMinutes(), 2);
    st.sec.textContent = zeropad(tim.getSeconds(), 2);

    dbg(-1,"tmupd done");
}

function begin_stop_within_tick(currTime) {
    window.clearInterval(slowTickerObj);
    slowTickerObj = null;
    tmupd(timenow, currTime);
    var but = document.getElementById("stopST");
    but.removeEventListener("click", stopST, false);
    but.textContent = "Stopped.";
    chg_color(timenow, "red");
    document.getElementsByTagName("body")[0].style.background = "rgb(40,0,0)";
    console.log("***+++*** Shutdown @ "+
		currTime.toTimeString()+
		" ***+++***");
}

function updTmObjs(nowtm) {
    
    var unixtm = nowtm.getTime();

    var i;
    for ( i in tmobj ) {
	var ob;
	var realoff;

	ob = tmobj[i];
	if ( ob ) {
	    ob = ob.st;
	    if ( ob !== undefined ) {
		realoff = ob.offFromReal;
		dbg(0, "in update, real offset "+realoff);
		if ( realoff !== null ) {
		    realoff *= 1000;
		    dbg(0,"adjust time with "+realoff);
		    ob.dtobj.setTime(unixtm+realoff);
		}
	    }
	}
    }
    
}


function slow_tick(tol) {
    var now = getNewDate();
    // next variable strictly for stats
    var entryTime = now.getTime();
    // get the msecs right away
    var msecs = now.getMilliseconds();
    var secs;
    var toNextEvt;

    dbg(0, "1s tick. "+secs);

    timenow.st.dtobj = now;

    if ( stopping ) {
	begin_stop_within_tick(now);
	return true;
    }

    if ( msecs > tol ) {
	dbg(2, "slow_tick(): tolerance ("+tol+") exceeded: "+msecs);
	outOfTolCnt += 10;
	if ( outOfTolCnt >= 30 ) {
	    outOfTolCnt = 0;
	    dbg(1, "slow_tick(): time slipped too many times, resync");
	    sync2ToS(tol);
	}
    }

    if ( outOfTolCnt > 0 ) {
	outOfTolCnt--;
    }

    updTmObjs(now);

    tmupd(utc);
    tmupd(timenow);
    tmupd(otatime);
    // tmupd(nxtbreaktm);

    toNxtEvt = nxtbreaktm.st.dtobj.getTime() -
	showRef.st.dtobj.getTime() + dispoff;
    time_from_millis(toNxtEvt, tilbreak);
    tmupd(tilbreak);

    elapsedStat.textContent = getNewDate().getTime() - entryTime;

}

function time_from_millis(millis, obj) {

    var tgt;
    var t = millis;
    var secs;
    var mins;
    var hrs;

    if ( obj.st !== undefined ) {
	tgt = obj.st;
    } else {
	tgt = obj;
    }

    tgt.dtobj.setMilliseconds(t % 1000);
    t = Math.floor(t / 1000);
    secs = t % 60;
    t = t - secs;
    mins = (t / 60) % 60;
    t = t - ( mins * 60 );
    hrs = t / ( 60 * 60 );

    tgt.dtobj.setSeconds(secs);
    tgt.dtobj.setMinutes(mins);
    tgt.dtobj.setHours(hrs);
}

function fasttick(tol) {
    var now = getNewDate();
    var msecs = now.getMilliseconds();

    if ( msecs < tol ) {
	window.clearInterval(fastTickerObj);
	fastTickerObj = null;
	if ( slowTickerObj !== null ) {
	    window.clearInterval(slowTickerObj);
	    slowTickerObj = null;
	}
	dbg(3, "Sync established.");
	syncing = 0;
	slowTickerObj = window.setInterval(slow_tick, 1000, tol);
	chg_color(timenow, timenow.st.color.normal.fg);
	// show an update before the interval "fires"
	slow_tick(tol);
    }
}

function sync2ToS(tolerance) {
/*

// A goal of this code is to have an accurate display of time, within
// a relatively tight tolerance.  A question and response on Stack
// Overflow has a GREAT suggestion about syncing time externally to
// the system on which JavaScript runs by simply having the Date
// object parse the Date: header in an HTTP(S) response.  This could
// be handy for syncing to at least the Web servers of the particular
// network for whom you're producing a real-time program (e.g. in
// 2017, the example I'm thinking of is named Premiere Networks,
// formerly Premiere Radio Networks, a subsidiary of iHeart Media,
// formerly named Clear Channel Communications).  This may change in a
// version later than Jun 2017, but this will rely on the local
// system's rendition of true time.  If this method is used, we will
// hand-wave top-of-second, and assume there is an integer number of
// seconds' difference between that remote Web server's time and the
// local time, thus the same top-of-second locally as remotely.  This
// is because the resolution of Date: is only one second.
//
// We can possibly get sub-second resolution of remote time.  As of
// this comment, there is at least:
//
//     http://www.time.gov/actualtime.cgi
//
// It has some optional parameters:
//
//     disablecache=1496679827438&__lzbc__=t2cvjw
//
// no idea what "__lzbc__" is, would seem to be some sort of nonce
// (basically, a pseudorandomly generated string).  "disablecache" is
// the number of microseconds since the Unix epoch.  The response XML
// looks something like:
//
//     <timestamp time="1496679827854493" delay="1495183148027055"/>
//
// If __lzbc__ is left off, it looks like you get an estimate of the
// number of microseconds delay between making the request and the Web
// site's response.
//
// The original idea for display updates was to do whatever updates,
// calcualtions, display changes, etc. (basically, the bulk of the
// work), sample the real time, calculate how much time remains until
// the next top-of-second, and schedule ourselves for that time with
// setTimeout(). Experimentation shows that trying to time each second
// precisely like that results in a TON of jitter.  The same basic
// thing happens with trying to use setTimeout() to wait until the
// top-of-second in order to setInterval() to implement a one second
// tick for display updating.  It seems the best one can really do is
// use a setInterval() with a relatively fast "tick" rate (say 50ms),
// sample the time on each tick, and if the time is plus/minus the
// desired accuracy interval, either do your updates/work then, or set
// up your setInterval() at that time.
//
// So as not to be doing a syscall every 50ms, I tried getting the
// current time (new Date().getMilliseconds()) and using that value as
// a "virtual" clock, and only actually doing new Date() in our "fast
// tick" when the time calculated from that virtual clock
//
//     virtclock += tickinterval
//
// would be within our tolerance interval. Experimentation showed that
// every now and again, doing the maths for our ToS sampling resulted
// in missing some ToSes, even with a window of two times plus or
// minus the ticking interval (so with our 50ms example, 100ms before
// through 100ms after ToS).  I could only get reliability by setting
// up a "fallback" setInterval(1000ms); initiated by setTimeout();,
// which is "ToS inaccurate" anyway. So the most sound strategy would
// seem to be to tick rapidly (e.g., 50ms), do an actual new Date();
// on each tick, and set a 1000ms interval near that discovered ToS.

*/

    if ( syncing ) {
	console.warn("already resyncing");
	return;
    }
    
    var toltype = typeof tolerance;
    if ( toltype == undefined ||
	 toltype == null ||
	 tolerance == undefined ) {
	tolerance = 75;
    }
    chg_color(timenow, timenow.st.color.oos.fg);
    syncing = 1;

    var interval = 20;

    if ( tolerance < interval ) {
	interval = tolerance >> 1;
    }

    if ( fastTickerObj !== null ) {
	window.clearInterval(fastTickerObj);
    }
    dbg(3, "about to sync with interval "+interval+", tolerance "+tolerance);
    fastTickerObj = window.setInterval(fasttick, interval, tolerance);
}



if (timenow !== null ) {
    ST_init();
}


