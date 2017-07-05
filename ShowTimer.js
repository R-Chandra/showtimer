
// alert("top.");

dbug = 2;

var globalRealOff = 0;
// global real offset; starts at zero, MAY be calculated at
// runtime, e.g. by invoking a Web service or something.
// Zero in effect means, "assume local clock is accurate"

var OTAoff = 40; // offset from real time to over the air
var showRef;     // the show reference time, whether local, UTC, etc.
showRef = otatime; // by default, make it OTA time
var brk;  // the list (array) of breaks
var brkidx = -1;  // index into brk for the current upcoming break
var remind = new Array(); // reminders (displayed in the message area)
var showBegin;   // date/time of the show's beginning
showBegin = getNewDate();

// we'll assume the show begins today...
// This embedded time is US/Eastern for "Léo Laporte, The Tech Guy"
showBegin.setHours(14);
showBegin.setMinutes(6);
showBegin.setSeconds(0);
showBegin.setMilliseconds(0);

// The following is to facilitate debugging of show open
// showBegin.setMinutes(new Date().getMinutes()+3);
// showBegin.setHours(new Date().getHours());

// correct the show start time for local timezone
showBegin.setHours(showBegin.getHours()+get_show_start_hour_offset());

var showState;  // in break, on the air, break is soon, etc.
var showPrevState; // helps with transitions
var showLen;  // show length in seconds
var showEnd;  // calculated show end in milliseconds (compare with .getTime())
// 16:57:50 - 14:06:00 = 10310 seconds
showLen = 10310;
var etab = new Array(); // event table
var etabidx; // current index into etab; advanced when time > etab[].when

// timing objects
var tmobj = new Array();

// opaque data type of return of setInterval(); may or may not truly be an object
// Just depends on browser implementation
var fastTickerObj = null;
var slowTickerObj = null;

// set this to true when you want the slow tick() routine to shut down the app
var stopping = false;
var outOfTolCnt = 0; // out of timing tolerance count
var syncing = 0; // in the process of syncing to top-of-second
var dispoff = 0; // display of time offset in milliseconds, can be negative
var showMillis = false; // should milliseconds be displayed?
var elapsedStat;  // place to store elapsed time statistic

function getNewDate() {
    // get the current time (new Date()), apply the timing offset
    // (globalRealOff), and return the resultant object
    dobj = new Date();
    dobj.setTime(dobj.getTime() + globalRealOff)

    return dobj;
}





