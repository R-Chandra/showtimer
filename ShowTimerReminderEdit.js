
var showBegin = 14 * 60 * 60 + 6 * 60; // show starts at 6 mins past the hour

var localOff = get_show_start_hour_offset();

showBegin += (localOff * 60);

dbug = 3;

var profinp = document.getElementById("prof");
var currprof;
var backup_checkbox = document.getElementById("getbackup");
var fetchmsg = document.getElementById("fetchmsg");
var commitmsg = document.getElementById("commitmsg");
var remindproto = document.getElementById("remindproto");
var remindarea = document.getElementById("reminders");
var proflist = document.getElementById("profiles");
var exparea = document.getElementById("export");
var remind = new Array();

function fill_export_area() {

    // Export the reminders list to the export text area "exparea" as
    // JSON representing the "remind" reminders list.  If there is already
    // something in there, we PROBABLY don't want to overwrite it, so
    // check to see if there's anything there first, and confirm with
    // the user if not empty.

    if ( exparea.value.length > 0 ) {
	if ( ! confirm("The import/export area is nonempty.  Are you SURE?") ) {
	    return false;
	}
    }
    exparea.value = JSON.stringify(remind);
    return true;
}

function slurp_export_area() {

    // The export (and actually import) area "exparea" is assumed to
    // contain JSON representing the remind[] reminders list.  Obviously
    // the minimum sized list would be "[]" so check to see if the
    // size in the textarea is at least 2.

    // NOTE: At this timeNo error checking is done above and beyond
    // what JSON.parse will do, so you could end up with a totally
    // invalid reminders list.  It's assumed you "know what you're
    // doing."

    var xarea = exparea.value;

    if ( xarea.length < 2 ) {
	alert("doesn't look like there's anything to import.");
	return false;
    }

    xarea = xarea.replace(/^[ 	]*var[ 	]*defaultremind[ 	]*=[ 	]*/, "");
    // alert("you have: >"+xarea+"<");

    if ( remind.length > 0 ) {
	if ( ! confirm("Overwrite current reminders list?") ) {
	    return false;
	}
    }
    remind = JSON.parse(xarea);
    refresh_reminders();
}

function verify_reminder_list(ol) {

    // This approves the contents of "ol" as an array of .begin
    // members.  For now, it checks if there are any reminders at all,
    // and that they do not start at the same time.  It returns either
    // the null string "" (all is OK) or an error string of what went
    // wrong.

    var r, nr, i, l;

    l = ol.length;
    if ( l === 0 ) {
	console.warn("Not useful to have an empty reminder list.");
	return "no loaded reminders!!!";
    }

    l--; // always comparing with i + 1, so do not go "off the end"
    for ( i = 0; i < l; i++ ) {
	r = ol[i];
	nr = ol[i + 1];
	if ( r.begin === nr.begin ) {
	    console.warn("Reminder time at "+i+" the same.");
	    return "Reminders "+i+" and "+(i+1)+" are at the same time.";
	}
    }

    return "";
}

function commit2localStorage(clickevt) {

    // This receives the click event from the "commit" button.
    // First, back up the profile to "<name>_reminders_bak"
    // Then JSON.stringify the remind array and put it at "<name>_reminders"
    
    var profname = profinp.value;
    var errmsg;

    dbg(1, "]]]]]] requesting commit to profile "+profname);

    // check to see if a profile name has been entered
    if ( profname === undefined ||
	 profname === null ||
	 profname === "" ) {
	commitmsg.textContent = "must have a profile name to which to save!";
	return false;
    }
    errmsg = verify_reminder_list(remind);
    if ( errmsg !== "" ) {
	commitmsg.textContent = errmsg;
	return false;
    }

    commitmsg.textContent = "saving backup";
    // This might throw an error if the original does not exist yet...or
    // may return "null".  When I ran it once, all I saw was the "saving backup"
    // message so I'm assuming this is where it stopped.
    try {
	localStorage.setItem(profname+"_reminders_bak",
			     localStorage.getItem(profname+"_reminders"));
    } catch (err) {
	console.warn("Profile backup did not succeed: "+err);
    }
    commitmsg.textContent = "saving profile";
    localStorage.setItem(profname+"_reminders", JSON.stringify(remind));
    commitmsg.style.color = "white";
    commitmsg.textContent = 'Profile "'+profname+'" saved to localStorage.';
    // This could have created a new profile, so update the list
    find_all_profiles();
    clear_msg_after_delay(commitmsg);
}

