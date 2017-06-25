
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
var showLen;
// 16:57:50 - 14:06:00 = 10310 seconds
showLen = 10310;

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
    this.hr = parentObj.querySelector("[data-st-role=hr]");
    this.min = parentObj.querySelector("[data-st-role=min]");
    this.sec = parentObj.querySelector("[data-st-role=sec]");
    this.millis = parentObj.querySelector("[data-st-role=millis]");
    this.millisShowing = false;

    this.state = 0;

    // return this;
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

    timenow.st.dtobj = new Date(now.getTime());
    utc.st.offFromReal = timenow.st.dtobj.getTimezoneOffset() * 60;
    // alert("initializing time: "+timenow.st.dtobj.toTimeString());

    otatime.st.offFromReal = OTAoff;

    // yet another trap was here. "=" makes a reference to the "now"
    // Date() obj, it does not create a new obj, which is what's
    // really needed here.
    showBegin = new Date(now.getTime());
    // we'll assume the show begins today...
    showBegin.setHours(14);
    showBegin.setMinutes(6);
    showBegin.setSeconds(0);
    showBegin.setMilliseconds(0);


    var showEnd = showBegin.getTime() + showLen * 1000;

    // ... but if the show is alreay over, it must be tomorrow
    if ( now.getTime() > showEnd ) {
	showBegin.setDate(showBegin.getDate() + 1);
    }
    
    nxtbreaktm.st.dtobj = showBegin;

    tmupd(nxtbreaktm);

    sync2ToS();

    dbg(0, "leaving ST_init");

    brk = load_breaks("techguy_breaks");

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

function tmupd(blk) {
    // update block "blk" on the page (an HTML object with a ".data-st"
    // member).  This does NOT update anything else, only those things
    // related to display of the time.  For example, this is not the
    // routine which updates the dtobj.
    
    var st = blk.st;

    // Since we're likely going to update several page elements, let's
    // give the renderer a break by temporarily taking "blk" off the
    // page.
    blk.style.visibility = "hidden";

    // really, we need to "decouple" the dtobj from the process of
    // displaying that time, so we need a new Date obj.  There is no
    // clone method for Date objects, so the best you can do is make
    // another one and initialize its time to the time of the other.

    // It was funny when I made the mistake of altering the time to
    // the next break.  The display jumped all over the place.

    var tim = new Date(st.dtobj.getTime());

    var milli = tim.getMilliseconds();
    tim.setMilliseconds(milli+dispoff);
    millis = tim.getMilliseconds();
    var secs = tim.getSeconds();

    if ( showMillis ) {
	st.millis.style.visibility = "visible";
	// Want the "." between seconds and millis to become visible.
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

    blk.style.visibility = "";

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
    chg_color(tmtilbreak, "red");
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
    tmupd(nxtbreaktm);

    toNxtEvt = nxtbreaktm.st.dtobj.getTime() -
	showRef.st.dtobj.getTime();
    var ms = toNxtEvt % 1000;
    if ( ms >= 500 ) {
	// round off to seconds
	toNxtEvt += 1000 - ms;
    }
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

    if ( millis < 0 ) {
	return false;
    }

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