function stopST(evt) {

    // This routine receives the click event of the stop button

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

const BLINK_NORM = 0, // blink state normal fg/bg colors
      BLINK_BLINK = 1; // blink state alternate colors

function handle_blink(which) {

    // A color object has several members for what state one wants to
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

    // Initiate blinking of the style "which" (soon, verysoon, etc.).
    // As the color object has links to the parent object, we can find
    // the HTML block which needs its .style.color... attributes
    // changed.

    var tmr = which.blink.timer; // not a ref to this property, only current value!!
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
    // scope of querySelector() to only this object

    var co = new Object();
    // characteristics for out of synchronization
    co.oos = new colorObj(co, "pink", "black", "", "", 500);
    // blink slowly with "onAir" colors in state BUMP_IN,
    co.onAir = new colorObj(co, "limegreen", "black",
				    "darkgreen", "black", 1500);
    co.soon = new colorObj(co, "yellow", "black", "", "", 500);
    co.verysoon = new colorObj(co, "red", "black", "black", "maroon", 500);
    // special case of "revert to CSS" styling by setting fg = bg = ""
    co.revertCSS = new colorObj(co, "", "", "", "", 1000);
    co.parent = this;
    co.currentColor = co.onAir;
    this.color = co;
    // not that we'd split hairs (really only timing to a second), but
    // to avoid lots of multiplies by 1000 in the tick handler, express
    // times in seconds, but ST init() will make these milliseconds.
    this.soon = 60;
    this.verysoon = 30;
    this.bumplen = 25; // how long the BUMP_IN state lasts
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

function stateful_chg_color(where) {

    // Based on the global showState, change the block referenced by
    // "where" to an appropriate member of its color property.

    var which = st2col(showState);
    var hobj;
    var colormember = where.st.color[which];

    if ( typeof where.hobj === "object" ) {
	hobj = where.hobj;
    } else {
	hobj = where;
    }
    
    dbg(1, "stateful change color of "+hobj+" to "+
	which+" ("+colormember.fg+")");
    return chg_color(where, colormember);

}

function set_reminder(remTxt) {

    // set the reminder portion of the page to reminder text "remTxt"
    // This is the setter function for remindermsg.txt

    remindermsg.textContent = remTxt;
    if ( remTxt !== "" ) {
	remindDismiss.style.visibility = "visible";
	beginBlink(remindermsg.st.color.onAir);
    }
    // This should probably go through the dismiss routine to do
    // things like stop the blinking process and such.  It could be
    // done here, but that would duplicate code, which is
    // problematic.  But handle-dismiss() is a click event handler,
    // sooooo...simulate a click by making an Event for it? It's
    // starting to get complicated, so for now, ***** PUNT  *****

    return true;
}

function get_reminder() {

    // this is the getter function for remindermsg.txt

    return remindermsg.textContent;

}

function handle_dismiss(evt) {

    // handle the click event "evt" on the "dismiss reminder" button

    var t = evt.target;

    endBlink(remindermsg.st.color.onAir);
    remind.shift();
    remindermsg.textContent = "";
    t.style.visibility = "hidden";

    return true;
}

function prepare_reminders(profname) {

    // prepare the list of reminders by fetching them from
    // localStorage under profile name "profname" (default
    // "techguy_reminders") and form the working list "remind" by
    // converting the seconds in .begin to "Unix" milliseconds based
    // on showBegin and copying the .txt member.  This is so minimal
    // processing has to be done in the slow tick handler

    var i, l;
    var unixms;
    var showBeginMs;
    var remindMs;

    // It's debatable if the app is restarted mid-show whether the
    // past reminders should be skipped or have them be manually
    // dismissed.  For example, if there is a reminder for a live read
    // which has not been performed but the browser exits, that live
    // read still needs to be done, eventually.  Perhaps dimissals
    // could be logged, and based on that, skipped.  But that adds a
    // lot of complexity.
    //
    // The policy will be, for now, to skip.

    unixms = getNewDate().getTime();
    showBeginMs = showBegin.getTime();

    if ( typeof profname === "undefined" ||
	 profname === null ||
	 profname === "" ) {
	profname = "techguy_reminders";
    }

    var remindlist = load_reminders("techguy_reminders");
    if ( remindlist === false ||
	 (l = remindlist.length) === 0 ) {
	// for whatever reasons, there are no reminders
	return false;
    }

    remind = new Array();
    for ( i = 0; i < l; i++ ) {
	remindMs = showBeginMs + remindlist[i].begin * 1000;
	if ( unixms < remindMs ) {
	    remind.push( { when: remindMs, txt: remindlist[i].txt } );
	}
    }
}



function ST_init(argv) {

    // initialize a session.  This involves attaching event listeners
    // to the controls, finding some of the elements, setting the
    // beginning time of the show, fetching the breaks/reminders,
    // building the events list from those breaks, attaching a Show
    // Timer (st) object to the timing elements, determining the state
    // of the show based on the current time (we may have had to
    // restart mid-show), load any reminders, and kick off the seconds
    // ticking.

    var i, l, o, now, unixnow;
    var b;
    var showBeginMs;
    var timernode;
    var timername;

    now = getNewDate();

    dbg(0, "started ST_init at "+now.toTimeString());

    stopping = false;

    elapsedStat = document.getElementById("tickHandleTime");

    if ( tmobj.length > 0 ) {
	clr_all_blink();
    }

    etab = new Array();
    etabidx = 0;

    timernode = document.querySelectorAll("[data-st-type=timer]");
    for ( o of timernode ) {
	timername = o.getAttribute("id");
	// unqualified variable names are properties of "window"
	window[timername] = document.getElementById(timername);
    }
    // NodeLists are only PARTIALLY arrays.  The other part is some
    // methods and other properties unsuitable for tmobj[], so we need
    // to copy the "array part" to tmobj.  Otherwise tmobj will be an
    // alias for timernode, which will wreak havoc in the "stop during
    // slow tick" function, looping through the objs to stop any
    // running blinking objs. "item" for example was being examined as
    // if it had an "st" structure, when it's a NodeList method.
    tmobj = new Array();
    l = timernode.length;
    for ( i = 0; i < l; i++ ) {
	tmobj[i] = timernode[i];
    }

    // In case someone (a developer in the debugger?) restarts the
    // app, make sure the default background returns
    document.body.style.background = "";

    // likewise change the label on the stop button
    o = document.getElementById("stopST");
    try {
	o.removeEventListener("click", stopST, false);
    } catch (err) {
    }
    o.addEventListener("click", stopST, false);
    o.textContent = "STOP!";

    o = document.getElementById("showms");
    try {
	o.removeEventListener("change", chg_milli_state, false);
    } catch (err) {
    }
    o.addEventListener("change", chg_milli_state, false);

    // Make the input field contents show what the program really
    // thinks to what those variables are set
    o = document.getElementById("dbgChanger");
    o.value = dbug;

    o = document.getElementById("fudge");
    o.value = dispoff;

    // initialize all the timer blocks
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
    otatime.st.color.onAir.fg = ""; // fall back to CSS
    otatime.st.color.onAir.bg = ""; // fall back to CSS

    nxtbreaktm.st.color.onAir.fg = ""; // fall back to CSS
    nxtbreaktm.st.color.onAir.bg = ""; // fall back to CSS

    // set up the reminder area
    remindDismiss = document.getElementById("remindDismiss");
    try {
	remindDismiss.removeEventListener("click", handle_dismiss,
					  false);
    } catch (err) {
    }
    remindDismiss.addEventListener("click", handle_dismiss, false);
    remindermsg.st.color.onAir.fg = "white";
    // "gray" does not provide enough contrast from "white"
    // so much to my chagrin, I'll use hex color description
    remindermsg.st.color.onAir.blink.fg = "#404040";
    remindermsg.st.color.onAir.blink.millis = 3000;
    Object.defineProperty(remindermsg,
			  "txt",
			  {
			      enumerable: true,
			      get: get_reminder,
			      set: set_reminder
			  });

    remindermsg.txt = "";

    showBeginMs = showBegin.getTime();
    showEnd = showBeginMs + showLen * 1000;

    // ... but if the show is alreay over, it must be tomorrow
    if ( now.getTime() > showEnd ) {
	showBegin.setDate(showBegin.getDate() + 1);
	showBeginMs = showBegin.getTime();
	showEnd = showBeginMs + showLen * 1000;
    }

    // The beginning of the show timing-wise and event-wise is like
    // coming back from (ending) a (really long) break.
    add_events(showBeginMs, "e");

    brk = load_breaks("techguy_breaks");

    // so should we refuse to do anything if breaks didn't load?  For
    // this stage though, if the breaks loaded successfully, for our
    // purposes here, milliseconds since the Unix epoch are more
    // useful than the seconds which have been recorded.  This is
    // therefore the show beginning plus the offsets in brk[].

    if ( brk ) {
	
	var bb, be; // break begin, break end

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

    // Similar to show begin, the show end is like entering a
    // break...just a SUPER long one of at least 21 hours
    add_events(showEnd, "b");

    l = etab.length;
    // corrrect the type of the very last event from add_events()
    etab[l - 1].state = SHOW_DONE;

    // The last state is really before the next show, but
    // a last state of "show done" is simpler.

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
	    dbg(1, "--- skipping over "+(etabidx+1)+" ("+
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

    stateful_chg_color(tmtilbreak);

    tmupd(nxtbreaktm);

    prepare_reminders();

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

function updGlobalTiming(newval) {

    // This function receives the change event for changing the global
    // timing offset (globalRealOff), to set it to "newval"

    var globalTmOff = parseInt(newval);

    if ( isNaN(globalTmOff) ) {
	console.warn("tried to set global timing offset to non-numeric: "+newval)
	return false;
    }

    globalRealOff = globalTmOff;

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

function clr_all_blink() {

    // cancel all blinking on all tmobj[] objects

    var o;
    var i;
    for ( i in tmobj ) {
	o = tmobj[i];
	dbg(1, "stopping obj "+o);
	for ( var c in o.st.color ) {
	    dbg(1, "   stopping blink for color class "+c);
	    if ( c !== "currentColor" &&
		 c !== "parent" ) {
		var bstop = o.st.color[c];
		dbg(1, "stop blink on "+bstop+" which is "+c);
		endBlink(bstop);
	    }
	}
    }
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
    clr_all_blink();
    var but = document.getElementById("stopST");
    but.removeEventListener("click", stopST, false);
    but.textContent = "Stopped.";
    chg_color(timenow, "red");
    chg_color(tmtilbreak, "red");
    tmtilbreak.st.dtobj.setSeconds(0);
    tmupd(tmtilbreak);
    document.body.style.background = "rgb(40,0,0)";
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


    var now = getNewDate();
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

    unixms = showRef.st.dtobj.getTime();

    if ( // there are reminders left...
	    remind.length > 0 &&
	    // ...and there isn't one being displayed...
	    remindermsg.txt === "" &&
	    // ..and it's at or past time to display one:
	    unixms >= remind[0].when ) {
	remindermsg.txt = remind[0].txt;
    }
    
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
	    dbg(2, "seeking from "+newState+" to "+nxtVisEvt+
		" (from "+state2str(newState)+" to "+
		state2str(nxtVisEvt)+")");
	    while ( etab[i].state !== nxtVisEvt &&
		    etab[i].state !== SHOW_DONE ) {
		i++;
	    }
	    nxtbreaktm.st.dtobj = new Date(etab[i].when);
	}

	showPrevState = showState;
	showState = newState;

	stateful_chg_color(tmtilbreak);

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
	    stateful_chg_color(timenow);
	}

	etabidx++;
	tmupd(nxtbreaktm);

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
	stateful_chg_color(timenow);
	stateful_chg_color(tmtilbreak);
	// show an update before the slow interval "ticks"
	slow_tick(tol);
    }
}

function sync2ToS(tolerance) {

    // This changes the displays slightly to indicate we're out of
    // sync, then starts up the fast ticking timer, handing it
    // "tolerance" ms as the timing tolerance goal.  It'll stop any
    // fast ticking in progress to start anew, but if the global
    // "syncing" is set, it won't try to sync again, it'll simply
    // return because a sync2ToS is already in progress.
    //
    // The default for "tolerance" is 100 ms.

    if ( syncing ) {
	console.warn("already resyncing");
	return;
    }
    
    var toltype = typeof tolerance;
    if ( toltype == undefined ||
	 toltype == null ||
	 tolerance == undefined ) {
	tolerance = 100;
    }
    chg_color(timenow, timenow.st.color.oos);
    chg_color(tmtilbreak, tmtilbreak.st.color.oos);
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



ST_init();


