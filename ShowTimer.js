
// alert("top.");

dbug = 2;

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
var brk;
var brkidx = -1;
var remind = new Array();
var showBegin;
showBegin = getNewDate();

// we'll assume the show begins today...
showBegin.setHours(14);
showBegin.setMinutes(6);
showBegin.setSeconds(0);
showBegin.setMilliseconds(0);

// showBegin.setHours(new Date().getHours());
// showBegin.setMinutes(new Date().getMinutes()+2);


var showState;
var showPrevState; // helps with transitions
var showLen;
var showEnd;
// 16:57:50 - 14:06:00 = 10310 seconds
showLen = 10310;
var etab = new Array(); // event table
var etabidx; // current index into etab; advanced when time > etab[].when

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

showBegin.setHours(14+get_show_start_hour_offset());

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

function handle_blink(which) {
    // A color object has severl members for what state one wants to
    // be presented, so "which" points to one of the members (oos,
    // onAir, soon, etc.).  This makes the time displayed by the HTML
    // block enclosing "which" to appear to blink by alternating
    // between the blink fg/bg and normal fg/bg.  This function is the
    // callback/recipient arg of setInterval(), so it must look at the
    // blink state to know to which colors to change.

    var htm = which.parent.parent.parent;
    var fg, bg;

    if ( which.blink.state === BLINK_BLINK ) {
	fg = which.blink.fg;
	bg = which.blink.bg;
	which.blink.state = BLINK_NORM;
    } else {
	fg = which.fg;
	bg = which.bg;
	which.blink.state = BLINK_BLINK;
    }
    htm.style.color = fg;
    htm.style.background = bg;
	
}

function beginBlink(which) {
    // Initiate blinking of the style "which".  As the color object
    // has links to the parent object, we can find the HTML block
    // which needs the .style.color... attributes changed.

    var tmr = which.blink.timer; // not a ref, only current value!!
    var period = which.blink.millis;

    // might happen that we call this twice; cancel any blinking and
    // resync
    if ( tmr !== null ) {
	endBlink(which);
    }

    which.blink.timer = setInterval(handle_blink, period, which);
    return true;
}

function endBlink(which) {
    // End the blinking going on with "which," and restore the
    // coloration to which.parent.currentColor

    var hblk = which.parent.parent.parent;

    if ( which.blink.timer !== null ) {
	clearInterval(which.blink.timer);
	which.blink.timer = null;
    }

    chg_color(hblk, which.parent.currentColor);
}

function chg_milli_state(evt) {
    // This receives the change event where the user toggles the "show
    // milliseconds" checkbox
    var tgt = evt.target;

    dbg(2, "target is "+tgt);
    var chkd = tgt.getAttribute("checked");

    dbg(2, "status of showMillis checkbox is "+tgt.checked);

    showMillis = tgt.checked;

    return true;
}

const BLINK_NORM = 0, // blink state normal fg/bg colors
      BLINK_BLINK = 1; // blink state alternate colors

function colorObj(parentObj, fg, bg, blinkfg, blinkbg, blinkmilli) {

    // This is the constructor for an instance of a "color descriptor"
    // object.  The "fg" member (the foreground color, i.e., the color
    // of the text) gets set to arg "fg", the "bg" member (background
    // color) gets set to the arg "bg", etc.  It also creates a
    // "blink" object, which describes the fg/bg color when the item
    // is blinking.  "blink" also holds the return from setInterval(),
    // or null if it's not in use (clearInterval() called).
    // blink.millis is the rate at which setInterval() should call the
    // handler.  "parentObj" is the parent object so that given the
    // descriptor, we can find the HTML block which needs the color
    // changes.

    this.blink = new Object();
    this.fg = fg;
    this.bg = bg;

    // Here there used to be code so that if the blink colors were
    // sent in as zero length (null?) strings, the normal colors would
    // be copied to the blink colors, thus causing no blinking even
    // though blinking was requested.  Instead, keep it blank, which
    // would mean alternating between CSS-imposed coloration and
    // another color (from the base fg/bg colors).

    this.blink.fg = blinkfg;
    this.blink.bg = blinkbg;
    // "timer" is to hold the setInterval() result
    this.blink.timer = null;
    // "count" intended to automatically stop blinking in the
    // blink handler after some time or iteration count
    this.blink.count = 0;
    this.blink.millis = blinkmilli;
    // start off blinking when initally starting to blink, transition
    // to BLINK_NORM after blink.millis msecs
    this.blink.state = BLINK_BLINK;
    this.parent = parentObj;

    return this;
}


