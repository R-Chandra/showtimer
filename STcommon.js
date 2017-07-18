// STcommon.js : Show Timer common JavaScript
// This file should be included first, before module-specific JS.
//
// Example:
// <script type="text/javascript" src="STcommon.js"></script>
// <script type="text/javascript" src="edit_a_break.js"></script>
//
// This contains functions and variables used in all modules of
// the Show Timer.

var dbug = 3;

function get_show_start_hour_offset() {

    // This returns the number of hours difference between the
    // computer's configured local timezone and US/Eastern.  This
    // would depend on the browswer's implementatin of the Date
    // object's getTimezoneOffset() method.  US/Eastern is 5 hours
    // (300 minutes) behind UTC in January, and during daylight saving
    // time (DST), 240 minutes.  So for example, if the computer is
    // configured for US/Pacific time during DST, getTimezoneOffset()
    // will return 420, therefore 240-420 = -180, or 3 hours west of
    // EDT.  For the example of "The Tech Guy," this would be added to
    // 14 to produce 11, or 11 AM, which is the hour of the beginning
    // of the show in Petaluma.

    var now = new Date();
    var nowOff = now.getTimezoneOffset();
    now.setMonth(0);
    var JanOff = now.getTimezoneOffset();
    var EToff = 300;
    var localDiff;

    if ( nowOff !== JanOff ) {
	// We're under daylight saving time
	EToff = 240;
    }

    localDiff = EToff - nowOff;

    return localDiff / 60;
}

// symbolic states of the show
// This acts sort of like an enum in C

const BEFORE_SHOW = 0,
      BUMP_IN = 1, // technically ON_AIR, but while bumper music is playing
      ON_AIR = 2, // talent should be talking
      TIME_SHORT = 3, // break/end coming soon
      TIME_VERY_SHORT = 4, // break/end coming REALLY soon
      IN_BREAK = 5, // ad should be playing
      BUMP_SOON = 6, // ad still playing, but BUMP_IN approaching
      BUMP_VERY_SOON = 7, // ad still playing, but very near to BUMP_IN
      SHOW_DONE = 8;

// You could think of "after show" as "before show", as in, before
// the next show.  But SHOW_DONE marks the end of the precomputed
// events table.

function dbg(lvl, msg) {

    // This function is called for debugging.  "lvl" describes the
    // intended level of the message, from lower numbers being very
    // low level details, like every single member being added to a
    // complex structure, to higher numbers like general program
    // state.  If "lvl" is greater than or equal to the global
    // variable "dbug," the message (including its level and a colon)
    // goes to the debugging console, otherwise it's just ignored.
    // There are no constraints on "lvl" or "dbug", for example they
    // could be negative.

    if ( lvl >= dbug ) {
	console.log(lvl+": "+msg);
    }
    return true;
}

function zeropad(num, places) {

    // This takes "num" and pads with zeroes so that the result ends
    // up being "places" digits.  For example, positive seconds less
    // than 10 are typically preceeded by ":0".

    var s = num.toString();
    var i;

    while ( s.length < places ) {
	s = "0" + s;
    }

    return s;
}


var brk = [];  // the list of breaks

var remind = []; // list of reminders

function load_reminders(profname) {

    // Load the reminders list from the localStorage key named
    // "profname" and return it.  If the "profname" profile is not in
    // localStorage, see if "defaultremind" exists and prompt the user
    // to return that instead.

    // This is functionally equivalent to loading breaks (scrounge
    // around localStorage, JSON.parse() what's found), just with a
    // "reminders" instead of "breaks" suffix, and with a different
    // array destination, basically.  So reuse try_load_breaks()
    //
    // ******** D A N G E R **********
    //
    // If that routine changes, we'll have to do something else.

    var remindtab = try_load_breaks(profname);

    if ( remindtab !== false ) {
	return remindtab;
    }

    if ( typeof defaultremind !== "undefined" &&
	 Array.isArray(defaultremind) ) {
	console.warn('Tried to load reminders "'+profname+'" but that does not exist.');
	if ( confirm('Profile "'+profname.replace(/_reminders/, "")+'" not found in localStorage, load the default list instead?') ) {
	    return defaultremind;
	}
    }

    return false;
}