function find_fields(hobj) {

    // Find all the working fields in the HTML object "hobj"

    var r;

    dbg(0, "finding fields");

    r = hobj.querySelector("span[name=remindnumdisp]");
    hobj.remindnumdisp = r;
    r = hobj.querySelector("input[name=reminderbegin]");
    hobj.remindbegin = r;
    r = hobj.querySelector("span[name=locbegin]");
    hobj.locbegin = r;
    r = hobj.querySelector("input[name=remindertxt]");
    hobj.remindertxt = r;
    r = hobj.querySelector("span[name=beginerr]");
    hobj.beginerr = r;
    r = hobj.querySelector("button[name=save]");
    hobj.savebut = r;
    r = hobj.querySelector("button[name=samePlusHr]");
    hobj.repl = r;
    r = hobj.querySelector("button[name=undo]");
    hobj.undo = r;
    r = hobj.querySelector("button[name=rm]");
    hobj.rm = r;
    r = hobj.querySelector("span[name=miscmsg]");
    hobj.miscmsg = r;

}

function upd_local(evt) {

    // update the local begin time based on receiving the change event
    // described by "evt"

    var blk;
    var beg;

    blk = evt.target.dataroot;
    beg = hms2secs(blk.remindbegin.value);
    blk.locbegin.textContent = secs2hmsStr(showBegin + beg);
}