function stObj(parentObj) {
    // constructor for the "Show Timer" (st) object.
    //
    // We send in the parent node object so that we can limit the
    // scope of querySelector() to only this object (not sure if
    // this.parentNode gets us where we need to be)

    var co = new Object();
    // characteristics for out of synchronization
    co.oos = new colorObj(co, "pink", "black", "", "", 500);
    // blink slowly with "onAir" colors in state BUMP_IN,
    co.onAir = new colorObj(co, "limegreen", "black",
				    "darkgreen", "black", 1500);
    co.soon = new colorObj(co, "yellow", "black", "", "", 500);
    co.verysoon = new colorObj(co, "red", "black", "black", "red", 500);
    // special case of "revert to CSS" styling by setting fg = bg = ""
    co.revertCSS = new colorObj(co, "", "", "", "", 1000);
    co.parent = this;
    co.currentColor = co.onAir;
    this.color = co;
    // not that we'd split hairs (really only timing to a second), but
    // to avoid lots of multiplies by 1000 in the tick handler, express
    // times in seconds, but ST_init() will make these milliseconds.
    this.soon = 30;
    this.verysoon = 10;
    this.bumplen = 30; // how long the BUMP_IN state lasts
    this.parent = parentObj;

    this.dtobj = new Date(0);
    this.offFromReal = null;
    // for easy access, point to some HTML nodes
    this.hr = parentObj.querySelector("[data-st-role=hr]");
    this.min = parentObj.querySelector("[data-st-role=min]");
    this.sec = parentObj.querySelector("[data-st-role=sec]");
    this.millis = parentObj.querySelector("[data-st-role=millis]");
    this.millisShowing = false;

    this.state = 0;

    return this;
}

function add_events(unixms, begend) {
    // Every event on a high level (starting the show, going to break,
    // coming back from a break, ending the show) causes multiple
    // state changes.  This routine takes a time "unixms" (in
    // milliseconds since the epoch) and appends entries to the etab[]
    // event table.  "begend" tells whether these events are being
    // appended for the transition states beginning ("b") a break or
    // ending ("e") a break.
    //
    // TODO: look for events and either not add them or delete them if
    // events which are appended for an etab[].begin would overlap the
    // previous events for the previous etab[].end

    // debatable here whether the timings should come from showRef
    // (wherever it points) or the timer object itself (e.g.,
    // tmtilbreak)

    var soon = showRef.st.soon;
    var vsoon = showRef.st.verysoon;
    var soonst; // state for soon time
    var vsoonst; // state for very soon time
    var lastst; // last state appended
    var lastms; // msec since the epoch of last state
    var unixsoon;
    var unixvsoon;

    if ( begend === "b" ) {
	soonst = TIME_SHORT;
	vsoonst = TIME_VERY_SHORT;
	lastst = IN_BREAK;
	lastms = unixms;
    } else if ( begend === "e" ) {
	soonst = BUMP_SOON;
	vsoonst = BUMP_VERY_SOON;
	lastst = ON_AIR;
	lastms = unixms + showRef.st.bumplen * 1000;
    } else {
	console.warn('add_events() unexpected arg "'+begend+'"');
	return false;
    }

    // var tmp = dbug;
    // dbug = 0;
    unixsoon = unixms - (soon * 1000);
    unixvsoon = unixms - vsoon * 1000;
    dbg(0, "pushing soon: "+soon+"/"+unixsoon+
	" state "+soonst+" ("+state2str(soonst)+")");
    etab.push( { when: unixsoon,
		 state: soonst
		 // debugging info: human-readable time for this event
		 , evtTimestr: new Date(unixms - soon * 1000).toTimeString()
	       } );
    dbg(0, "pushing very soon: "+vsoon+"/"+unixvsoon+
	" state "+vsoonst+" ("+state2str(vsoonst)+")");
    etab.push( { when: unixvsoon,
		 state: vsoonst
		 // debugging info: human-readable time for this event
		 , evtTimestr: new Date(unixms - vsoon * 1000).toTimeString()
	       } );
    if ( lastst === ON_AIR ) {
	dbg(0, "pushing bumper playing: "+unixms+" state BUMP_IN");
	etab.push( { when: unixms,
		     state: BUMP_IN
		     // debugging info: human-readable time for this event
		     , evtTimestr: new Date(unixms).toTimeString()
		   } );
    }
    dbg(0, "pushing last state: "+lastms+" state "+state2str(lastst));
    etab.push( { when: lastms,
		 state: lastst
		 // debugging info: human-readable time for this event
		 , evtTimestr: new Date(lastms).toTimeString()
	       } );

    // dbug = tmp;
}