function load_breaks(profname) {

    // Load the breaks list from the localStorage key named
    // "profname" and return it.  Historical note: this used
    // to append "_breaks" to the key name, but then that did
    // not allow for the idea of a profile backup name.  If the
    // "profname" profile is not in localStorage, see if "defaultbrk"
    // exists and prompt the user to return that instead.

    var breaktab = try_load_breaks(profname);

    if ( breaktab !== false ) {
	return breaktab;
    }

    if ( typeof defaultbrk !== "undefined" &&
	 Array.isArray(defaultbrk) ) {
	console.warn('Tried to load breaks "'+profname+'" but that does not exist.');
	if ( confirm('Profile "'+profname.replace(/_breaks/, "")+'" not found in localStorage, load the default list instead?') ) {
	    return defaultbrk;
	}
    }

    return false;
}

function try_load_breaks(profname) {

    // This does the actual work of attempting to load the profile.
    // This was refactored because there are now two ways this can
    // fail to load the profile (return false), and I wanted an idea
    // of a built-in default breaks list.  So the "API" as it were is
    // to call "load_breaks()" and if we return false from
    // try_load_breaks(), load_breaks() sees if there exists a
    // "defaultbrk" array and returns that instead.  It's just a lot
    // handier this way, instead of longer if(){} blocks or a label.

    var breaklist = new Array();
    var breakListStr;

    try {
	breakListStr = localStorage.getItem(profname);
    } catch (err) {
	console.warn("could not access "+profname+" in localStorage: "+err);
	return false;
    }
    
    breaklist = JSON.parse(breakListStr);
    if ( ! breaklist ) {
	console.warn("try_load_breaks("+profname+"): came up empty.");
	return false;
    }

    // Just a historical note: The .begin and .end used to be Date()
    // objects, and of course, JSON records the date as a string
    // instead of an object.  Therefore, there USED TO BE a loop here
    // recreating objects from strings.  However, it did not seem
    // useful to keep them as objects, and instead they're offsets in
    // seconds from the start of the show.

    return breaklist;
}

function break_cmp(obja, objb) {

    // When sorting the brk array (the break descriptions), this
    // provides the comparison function to the .sort() method.

    return obja.begin - objb.begin;
}

function reminder_cmp(obja, objb) {

    // When sorting the remind array (the reminder descriptions), this
    // provides the comparison function to the .sort() method.

    return obja.begin - objb.begin;
}

function secs2minsec(insecs) {

    // Form a minutes:seconds string from "insecs" number of seconds,
    // if possible. This is visually nicer for break lengths than full
    // hh:mm:ss.  If the hours: portion is nonzero, return it.

    var str = "";
    var hrs;

    // Centralize this conversion by calling the hms converter (JUST
    // in case the format changes or a bug is discovered).  It is
    // admittedly a little inefficient in terms of computation.

    str = secs2hmsStr(insecs);
    hrs = str.substring(0,2);
    if ( hrs === "00" ) {
	// drop the "00:"
	str = str.substring(3);
	if ( str.charAt(0) === "0" ) {
	    // drop the leading zero
	    str = str.substring(1);
	}
    }

    return str;
}


function secs2hmsStr(insecs) {

    // form an hours, minutes, seconds string (hh:mm:ss) from "insecs"
    // number of seconds.  Each portion of the results is zero padded
    // to 2 digits.

    var str = "";
    var t = insecs;
    var secs,mins,hrs;

    secs = t % 60;
    t = Math.floor(t/60);
    mins = t % 60;
    t = Math.floor(t/60);
    str += zeropad(t, 2)
    str += ":";
    str += zeropad(mins, 2)
    str += ":";
    str += zeropad(secs, 2)

    return str;
}

