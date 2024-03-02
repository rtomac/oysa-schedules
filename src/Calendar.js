const Calendar = function() {
  // Import URI.js
  // eval(UrlFetchApp.fetch('https://cdnjs.cloudflare.com/ajax/libs/URI.js/1.19.11/URI.min.js').getContentText());
  // Import ical.js
  eval(UrlFetchApp.fetch('https://cdnjs.cloudflare.com/ajax/libs/ical.js/1.5.0/ical.min.js').getContentText());

  eventTitleHomeSplits = [ 'vs', 'vs.' ];
  eventTitleSplits = eventTitleHomeSplits.concat([ '@', 'at' ]);

  function getGamesFromCalendar(calendarUrl) {
    const content = UrlFetchApp.fetch(calendarUrl).getContentText();
    Logger.log(content);

    const vcalendar = new ICAL.Component(ICAL.parse(content));
    const gameEvents = [];

    const vevents = vcalendar.getAllSubcomponents('vevent');
    vevents.forEach(vevent => {
      const title = vevent.getFirstPropertyValue('summary');
      const parsed = parseEventTitle(title);
      if (parsed.isGame) {
        const start = vevent.getFirstPropertyValue('dtstart').toJSDate()
        gameEvents.push({
          eventID: vevent.getFirstPropertyValue('uid'),
          title: title,
          start: start,
          location: vevent.getFirstPropertyValue('location'),
          description: vevent.getFirstPropertyValue('description'),
          team: parsed.team,
          date: start.toLocaleDateString("en-US"),
          time: start.toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' }),
          opponent: parsed.opponent,
          isHome: parsed.isHome
        });
      }
    });

    Logger.log(gameEvents);
    return gameEvents;
  }

  function parseEventTitle(title) {
    for (var i = 0; i < eventTitleSplits.length; i++) {
      let split = eventTitleSplits[i];
      let loc = title.toLowerCase().indexOf(" " + split + " ");
      if (loc != -1) {
        return { isGame: true,
          team: title.substring(0, loc).trim(),
          opponent: title.substring(loc + split.length + 2).trim(),
          isHome: eventTitleHomeSplits.includes(split) };
      }
    }
    return { isGame: false };
  }

  return { getGamesFromCalendar };
}();