function ST_init(argv) {

    // initialize a session.  This involves attaching event listeners
    // to the controls, finding some of the elements, setting the
    // beginning time of the show, fetching the breaks/reminders,
    // building the events list from those breaks, attaching a Show
    // Timer (st) object to the timing elements, determining the state
    // of the show based on the current time (we may have had to
    // restart mid-show), and kick off the seconds ticking.

    var i, l, o, now, unixnow;
    var b;
    var showBeginMs;

    now = getNewDate();

    dbg(0, "started ST_init at "+now.toTimeString());

    stopping = false;

    elapsedStat = document.getElementById("tickHandleTime");

    // In case someone (a developer in the debugger?) restarts the
    // app, make sure the default background returns
    document.body.style.background = "";

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

    otatime.st.offFromReal = OTAoff;
    otatime.st.color.onAir.fg = ""; // fallback to CSS
    otatime.st.color.onAir.bg = ""; // fallback to CSS

    nxtbreaktm.st.color.onAir.fg = ""; // fallback to CSS
    nxtbreaktm.st.color.onAir.bg = ""; // fallback to CSS

    showBeginMs = showBegin.getTime();
    showEnd = showBeginMs + showLen * 1000;

    // ... but if the show is alreay over, it must be tomorrow
    if ( now.getTime() > showEnd ) {
	showBegin.setDate(showBegin.getDate() + 1);
	showEnd = showBegin.getTime() + showLen * 1000;
    }
    showBeginMs = showBegin.getTime();

    add_events(showBeginMs, "e");

    brk = load_breaks("techguy_breaks");
    // so should we refuse to do anything if breaks didn't load?  For
    // this stage though, if the breaks loaded successfully, for our
    // purposes here, milliseconds since the Unix epoch are more
    // useful than the seconds which have been recorded.  This is
    // therefore the show beginning plus the offsets in brk[].
    if ( brk ) {
	
	var bb, be;

	l = brk.length;
	for ( i = 0; i < l; i++ ) {
	    b = brk[i];
	    bb = b.begin * 1000; // break beginning
	    bb += showBeginMs;
	    add_events(bb, "b");
	    be = b.end * 1000;   // break end
	    be += showBeginMs;
	    add_events(be, "e");
	}
    }

    add_events(showEnd, "b");
    l = etab.length;
    etab[l - 1].state = SHOW_DONE;
    // The last state is really before the next show, but
    // this last state is simpler.

    unixnow = now.getTime() + showRef.st.offFromReal * 1000;

    if ( unixnow < etab[0].when ) {
	// current time is before the event table even begins.
	// Checking for it explicitly avoids a comparison with
	// etab[-1].
	showState = BEFORE_SHOW;
	nxtbreaktm.st.dtobj = new Date(showBeginMs);
	etabidx = 0;
    } else {
	etabidx = 0;
	dbg(2, "Unix now: "+new Date(unixnow).toTimeString());
	while ( unixnow > etab[etabidx + 1].when &&
		etab[etabidx + 1].state !== SHOW_DONE ) {
	    dbg(2, "--- skipping over "+(etabidx+1)+" ("+
		new Date(etab[etabidx].when).toString()+", "+
		state2str(etab[etabidx].state)+")");
	    etabidx++;
	}
	showState = etab[etabidx].state;
	i = etabidx;
	while ( etab[i].state !== BUMP_IN &&
		etab[i].state !== IN_BREAK &&
		etab[i].state !== SHOW_DONE ) {
	    i++;
	}
	nxtbreaktm.st.dtobj = new Date(etab[i].when);
    }

    dbg(2, " ST_init: determined show state is "+state2str(showState));
    var newCol = st2col(showState);
    chg_color(tmtilbreak, tmtilbreak.st.color[newCol].fg);

    // think this upd is done in slow tick() anyway. Times were that
    // this was not the case, but it was added later
    // tmupd(nxtbreaktm);

    sync2ToS();

    dbg(0, "leaving ST_init");

}