function prepare_reminder_form(pgnode) {

    // Given the HTML page node "pgnode", prepare it for use by
    // attaching the change and click event handlers to the
    // appropriate sub-elements.  If by some programming chance there
    // are events already attached, remove these event listeners.


    var i, l;
    var pgelt; // page elements within pgnode (input fields)
    var e; // an individual element from pgelt[]
    var r; // specific reminder from remind[] array

    r = remind[pgnode.remindpos];

    find_fields(pgnode);

    pgnode.remindnumdisp.textContent = pgnode.remindpos;

    try {
	pgnode.remindbegin.removeEventListener("change", upd_local, false);
	pgnode.savebut.removeEventListener("click", save_to_remind, false);
	pgnode.repl.removeEventListener("click", repl_remind_adding_hr, false);
	pgnode.undo.removeEventListener("click", perform_undo, false);
	pgnode.rm.removeEventListener("click", delete_remind, false);
    } catch (err) {
    }

    pgnode.remindbegin.addEventListener("change", upd_local, false);
    pgnode.savebut.addEventListener("click", save_to_remind, false);
    pgnode.repl.addEventListener("click", repl_remind_adding_hr, false);
    pgnode.undo.addEventListener("click", perform_undo, false);
    pgnode.rm.addEventListener("click", delete_remind, false);

    pgnode.remindbegin.value = secs2hmsStr(r.begin);
    pgnode.locbegin.textContent = secs2hmsStr(showBegin + r.begin);
    pgnode.remindertxt.value = r.txt;

    // If the structure of the page changes (such as adding or
    // removing sections of the reminder prototype), the node where
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


function ins_blank_rem() {

    // Create a blank reminder form so when filled in and saved, can be
    // added to the remind[] array (which will eventually be committed to
    // localStorage)

    var pgblk;
    var nremind = new Object();
    var i, l;
    var pgelt;
    var e;

    i = remind.length;
    if ( i > 0 ) {
	nremind.begin = remind[i-1].begin + 60;
    } else {
	nremind.begin = 0;
    }
    nremind.txt = "live read";
    remind[i] = nremind;

    pgblk = remindproto.cloneNode(true);
    pgblk.removeAttribute("id");
    // pgblk.removeAttribute("style");
    pgblk.remindpos = i;
    prepare_reminder_form(pgblk);
    pgblk.setAttribute("class", "alteredReminder");
    remindarea.appendChild(pgblk);
}

function refresh_reminders(ret) {

    // refresh the nodes on the page with the current remind[] list
    // optional parameter "ret" is the HTML node corresponding to
    // remind[ret] (primarily so a message can be put in that HTML block)

    var nremind;
    var i, l;
    var thisReminderBegin;

    dbg(1, "in refresh reminders");

    // NOTE: we really should be doing some checking, like two
    // reminders with the same begin time.  Overlapping, well...maybe

    if ( ret !== undefined ) {
	thisReminderBegin = remind[ret].begin;
    } else {
	thisReminderBegin = ret;
    }

    remind.sort(reminder_cmp);
    nremind = new Array();
    l = remind.length;
    for ( i = 0; i < l; i++ ) {
	remindobj = remind[i];
	dbg(0, ">>>> considering reminder "+i+" which is "+remindobj);
	// looking to not copy deleted items to the new array
	if ( remindobj !== null && remindobj !== undefined ) {
	    dbg(0, ">>>>>>>> pushing");
	    nremind.push(remindobj);
	}
    }
    remind = nremind;
    dbg(0, "I have my new reminders list");
    return populate_page(thisReminderBegin);
}

function repl_remind_adding_hr(evt) {

    // This is the click event receiver ("evt") for the "dup + 1 hr"
    // button, so "replicate reminder, adding one hour"

    var remindelt;
    var remindidx;
    var beg;
    var nremind;
    var i, l;
    var remindobj;

    remindelt = evt.target.dataroot;
    remindidx = remindelt.remindpos;

    nremind = new Object();
    nremind.begin = remind[remindidx].begin + 60 * 60;
    nremind.txt = remind[remindidx].txt;
    remind.push(nremind);

    remindobj = refresh_reminders(remind.length - 1);
    remindobj.scrollIntoView();
    remindobj.remindbegin.focus();
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

    // intended for the callback of a setTimeout() to clear text after
    // a time has elapsed. The node could disappear before it times
    // out, so catch the error

    try {
	where.textContent = "";
	where.style.color = "";
	where.style.background = "";
    } catch(err) {
	dbg(2, "  Could not clear text message: "+err+". sorry.");
    }
}

function flag_unsaved(evt) {

    // This changes the appearance of an altered reminder entry so that
    // it is visually apparent that it needs to be saved.  Also
    // unsurprisingly, this activates the "undo" button.

    var blk;

    if ( typeof evt.target === "object" ) {
	blk = evt.target.dataroot;
    } else {
	blk = evt;
    }

    blk.setAttribute("class", "alteredReminder");
    blk.undo.setAttribute("class", "undoAvail");
    blk.undo.removeAttribute("disabled");

}

function perform_undo(evt) {
    
    // back out any changes made to the reminder input.  This is the
    // receiver of a button click event "evt"

    var remindelt;
    var remindidx;

    remindelt = evt.target.dataroot;
    prepare_reminder_form(remindelt);
    remindelt.removeAttribute("class");
    remindelt.undo.removeAttribute("class");
    remindelt.undo.setAttribute("disabled", "true");
}

function save_to_remind(evt) {

    // This receives the click event "evt" when the user clicks on the
    // "save" button for a reminder.  It will update fields and displays
    // as required, do some minimal error checking, and save it to the
    // remind array.  Then the display gets updated by "redrawing all the
    // reminders" with refresh_reminders().

    var remindelt;
    var remindidx;
    var beg, txt;
    var nremind;
    var i, l;
    var remindobj;
    var remindnode;

    remindelt = evt.target.dataroot;
    remindidx = remindelt.remindpos;
    dbg(1, ">> save req of remind["+remindidx+"]");
    beg = hms2secs(remindelt.remindbegin.value);

    dbg(1, ">>> checking sanity");
    if ( beg ) {
	dbg(1, "Looks OK, setting");
	remind[remindidx].begin = beg;
	remind[remindidx].txt = remindelt.remindertxt.value;
    } else {
	dbg(1, "Reminder somehow unacceptable? b:"+beg);
	return false;
    }

    // remindelt.miscmsg.textContent = "saved.";
    // The refresh will kill this message, need to refresh then show msg 

    remindnode = refresh_reminders(remindidx);

    // refresh_reminders() can return "true" instead of an HTML object.
    // It should not at this point, but it may
    if ( typeof remindnode === "object" ) {
	remindelt = remindnode;
	dbg(0, "attempting update "+remindelt);
	remindelt.miscmsg.textContent = "Saved.";
	// Since the reminders list is sorted, if you just altered a
	// reminder so it shows up somewhere else, you won't
	// see the "saved" message.
	remindnode.scrollIntoView();
	clear_msg_after_delay(remindelt.miscmsg);
    }
}

function delete_remind(evt) {

    // This receives the click event "evt" from clicking a "DELETE!"
    // button, and removes this from remind[], and updates the page.  At
    // least for now, such a deletion is always confirmed (but I know
    // this can be tedious having to OK each deletion).

    var remindelt;
    var remindidx;

    remindelt = evt.target.dataroot;
    remindidx = remindelt.remindpos;

    msg = "Delete reminder beginning at "+remindelt.remindbegin.value+", are you SURE?";
    if ( confirm(msg) ) {
	delete(remind[remindidx]);
	// nothing yet, but soon
    }
    refresh_reminders();
}


function populate_page(ret) {

    // populate the id="reminders" part of the page.  First, remove all
    // children, then clone and populate the "prototype entry node"
    // for each reminder.  The optionally supplied "ret" means to return
    // a reference to the HTML node which displays the reminder which has
    // a remind[??].begin time of "ret"

    var i, l, r;
    var pgblk, blkitem;
    var soughtnode = true; // if no node to return, just sort-of return "success"

    // empty out the display of reminders
    while ( (pgblk = remindarea.firstChild) ) {
	remindarea.removeChild(pgblk);
    }


    // put reminders from remind[] into the page by cloning the prototype
    l = remind.length;
    for ( i = 0; i < l; i++ ) {
	r = remind[i];
	dbg(1, "reminder "+i+" begin: "+r.begin+" msg: "+r.txt);
	pgblk = remindproto.cloneNode(true);
	pgblk.removeAttribute("id");
	pgblk.removeAttribute("style");
	pgblk.remindpos = i;
	prepare_reminder_form(pgblk);
	if ( ret !== undefined ) {
	    if ( r.begin === ret ) {
		soughtnode = pgblk;
	    }
	}
	remindarea.appendChild(pgblk);
    }

    return soughtnode;

}

function handle_fetch(evt) {

    // This receives the click event "evt" from clicking on the
    // "fetch" button, meant to fetch a profile from localStorage.  It
    // will optionally retrieve the previously committed profile by
    // appending "_bak" if the checkbox is checked.

    var i, l;
    var remindlist;
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

    profstr = currprof+"_reminders";
    getbk = backup_checkbox.checked;
    if ( getbk ) {
	profstr  += "_bak";
    }

    remindlist = load_reminders(profstr);
    if ( remindlist === false ) {
	fetchmsg.textContent = "Sorry, profile "+currprof+
	    (getbk ? " backup" : "" ) +" doesn't exist.";
	return false;
    }

    if ( remind.length > 0 ) {
	var ovr = confirm("Overwrite currently entered reminders?");
	if ( !ovr ) {
	    return false;
	}
    }

    dbg(1, " fetched reminders, assigning to \"master\" list");
    remind = remindlist;
    dbg(1, "  update (populate) the page");
    backup_checkbox.checked = false;
    exparea.value = "";
    populate_page();
    dbg(1, "    page supposedly populated.");
}


find_all_profiles();
