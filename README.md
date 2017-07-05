# showtimer
an HTML5 app to help radio/netcast talent and producers to time their shows (warnings for ad breaks)

# "Quick start" guide

Load ShowTimer.html into your HTML5 browser (tested with Firefox 54.0 and Chrome 59.0.3071.115 on Ubuntu 64-bit, as well as Chrome and Dolphin on a Nexus 7 running Android 4.4.4). Be sure to allow JavaScript (e.g. if NoScript or similar is in use).  A known issue for Chrome and possibly other browsers (not Firefox) is that access to localStorage from file:/// URIs is a security violation.  If these files are served off an HTTP server instead (for example, webfs), Chrome is not known to have that issue.  More explanation on operation is later in this README.

# the "why"

Many moons ago, when he was performing his Premiere Networks radio show, Léo Laporte used to "miss" his ad breaks...to the extent that he was getting complaints from (I think) affiliates who were saying he was talking over station promos or such-like, which are supposed to be played (generally by automation) at very specific times, but still during the liner (e.g. "LLULINER" on the Premiere charts).  (You can see the charts as of this post at [Premiere's Engineering site](http://engineering.premiereradio.com/files/pages/showclocks.html) , under the labels "Leo Laporte (Satur|Sun)day".  They're PDFs.)  It says on the charts that the breaks after segments 1 and 3 every hour may float, but recently Léo explained during a break (over the twit.tv and twit.am streams) that if he didn't treat them as hard breaks, he'd "never" get them in.

So what Léo did was create an Android app that would, in really large numbers, and coded in colors, tell him the state of the show (something like blue numbers for in a break or before the show, green for supposed to be on-air, and red when getting close to time for a break).  That was a big help to him, but it is a very specific program.  If Premiere were to change the time(s) he has to break, he would have to recompile and redeploy the app to his tablet.

Shortly after he showed/explained his app, this repository's original author thought, why limit this to just a specific Android app?  Why not generalize this by using HTML and JavaScript?  The author had tossed around some ideas of how that might be implemented, using localStorage for example to retain the information about the show beginning and each break.  In June, 2017, the author began creating this from scratch.  The ONLY goal was to recreate the functionality of that Android app, to "time" a specific show with all hard breaks, and to make visual changes when nearing time for a break.  This app does not seek to replicate the appearance of Léo's app though; it has more things displayed (such as real time, over-the-air (OTA) time, as well as a countdown--most importantly, a minutes:seconds display instead of raw number of seconds).  Sure, the countdown is rendered larger than most of the rest, but the other stuff would be added as the author thought to be practical and interesting.  (As an example, it has been discussed occasionally during the show breaks that "OTA time" is real time plus 40 seconds, primarily to give the boardop time to dump bad audio such as swearing.  So the OTA clock time shows 40 seconds into the future.)

# Basic operation

When ShowTimer.html is first loaded, it attempts to load JSON encoded techguy_breaks and techguy_reminders from localStorage.  If a list doesn't exist but there is a default list available, the user is prompted to confirm use of the "built-in" list.  It then turns the local time and the countdown timer pink while it synchronizes to the local computer's "top of second."  Once that is achieved, these two parts of the display revert to their "normal" colors.

The program then tries to determine in what state the show should be given the "OTA time" (which for now is fixed at real time plus 40 seconds)...whether that's before the show, in a break, on the air, etc.  If the local time for "today" is "after the show," it assumes the show timing is for tomorrow, and if left, counts down to that time, several hours if necessary.  For describing the general operation, let's assume we invoke the program some time more than 3 minutes before the show begins.

The beginning of the show is treated as an arbitrarily long "break," and colors the countdown timer in cyan (by default; can be changed in the .css file).  When the countdown is within 60 seconds (by default), the color turns yellow (known as the "bump soon" state).  When the countdown is within 30 seconds (the "bump very soon" state), the countdown alternates between red on black and black on red in half second intervals (thus appearing to blink), meaning it's rather close to time to go on the air.  When the time is reached to return to the program (coundown goes to zero), the countdown changes to the time to the next break, and turns bright green on black (known as the "bump in" state, that is to say, when bumper music is playing).  For 25 seconds, the countdown alternates slowly (3 second period) between green and light green; this is the time the show is technically on the air, but usually nothing is said.  When the "bump in" time has elapsed, the countdown stays bright green (the state known as "on air").

Sixty seconds before breaks, the pattern begins to repeat, with the display turning yellow (but this state is called "time is short"), then 30 seconds before the break it turns to blinking red (called "time is very short"), followed by cyan for the break.  Of note for "The Tech Guy" show, Léo has said that at the orchestra hit in "LLULINER", some (automated?) stations use that liner as a bed for station ID and the like, which occurs midway during the TIME_VERY_SHORT interval.  This means with 00:00:15 displayed, the conversation should be done to let the rest of the liner, and only the liner, play.

When the show ends, the program stops itself, and the page background, the local time, and the countdown are turned red.  This can be manually accomplished by clicking (tapping?) the STOP button.

The debug blank on the page is to dynamically raise or lower the debug level messages shown in the developer's Web console. Higher numeric levels are higher levels of operation; that is to say, higher numbers show less detail, lower numbers more.

The display timing fudge factor is an offset in milliseconds for the numbers on the display.  The show timing and therefore times the colors change is NOT affected by this "knob."  It can be negative if desired.

The program timing offset "knob" controls the actual event timing (in milliseconds), and can also be either positive or negative.  As an example, the original author tests the program during "The Tech Guy" with this set to -10000 because the audio-only stream is delayed (buffered) by ABOUT 10 seconds.

There is a checkbox which when checked will show the milliseconds portion of some of the fields.  This can be toggled on or off at any time.

For grins and giggles, the amount of time in milliseconds that the one second tick handler spends processing is also put on the page ( exit.getTime() - entry.getTime() ).

With all the "knobs" except the debug level one, no action is taken until the next one second tick.

At any time, the program can detect that it is out of sync (not processing at top-of-second), and will continue with the countdown and clock displays but will turn the local time and countdown time pink.

The reminders area will fill with the text of a configured reminder, along with a button to dismiss it.  If the program is restarted in the middle of a show, any reminders occurring in the past are skipped and assumed to be taken care of.  They will remain on the page until either the page is reloaded (program restarted) or dismissed.  They will display consecutively, so a reminder must be dismissed before any next one will show.  This is intended to remind about events such as live reads until they're actually accomplished.  This has the downside that current behavior is a reminder can be blocked by a previous, un-dismissed reminder.

For convenience, there are links near the end of the page to the facilities for entering/editing breaks and reminders.

# Status

There is one page which implements the clocks ticking in real time, with a countdown timer to the start of "The Tech Guy" show in US Eastern Time (where the author lives).  There is some code which attempts to display the local time based upon the timezone configured for the local computer, but this is untested (help?  feedback please?).  It also has a page to enter/edit the breaks, and another to edit reminders.  It relies on localStorage to store the information about breaks, but the break and reminder pages do have a JSON export/import textarea.  There is one example of this import capability in [techguy.json](techguy.json) .  You can copy/paste this into "export area" in the [ShowTimerBreakEdit.html](ShowTimerBreakEdit.html) file.  This file also gets included so that during profile loading time, the user is given the option of loading the default break descriptions.

The system now has basic functionality, with the countdown display showing the time until the next event, and the next event being picked/displayed.  But this really should  parameterize more than just the breaks, it should remember the show start time, show length, the desired timing tolerance, the time offset for OTAtime, and so on, to generalize use for more than just "The Tech Guy" in US/Eastern time.  It has (untested) capability to take into account the local timezone.  This generally means making another page to edit and save these variables, and on startup (or call to ST_init()) read these in and override the builtin defaults.  The variables are in the program, but for now they remain fixed and built in.

There is also a facility to edit pop up reminders in [ShowTimerReminderEdit.html](ShowTimerReminderEdit.html).  It's quite like the break editor (as in, mostly copied from!).  The way these work is to present them one at a time in the reminder area with a dismiss button.  They persist until dismissed and blink slowly.  That does mean that on the next second after dimissing one, another could be put in its place.  This was mostly intended to remind about things like live reads and billboards.  Eventually, there should be a button in the UI to reload them, so they can be edited during the show.

# an apology about commit messages

Before 27-Jun-2017, I did not know that commit messages were supposed to be split into a short description and anything more invovlved, separated by a blank line.  The initial author was treating these like RCS log messages, and did not know this convention amongst Git users existed.  So some of the commits, especially in the pre-alpha branch, have quite lengthy commit messages.  And I'd like to apologize for that.  If I had known, I would have followed the summary+explanation format. :-( Changing these messages retroactively is technically possible but quite frowned upon with Git, so I think I'll just leave it for now.