// timenow.innerHTML = "This worked.";

function updDbg(newLvl) {
    // This receives the change event from the blank used to
    // dynamically update the debugging level
    var lvl = parseInt(newLvl);
    dbug = lvl;
    console.log("++++++++New debug level (dbug) set to "+dbug+".");
    return true;
}

function updFudge(ffactObj) {
    // This receives the change event from the blank used to
    // dynamically update the display timing fudge factor
    if ( ffactObj.value == "" ) {
	ffactObj.value = "0";
    }
    dispoff = parseInt(ffactObj.value);
    ffactObj.value = dispoff;
    dbg(-8, "updFudge(): 'this' is "+this+" and myself is "+updFudge);
}

function chg_color(obj, newcolor) {
    // change the color of "obj" to "newcolor".
    // If newcolor is a string, change the foreground color
    // If newcolor is a color object, change the fg and bg, and
    // set the currentColor to newcolor

    var ctyp = typeof newcolor;

    if ( ctyp === "string" ) {
	obj.style.color = newcolor;
    } else if ( ctyp === "object" ) {
	newcolor.parent.currentColor = newcolor;
	obj.style.color = newcolor.fg;
	obj.style.background = newcolor.bg;
    } else {
	console.warn("chg_color() arg not string or object, instead "+ctyp);
	return false;
    }

    return true;

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
    // This gets called from an appropriate place within slow tick()
    // when something has set the "stopping" Boolean to true.  It
    // essentially shuts everything down by clearing the tick then
    // cleaning up anything on the display, such as stopping blinking
    // and so forth.  Then it turns a lot of the elements red,
    // indicating "stop".

    window.clearInterval(slowTickerObj);
    slowTickerObj = null;
    tmupd(timenow, currTime);
    var o;
    var i;
    for ( i in tmobj ) {
	o = tmobj[i];
	dbg(1, "stopping obj "+o);
	for ( var c in o.st.color ) {
	    dbg(1, "   stopping color "+c);
	    if ( c !== "currentColor" &&
		 c !== "parent" ) {
		var bstop = o.st.color[c];
		dbg(2, "stop blink on "+bstop+" which is "+c);
		endBlink(bstop);
	    }
	}
    }
    var but = document.getElementById("stopST");
    but.removeEventListener("click", stopST, false);
    but.textContent = "Stopped.";
    chg_color(timenow, "red");
    chg_color(tmtilbreak, "red");
    document.getElementsByTagName("body")[0].style.background = "rgb(40,0,0)";
    console.log("***+++*** Shutdown @ "+
		currTime.toString()+
		" ***+++***");
}

