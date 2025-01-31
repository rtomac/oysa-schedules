const Calendar = function() {
  // Import URI.js
  // eval(UrlFetchApp.fetch('https://cdnjs.cloudflare.com/ajax/libs/URI.js/1.19.11/URI.min.js').getContentText());
  // Import ical.js
  eval(UrlFetchApp.fetch('https://cdnjs.cloudflare.com/ajax/libs/ical.js/1.5.0/ical.min.js').getContentText());

  eventSummaryHomeSplits = [ 'vs', 'vs.' ];
  eventSummarySplits = eventSummaryHomeSplits.concat([ '@', 'at' ]);

  function getGamesFromCalendarForTeam(calendarUrl, teamName) {
    const content = UrlFetchApp.fetch(calendarUrl).getContentText();
    //Logger.log(content);

    const vcalendar = new ICAL.Component(ICAL.parse(content));
    const gameEvents = [];

    const vevents = vcalendar.getAllSubcomponents('vevent');
    vevents.forEach(vevent => {
      const event = new ICAL.Event(vevent);
      const title = event.summary;
      let parsed = parseGameFromEventSummary(title, teamName);  // First assume summary in title
      if (!parsed.isGame) {
        // Otherwise, summary may be in first line of description
        parsed = parseGameFromEventSummary(event.description.split("\n")[0], teamName)
      }
      if (parsed.isGame) {
        let start;
        try { start = event.startDate.toJSDate(); }
        catch {
          console.error("Could not parse start date, probably a TBD or all-day event, skipping: " + vevent.getFirstProperty('dtstart').toICALString())
          return;
        }
        
        gameEvents.push({
          eventID: event.uid,
          title: title,
          start: start,
          location: event.location,
          description: event.description,
          summary: parsed.summary,
          team: parsed.team,
          date: start.toLocaleDateString("en-US"),
          time: start.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
          opponent: parsed.opponent,
          isHome: parsed.isHome
        });
      }
    });

    //Logger.log(gameEvents);
    return gameEvents;
  }

  function parseGameFromEventSummary(summary, teamName) {
    for (var i = 0; i < eventSummarySplits.length; i++) {
      let split = eventSummarySplits[i];
      let loc = summary.toLowerCase().indexOf(" " + split + " ");

      if (loc != -1) {
        let team = teamLeft = summary.substring(0, loc).trim();
        let opponent = teamRight = summary.substring(loc + split.length + 2).trim();
        let isHome = eventSummaryHomeSplits.includes(split);

        let bestMatch = FuzzyMatcher.bestMatch([team, opponent], teamName);
        if (bestMatch) {
          if (bestMatch == teamRight) {
            team = teamRight;
            opponent = teamLeft;
            isHome = !isHome;
          }
        
          return { isGame: true,
            summary: summary,
            team: team,
            opponent: opponent,
            isHome: isHome };
        }
      }
    }
    return { isGame: false };
  }

  return { getGamesFromCalendarForTeam };
}();

