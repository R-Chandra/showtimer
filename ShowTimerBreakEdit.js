
var showBase = 14 * 60 * 60 + 6 * 60; // show starts at 6 mins past the hour

dbug = 1;

var profinp = document.getElementById("prof");
var currprof;
var backup_checkbox = document.getElementById("getbackup");
var fetchmsg = document.getElementById("fetchmsg");
var commitmsg = document.getElementById("commitmsg");
var brkproto = document.getElementById("breakproto");
var brkarea = document.getElementById("breaks");
var proflist = document.getElementById("profiles");
var exparea = document.getElementById("export");
var brk = new Array();

function fill_export_area() {

    // Export the breaks list to the export text area "exparea" as
    // JSON representing the "brk" breaks list.  If there is already
    // something in there, we PROBABLY don't want to overwrite it, so
    // check to see if there's anything there first, and confirm with
    // the user if not empty.

    if ( exparea.value.length > 0 ) {
	if ( ! confirm("The import/export area is nonempty.  Are you SURE?") ) {
	    return false;
	}
    }
    exparea.value = JSON.stringify(brk);
    return true;
}

function slurp_export_area() {

    // The export (and actually import) area "exparea" is assumed to
    // contain JSON representing the brkp[] breaks list.  Obviously
    // the minimum sized list would be "[]" so check to see if the
    // size in the textarea is at least 2.

    // NOTE: At this timeNo error checking is done above and beyond
    // what JSON.parse will do, so you could end up with a totally
    // invalid breaks list.  It's assumed you "know what you're
    // doing."

    if ( exparea.value.length < 2 ) {
	alert("doesn't look like there's anything to import.");
	return false;
    }

    if ( brk.length > 0 ) {
	if ( ! confirm("Overwrite current breaks list?") ) {
	    return false;
	}
    }
    brk = JSON.parse(exparea.value);
    refresh_breaks();
}

function commit2localStorage(clickevt) {

    // This receives the click event from the "commit" button.
    // First, back up the profile to "<name>_breaks_bak"
    // Then JSON.stringify the brk array and put it at "<name>_breaks"
    
    var profname = profinp.value;

    dbg(1, "]]]]]] requesting commit to profile "+profname);

    // check to see if a profile name has been entered
    if ( profname === undefined ||
	 profname === null ||
	 profname === "" ) {
	commitmsg.textContent = "must have a profile name to which to save!";
	return false;
    } else if ( brk.length === 0 ) {
	commitmsg.textContent = "no loaded breaks to save!!!";
	return false;
    } else {
	commitmsg.textContent = "";
    }
    commitmsg.textContent = "saving backup";
    // This might throw an error if the original does not exist yet...or
    // may return "null".  When I ran it once, all I saw was the "saving backup"
    // message so I'm assuming this is where it stopped.
    try {
	localStorage.setItem(profname+"_breaks_bak",
			     localStorage.getItem(profname+"_breaks"));
    } catch (err) {
	console.warn("Profile backup did not succeed: "+err);
    }
    commitmsg.textContent = "saving profile";
    localStorage.setItem(profname+"_breaks", JSON.stringify(brk));
    commitmsg.style.color = "white";
    commitmsg.textContent = 'Profile "'+profname+'" saved to localStorage.';
    // This could have created a new profile, so update the list
    find_all_profiles();
    clear_msg_after_delay(commitmsg);
}

