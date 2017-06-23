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

function dbg(lvl, msg) {
    if ( lvl >= dbug ) {
	console.log(lvl+": "+msg);
    }
    return true;
}

function zeropad(num, places) {
    var s = num.toString();
    var i;

    while ( s.length < places ) {
	s = "0" + s;
    }

    return s;
}


var brk;

function load_breaks(profname) {

    // Load the breaks list from the localStorage key named
    // "profname" and return it.  Historical note: this used
    // to append "_breaks" to the key name, but then that did
    // not allow for the idea of a profile backup name.

    var breaklist = new Array();
    
    breaklist = JSON.parse(localStorage.getItem(profname));
    if ( ! breaklist ) {
	console.log("load_breaks("+profname+"): came up empty.");
	return false;
    }
    // Just a historical note: The .begin and .end used to be Date()
    // objects, and of course, JSON records the date string instead of
    // an object.  Therefore, there USED TO BE a loop here recreating
    // objects from strings.

    return breaklist;
}

function break_cmp(obja, objb) {
    // When sorting the brk array (the break descriptions), this
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
    // form an hours, minutes, seconds string from "insecs" number of seconds
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
    // take string "str" which is in the format hours:minutes:seconds and
    // convert that to a number of seconds.  Zero, one, or two colons are
    // allowed.  Any characters other than the digits and a colon make this
    // function return false.  Also if minutes or seconds are greater than
    // 59 will cause a return of false.

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
	    // add the next digit by shifting the result so
	    // far by one decimal place and add current one
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

