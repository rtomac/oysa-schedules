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
      const title = vevent.getFirstPropertyValue('summary');
      const desc = vevent.getFirstPropertyValue('description');
      let parsed = parseGameFromEventSummary(title, teamName);  // First assume summary in title
      if (!parsed.isGame) {
        // Otherwise, summary may be in first line of description
        parsed = parseGameFromEventSummary(desc.split("\n")[0], teamName)
      }
      if (parsed.isGame) {
        const start = vevent.getFirstPropertyValue('dtstart').toJSDate()
        gameEvents.push({
          eventID: vevent.getFirstPropertyValue('uid'),
          title: title,
          start: start,
          location: vevent.getFirstPropertyValue('location'),
          description: desc,
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