function hms2secs(str) {

    // Take string "str" which is in the format hours:minutes:seconds and
    // convert that to a number of seconds.  Zero, one, or two colons are
    // allowed.  Any characters other than the digits and a colon make this
    // function return false.  Also if minutes or seconds are greater than
    // 59 will cause a return of false.  A colon followed by nothing
    // assumes zero, so for example "4:" means four minutes.

    var secs = 0;
    var c, l, i;
    var coloncnt = 0;
    var val; // intermediate value while walking along the string
    var hms = new Array(); // hours, minutes, seconds as accumulated

    dbg(0, "  hms2secs(): converting "+str);

    val = 0;
    l = str.length;
    for ( i = 0; i < l; i++ ) {
	c = str.charAt(i);
	dbg(0, "    considering "+c+" at "+i+" ("+val+")");
	if ( c === ":" ) {
	    if ( ++coloncnt > 2 ) {
		dbg(1, "    too many colons, "+coloncnt);
		return false;
	    }
	    dbg(0, "      processing colon, before "+val);
	    hms.push(val);
	    val = 0;
	} else if ( c < "0" || c > "9" ) {
	    dbg(1, "    char "+c+" not in range");
	    return false;
	} else {
	    // add the next digit by shifting the <result so
	    // far> by one decimal place and add current one
	    val *= 10;
	    val += parseInt(c);
	}
    }
    hms.push(val);

    while ( ++coloncnt < 3 ) {
	hms.unshift(0);
    }

    dbg(1, "  ready with hms len "+hms.length+" and hms "+hms);
    if ( hms[0] > 23 || hms[1] > 59 || hms[2] > 59 ) {
	dbg(1, "    something was too big");
	return false;
    }
    
    secs = hms[0] * 3600 + hms[1] * 60 + hms[2];

    return secs;
}

function state2str(st) {
    // Given state "st", what does the const look
    // like in the source?
    // Returns "unknown" if the number is out of range.
    const state = [ "BEFORE_SHOW",
		    "BUMP_IN",
		    "ON_AIR",
		    "TIME_SHORT",
		    "TIME_VERY_SHORT",
		    "IN_BREAK",
		    "BUMP_SOON",
		    "BUMP_VERY_SOON",
		    "SHOW_DONE" ];

    if ( st < BEFORE_SHOW ||
	 st > SHOW_DONE ) {
	return "unknown";
    } else {
	return state[st];
    }
}

function st2col(st) {

    // For state "st", which member of st.color should be
    // used for coloration of the HTML node?  If the state
    // is out of range, let CSS take over by returning "".

    const statetab =
	  [ "revertCSS", //"BEFORE_SHOW"
	    "onAir",     //"BUMP_IN"
	    "onAir",     //"ON_AIR"
	    "soon",      //"TIME_SHORT"
	    "verysoon",  //"TIME_VERY_SHORT"
	    "revertCSS", //"IN_BREAK"
	    "soon",      //"BUMP_SOON"
	    "verysoon",  //"BUMP_VERY_SOON"
	    "revertCSS"  //"SHOW_DONE"
	  ];

    if ( st < BEFORE_SHOW ||
	 st > SHOW_DONE ) {
	return "revertCSS";
    } else {
	return statetab[st];
    }
}

function find_all_profiles() {

    // finds all the profiles in localStorage and inserts <option>
    // elements into the node with an ID of "profiles" (expected to be
    // a <datalist> element)

    var i, l, k;
    var seen = new Array();
    var prof;
    var optproto = document.createElement("option");
    var opt;
    var profblk;

    var brksidx, klen;

    if ( typeof profiles !== "undefined" ) {
	profblk = profiles;
    } else {
	if ( (profblk = document.getElementById("profiles")) === null ) {
	    // If one isn't in the document already, provide one.
	    // Other JavaScript could likewise use appendChild to add
	    // an input field which utilizes this list.
	    profblk = document.createElement("datalist");
	    document.body.appendChild(profblk);
	}
    }

    // empty out any existing options
    while ( (opt = profblk.firstChild) !== null ) {
	profblk.removeChild(opt);
    }

    l = localStorage.length;
    for ( i = 0; i < l; i++ ) {
	k = localStorage.key(i);
	klen = k.length;
	dbg(1, "got key "+k+" length "+klen);
	prof = k.replace(/_(break|param|reminder)s(_bak[0-9]*)?$/, "");
	if ( ! seen.includes(prof) ) {
	    dbg(1,"*** so added from key "+k+" the profile "+prof);
	    seen.push(prof);
	    opt = optproto.cloneNode(false);
	    opt.textContent = prof;
	    profblk.appendChild(opt);
	}
    }
}

