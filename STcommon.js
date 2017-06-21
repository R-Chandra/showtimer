
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

    var breaklist = new Array();
    
    breaklist = JSON.parse(localStorage.getItem(profname));
    if ( ! breaklist ) {
	console.log("load_breaks("+profname+"): came up empty.");
	return false;
    }
    // Just a historical note: The .begin and .end used to be Date()
    // objects, and of course, JSON records the date string instead of
    // an object.  Therefore, there used to be a loop here recreating
    // objects from strings.

    return breaklist;
}

function break_cmp(obja, objb) {
    return obja.begin - objb.begin;
}