function secs2hm(insecs) {
    // form a minutes:seconds string from "insecs" number of seconds
    // this is visually nicer for break lengths than full hh:mm:ss
    var str = "";
    var t = insecs;
    var secs,mins,hrs;

    secs = t % 60;
    t = Math.floor(t/60);
    mins = t % 60;

    return mins + ":" + zeropad(secs, 2);
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

function find_fields(hobj) {
    var b;

    dbg(0, "finding fields");

    b = hobj.querySelector("span[name=brknumdisp]");
    hobj.brknumdisp = b;
    b = hobj.querySelector("input[name=brkbegin]");
    hobj.brkbegin = b;
    b = hobj.querySelector("span[name=locbegin]");
    hobj.locbegin = b;
    b = hobj.querySelector("input[name=brklensecs]");
    hobj.brklensecs = b;
    b = hobj.querySelector("input[name=brklentime]");
    hobj.brklentime = b;
    b = hobj.querySelector("button[name=timecalc]");
    hobj.timecalcbut = b;
    b = hobj.querySelector("button[name=secscalc]");
    hobj.secscalcbut = b;
    b = hobj.querySelector("input[name=brkend]");
    hobj.brkend = b;
    b = hobj.querySelector("span[name=locend]");
    hobj.locend = b;
    b = hobj.querySelector("button[name=save]");
    hobj.savebut = b;
    b = hobj.querySelector("span[name=beginerr]");
    hobj.beginerr = b;
    b = hobj.querySelector("span[name=calcErr]");
    hobj.calcErr = b;
    b = hobj.querySelector("button[name=save]");
    hobj.savebut = b;
    b = hobj.querySelector("button[name=samePlusHr]");
    hobj.repl = b;
    b = hobj.querySelector("button[name=undo]");
    hobj.undo = b;
    b = hobj.querySelector("button[name=rm]");
    hobj.rm = b;
    b = hobj.querySelector("span[name=miscmsg]");
    hobj.miscmsg = b;

}

function upd_local(evt) {

    var blk;
    var beg;

    blk = evt.target.dataroot;
    beg = hms2secs(blk.brkbegin.value);
    blk.locbegin.textContent = secs2hmsStr(beg + showBase);
}

function prepare_break_form(pgnode) {

    var i, l;
    var pgelt; // page elements within pgnode (input fields)
    var e; // an individual element from pgelt[]
    var b; // specific break from brk[] array
    var brlen; // calculated length of break in seconds

    b = brk[pgnode.brkpos];

    find_fields(pgnode);

    pgnode.brknumdisp.textContent = pgnode.brkpos;

    try {
	pgnode.brkbegin.removeEventListener("change", upd_local, false);
	pgnode.timecalcbut.removeEventListener("click", calc_end, false);
	pgnode.secscalcbut.removeEventListener("click", calc_end, false);
	pgnode.savebut.removeEventListener("click", save_to_brk, false);
	pgnode.repl.removeEventListener("click", repl_brk_adding_hr, false);
	pgnode.undo.removeEventListener("click", perform_undo, false);
	pgnode.rm.removeEventListener("click", delete_brk, false);
    } catch (err) {
    }

    pgnode.brkbegin.addEventListener("change", upd_local, false);
    pgnode.timecalcbut.addEventListener("click", calc_end, false);
    pgnode.secscalcbut.addEventListener("click", calc_end, false);
    pgnode.savebut.addEventListener("click", save_to_brk, false);
    pgnode.repl.addEventListener("click", repl_brk_adding_hr, false);
    pgnode.undo.addEventListener("click", perform_undo, false);
    pgnode.rm.addEventListener("click", delete_brk, false);

    pgnode.brkbegin.value = secs2hmsStr(b.begin);
    pgnode.locbegin.textContent = secs2hmsStr(b.begin + showBase);
    pgnode.brkend.value = secs2hmsStr(b.end);
    pgnode.brkend.dataroot = pgnode;
    pgnode.locend.textContent = secs2hmsStr(b.end + showBase);

    brlen = b.end - b.begin;
    pgnode.brklensecs.value = brlen;
    pgnode.brklentime.value = secs2hm(brlen);

    // If the structure of the page changes (such as adding or
    // removing sections of the break prototype), the node where
    // the data are being saved can change relative to (parentNode)
    // the node we get in an event handler.  Therefore, tack
    // on a "dataroot" member to the <input> and <button> elements.

    pgelt = pgnode.querySelectorAll("input");
    l = pgelt.length
    for ( i = 0; i < l; i++ ) {
	e = pgelt[i];
	// event listener might not exist yet; may be redoing this node
	try {
	    e.removeEventListener("change", flag_unsaved, false);
	} catch (err) {
	}
	e.addEventListener("change", flag_unsaved, false);
	e.dataroot = pgnode;
    }

    pgelt = pgnode.querySelectorAll("button");
    l = pgelt.length
    for ( i = 0; i < l; i++ ) {
	e = pgelt[i];
	e.dataroot = pgnode;
    }

}


function ins_blank_brk() {
    var pgblk;
    var nbrk = new Object();
    var i, l;
    var pgelt;
    var e;

    i = brk.length;
    if ( i > 0 ) {
	nbrk.begin = brk[i-1].end + 60;
	nbrk.end = nbrk.begin + 60;
    } else {
	nbrk.begin = 0;
	nbrk.end = 60;
    }
    brk[i] = nbrk;

    pgblk = brkproto.cloneNode(true);
    pgblk.removeAttribute("id");
    // pgblk.removeAttribute("style");
    pgblk.brkpos = i;
    prepare_break_form(pgblk);
    pgblk.setAttribute("class", "alteredBreak");
    brkarea.appendChild(pgblk);
}

function refresh_breaks(ret) {
    // refresh the nodes on the page with the current brk[] list
    // optional parameter "ret" is the HTML node corresponding
    // to brk[ret]

    var nbrk;
    var i, l;
    var thisBreakBegin;

    dbg(1, "in refresh breaks");

    // NOTE: we really should be doing some checking, like two
    // breaks with the same begin time.  Overlapping, well...maybe

    if ( ret !== undefined ) {
	thisBreakBegin = brk[ret].begin;
    } else {
	thisBreakBegin = ret;
    }

    brk.sort(break_cmp);
    nbrk = new Array();
    l = brk.length;
    for ( i = 0; i < l; i++ ) {
	brkobj = brk[i];
	dbg(0, ">>>> considering break "+i+" which is "+brkobj);
	if ( brkobj !== null && brkobj !== undefined ) {
	    dbg(0, ">>>>>>>> pushing");
	    nbrk.push(brkobj);
	}
    }
    brk = nbrk;
    dbg(0, "I have my new breaks list");
    return populate_page(thisBreakBegin);
}

function repl_brk_adding_hr(evt) {
    var brkelt;
    var brkidx;
    var beg, end;
    var nbrk;
    var i, l;
    var brkobj;

    brkelt = evt.target.dataroot;
    brkidx = brkelt.brkpos;

    nbrk = new Object();
    nbrk.begin = brk[brkidx].begin + 60 * 60;
    nbrk.end = brk[brkidx].end + 60 * 60;
    brk.push(nbrk);

    brkobj = refresh_breaks(brk.length - 1);
    brkobj.scrollIntoView();
    brkobj.brkbegin.focus();
}

function clear_msg_after_delay(txtnode) {

    // Clear the message put into "txtnode" after a delay Previously,
    // this used to be a bunch of setTimeout() calls sprinkled
    // throughout the code; this consolidates all that into one place
    // so that things like a settable timeout length can be set in ONE
    // place, and also to simplify writing it (less typing).  For
    // right now, it'll be a fixed 5000 msec.

    window.setTimeout(clear_txt, 5000, txtnode);

}


function clear_txt(where) {
    // intended for the callback of a setTimeout() to clear text after a time
    // The node could disappear before it times out, so catch the error

    try {
	where.textContent = "";
	where.style.color = "";
	where.style.background = "";
    } catch(err) {
	dbg(2, "  Could not clear text message: "+err+". sorry.");
    }
}

function flag_unsaved(evt) {

    var blk;

    if ( typeof evt.target === "object" ) {
	blk = evt.target.dataroot;
    } else {
	blk = evt;
    }

    blk.setAttribute("class", "alteredBreak");
    blk.undo.setAttribute("class", "undoAvail");
    blk.undo.removeAttribute("disabled");

}

function perform_undo(evt) {
    
    var brkelt;
    var brkidx;

    brkelt = evt.target.dataroot;
    prepare_break_form(brkelt);
    brkelt.removeAttribute("class");
    brkelt.undo.removeAttribute("class");
    brkelt.undo.setAttribute("disabled", "true");
}

function save_to_brk(evt) {
    var brkelt;
    var brkidx;
    var beg, end;
    var nbrk;
    var i, l;
    var brkobj;
    var brknode;

    brkelt = evt.target.dataroot;
    brkidx = brkelt.brkpos;
    dbg(1, ">> save req of brk["+brkidx+"]");
    beg = hms2secs(brkelt.brkbegin.value);
    end = hms2secs(brkelt.brkend.value);
    len = end - beg;

    dbg(1, ">>> checking sanity");
    if ( beg && end && chkBrkLen(brkelt, len) ) {
	dbg(1, "Looks OK, setting");
	brk[brkidx].begin = beg;
	brk[brkidx].end = end;
    } else {
	if ( beg > end ) {
	    brkelt.calcErr.textContent = "Can't end a break before you've begun! (calc?)";
	}
	dbg(1, "Break somehow unacceptable? b:"+beg+" e:"+end+" l:"+len);
	return false;
    }

    // brkelt.miscmsg.textContent = "saved.";
    // The refresh will kill this message, need to refresh then show msg 

    brknode = refresh_breaks(brkidx);

    // refresh_breaks() can return "true" instead of an HTML object.
    // It should not at this point, but it may
    if ( typeof brknode === "object" ) {
	brkelt = brknode;
	dbg(0, "attempting update "+brkelt);
	brkelt.miscmsg.textContent = "Saved.";
	// Since the breaks list is sorted, if you just altered a
	// break so it shows up somewhere else, you won't
	// see the "saved" message.
	brknode.scrollIntoView();
	clear_msg_after_delay(brkelt.miscmsg);
    }
}

function chkBrkLen(hobj, val) {
    // Check to see that "val" seems like a valid break length.  It's
    // arbitrary, but thinking breaks shorter than 10 secs and
    // greater than 30 mins are very improbable.  We get passed
    // "hobj" (HTML object) so that we can stuff an error message
    // there if needed, in the "calcErr" area.
    if ( val === false || val < 10 || val > (30 * 60) ) {
	hobj.calcErr.textContent = "That's not looking like a valid length.";
	return false;
    } else {
	hobj.calcErr.textContent = "";
	return true;
    }
}

function calc_end(evt) {

    var calcreq; // string (from button) of what type of calc was requested
    var brkelt; // HTML <div> element of break to do calcs
    var brkidx; // index into brk[] for this break
    var beg; // beginning of break seconds offset (e.g., brk[i].begin)
    var end; // end of break seconds offset
    var len; // calculated break length

    calcreq = evt.target.getAttribute("name");
    dbg(1, calcreq+" calculation requested.");
    brkelt = evt.target.dataroot;
    brkidx = brkelt.brkpos;
    beg = hms2secs(brkelt.brkbegin.value);
    

    if ( ! beg ) {
	brkelt.beginerr.textContent = "That doesn't look like a valid beginning time.";
	return false;
    } else {
	brkelt.beginerr.textContent = "";
    }

    if ( calcreq === "timecalc" ) {
	len = hms2secs(brkelt.brklentime.value);
	dbg(1, "   chose to calc with time string, brk len "+len);
	if ( chkBrkLen(brkelt, len) ) {
	    brkelt.brklensecs.value = len;
	    dbg(1, "  set seconds too");
	} else {
	    return false;
	}
	dbg(1, "   done with by mins:secs");
    } else {
	len = parseInt(brkelt.brklensecs.value);
	if ( chkBrkLen(brkelt, len) ) {
	    brkelt.brklentime.value = secs2hm(len);
	} else {
	    return false;
	}
	dbg(1, "   so I'm supposed to add on "+len);
    }
    end = secs2hmsStr(beg+len);

    dbg(0, "break #"+brkidx+" is at "+brkelt.brkbegin.value+" which is +"+beg);
    dbg(0, "    new end "+end);
    brkelt.locbegin.textContent = secs2hmsStr(showBase + beg);
    brkelt.brkend.value = end;
    brkelt.locend.textContent = secs2hmsStr(showBase + beg + len);
}


function delete_brk(evt) {
    var brkelt;
    var brkidx;

    brkelt = evt.target.dataroot;
    brkidx = brkelt.brkpos;

    msg = "Delete break beginning at "+brkelt.brkbegin.value+", are you SURE?";
    if ( confirm(msg) ) {
	delete(brk[brkidx]);
	// nothing yet, but soon
    }
    refresh_breaks();
}


function populate_page(ret) {

    // populate the id="breaks" part of the page.  First, remove all
    // children, then clone and populate the "prototype entry node"
    // for each break.  The optionally supplied "ret" means to return
    // a reference to the HTML node which displays the break which has
    // a brk[??].begin time of "ret"

    var i, l, b;
    var pgblk, blkitem;
    var brlen;
    var soughtnode = true; // if no node to return, just sort-of return "success"

    // empty out the display of breaks
    while ( (pgblk = brkarea.firstChild) ) {
	brkarea.removeChild(pgblk);
    }


    // put breaks from brk[] into the page by cloning the prototype
    l = brk.length;
    for ( i = 0; i < l; i++ ) {
	b = brk[i];
	dbg(1, "break "+i+" begin: "+b.begin+" end: "+b.end);
	pgblk = brkproto.cloneNode(true);
	pgblk.removeAttribute("id");
	pgblk.removeAttribute("style");
	pgblk.brkpos = i;
	prepare_break_form(pgblk);
	if ( ret !== undefined ) {
	    if ( b.begin === ret ) {
		soughtnode = pgblk;
	    }
	}
	brkarea.appendChild(pgblk);
    }

    return soughtnode;

}

function handle_fetch(evt) {
    var i, l;
    var brklist;
    var profstr;
    var getbk = false;

    currprof = profinp.value;
    if ( currprof === undefined ||
	 currprof === null ||
	 currprof === "" ) {
	fetchmsg.textContent = "Must work with SOME profile name.";
	return false;
    } else {
	fetchmsg.textContent = "";
    }

    profstr = currprof+"_breaks";
    getbk = backup_checkbox.checked;
    if ( getbk ) {
	profstr  += "_bak";
    }

    brklist = load_breaks(profstr);
    if ( brklist === false ) {
	fetchmsg.textContent = "Sorry, profile "+currprof+
	    (getbk ? " backup" : "" ) +" doesn't exist.";
	return false;
    }

    if ( brk.length > 0 ) {
	var ovr = confirm("Overwrite currently entered breaks?");
	if ( !ovr ) {
	    return false;
	}
    }

    dbg(1, " fetched breaks, assigning to \"master\" list");
    brk = brklist;
    dbg(1, "  update (populate) the page");
    backup_checkbox.checked = false;
    exparea.value = "";
    populate_page();
    dbg(1, "    page supposedly populated.");
}

function find_all_profiles() {

    var i, l, k;
    var optproto = document.createElement("option");
    var opt;

    var brksidx, klen;

    // empty any existing options
    while ( (opt = profiles.firstChild) !== null ) {
	profiles.removeChild(opt);
    }

    l = localStorage.length;
    for ( i = 0; i < l; i++ ) {
	k = localStorage.key(i);
	klen = k.length;
	dbg(0, "got key "+k+" length "+klen);
	if ( (brksidx = k.indexOf("_breaks")) > 0 &&
	     brksidx == klen - 7 ) {
	    dbg(0,"*** so added from key "+k);
	    opt = optproto.cloneNode(false);
	    opt.textContent = k.replace(/_breaks/, "");
	    profiles.appendChild(opt);
	}
    }
}


find_all_profiles();