function updTmObjs(nowtm) {

    // update timer objects.  Its main job is to update the dtobj
    // (date/time object) according to its prescribed offset from real
    // time, so that something can take this and update the display.
    
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

    // This is the receiver of the "main" timer tick (setInterval())
    // event.  "tol" specifies the tolerance in ms that the system
    // will tolerate before declaring that the display is out of sync
    // and therefore needs a resync.  That's done by fetching the time
    // and seeing how many milliseconds past top-of-second have
    // occurred.  (Reminder, this needs to apply the global timing
    // offset, so it does not call new Date() directly for that.)
    // It needs this parameter in case it needs to go back to fast
    // ticking, to "feed the current tolerance figure back in."  After
    // determining the time until the next begin/break/back-to-show
    // event, it also detects if we have met or exceeded the next
    // event in the event queue (or TODO: put up the next reminder at
    // an appropriate time), and initiate processing (changing colors,
    // initiating or ending blinking, etc.) for an event if it's been
    // reached or passed.  Also, just for monitoring purposes, it
    // measures and displays how many milliseconds it is spending in
    // this tick handler, which might be used to tune the global
    // timing offset or the display offset.


    Var now = getNewDate();
    // next variable strictly for stats
    var entryTime = now.getTime();
    // get the msecs right away
    var msecs = now.getMilliseconds();
    var secs;
    var unixms;
    var toNextEvt;

    dbg(0, "1s tick.");

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

    unixms = showRef.st.dtobj.getTime();
    dbg(1, "   deciding at "+etabidx+": "+unixms);
    dbg(1, "                  "+etab[etabidx].when);
    if ( unixms >= etab[etabidx].when ) {
	// we've reached an event time
	var newState;
	var nxtVisEvt; // next visible event in nxtbreaktm

	newState = etab[etabidx].state;
	dbg(2, "state change reached, new state at "+
	    etabidx+": "+newState+" ("+state2str(newState)+")");
	if ( newState === SHOW_DONE ) {
	    // show has ended
	    stopping = true;
	    return true;
	}
	if ( newState === IN_BREAK ||
	     newState === BUMP_IN ) {
	    if ( newState === IN_BREAK ) {
		// if now in break, find next time for bumper music
		nxtVisEvt = BUMP_IN;
	    } else {
		// if now bumping in, find next break (or end of show?)
		nxtVisEvt = IN_BREAK;
	    }
	    i = etabidx;
	    dbg(2, "seeking from "+newState+" to "+nxtVisEvt);
	    dbg(2, " (from "+state2str(newState)+" to "+
		state2str(nxtVisEvt)+")");
	    while ( etab[i].state !== nxtVisEvt &&
		    etab[i].state !== SHOW_DONE ) {
		i++;
	    }
	    nxtbreaktm.st.dtobj = new Date(etab[i].when);
	}

	var newCol = st2col(newState);
	chg_color(tmtilbreak, tmtilbreak.st.color[newCol]);

	showPrevState = showState;
	showState = newState;

	if ( newState === BUMP_VERY_SOON ||
	     newState === TIME_VERY_SHORT ) {
	    beginBlink(tmtilbreak.st.color.verysoon);
	} else if ( newState === IN_BREAK ) {
	    endBlink(tmtilbreak.st.color.verysoon);
	    // seems the blink handler was getting in one last lick, and
	    // making the text red on black.
	    // let CSS take over
	    tmtilbreak.style.color = "";
	    tmtilbreak.style.background = "";
	} else if ( newState === BUMP_IN ) {
	    endBlink(tmtilbreak.st.color.verysoon);
	    beginBlink(tmtilbreak.st.color.onAir);
	} else if ( newState === ON_AIR ) {
	    endBlink(tmtilbreak.st.color.onAir);
	}

	etabidx++;
    }

    toNxtEvt = nxtbreaktm.st.dtobj.getTime() - showRef.st.dtobj.getTime();

    var ms = toNxtEvt % 1000;
    if ( ms >= 500 ) {
	// round off to seconds
	toNxtEvt += 1000 - ms;
    }
    time_from_millis(toNxtEvt, tmtilbreak);
    tmupd(tmtilbreak);

    elapsedStat.textContent = getNewDate().getTime() - entryTime;

}

function time_from_millis(millis, obj) {

    // given "millis" milliseconds, set the hours, minutes, and
    // seconds for the date/time object (dtobj) in "obj".  Since this
    // is intended to show countdowns, if the answer is negative,
    // return right away and thus refuse to convert it.

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

    // This function receives the setInterval() event for rapid
    // ticking, trying to set off a slower, once per second tick, but
    // only after the top-of-second (ToS), withing "tol" (tolerance)
    // milliseconds past the ToS.  This is after applying the global
    // timing offset, so new Date() is not called directly.

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
	chg_color(timenow, timenow.st.color.onAir.fg);
	// with "", do whatever CSS says?
	// chg_color(timenow, "");
	// show an update before the slow interval "fires"
	slow_tick(tol);
    }
}

function sync2ToS(tolerance) {

    // This changes the displays slightly to indicate we're out of
    // sync, then starts up the fast ticking timer, handing it
    // "tolerance" ms as the timing tolerance goal.  It'll stop any
    // fast ticking in progress to start anew, but if the global
    // "syncing" is set, it won't try to sync again, it'll simply
    // return because a sync2ToS is already in progress.  The default
    // for "tolerance" is 75 ms.

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


// make sure the timenow page element was found, and
// set the program in motion if so.
if (timenow !== null ) {
    ST_init();
}


