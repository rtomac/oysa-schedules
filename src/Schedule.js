const Schedule = function() {
  // Import fuse.js
  eval(UrlFetchApp.fetch('https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js').getContentText());
  
  const dateCellPrefix = "Brackets -";
  const fuzzyMatchThreshold = .25;
  const locationAliases = {
    "clackamas hs": [ "clackamas high school" ],
    "nelson sports complex": [ "adrienne c. nelson high school" ]
  };

  function getSchedule(teamName, scheduleUrl) {
    let $ = getPage(scheduleUrl);

    let games = [];

    let dates = $('center.txtM');
    dates.each((_, dateElement) => {
      let date = $(dateElement).text().trim();

      let table = $(dateElement).next('table');
      let rows = table.find('tr');
      let headers = rows
        .first()
        .children('td')
        .map((_, tdElement) => $(tdElement).text().trim())
        .get();

      rows.not(rows.first()).each((_, rowElement) => {
        let game = toHashTable(
            headers,
            $(rowElement).children('td')
              .map((_, tdElement) => $(tdElement).text().trim()).get());

        game['Date'] = cleanDate(date);

        let isHomeTeam = game['Home Team'].toLowerCase().trim() == teamName.toLowerCase().trim();
        let isAwayTeam = game['Away Team'].toLowerCase().trim() == teamName.toLowerCase().trim();
        if (!isHomeTeam && !isAwayTeam) return;

        game['Home or Away'] = isHomeTeam ? "Home" : "Away";
        game['Team'] = isHomeTeam ? game['Home Team'] : game['Away Team'];
        game['Opponent'] = isHomeTeam ? game['Away Team'] : game['Home Team'];

        game['Time'] = cleanTime(game['Time']);

        let score = game['Score'];
        if (score && Array.isArray(score)) {
          let [homeScore, awayScore] = score;
          if (homeScore.length > 0 && awayScore.length > 0) {
            let teamScore = isHomeTeam ? homeScore : awayScore,
              opponentScore = isHomeTeam ? awayScore : homeScore;
            game['TeamScore'] = teamScore;
            game['OpponentScore'] = opponentScore;
            game['Result'] = teamScore > opponentScore ? "W" : (teamScore < opponentScore ? "L" : "D");
            game['ResultSummary'] = `${game['Result']} ${teamScore}-${opponentScore}`;
          }
        }

        game.findOnCalendar = function(gameEvents) { return findOnCalendar(game, gameEvents); }

        games.push(game);
      });
    });
    
    Logger.log(games);
    return games;
  }

  // function getTeamScheduleUrl(scheduleUrl, teamName) {
  //   const scheduleUri = new URI(scheduleUrl);
  //   const $ = getPage(scheduleUri);

  //   const teamScheduleHref = $('table td a')
  //     .filter((i, element) => $(element).text().toLowerCase().includes(teamName.toLowerCase()))
  //     .attr('href')
  //     .trim();
    
  //   return scheduleUri
  //     .clone()
  //     .query(teamScheduleHref)
  //     .toString();
  // }

  function cleanDate(date) {
    return new Date(date.substring(dateCellPrefix.length).trim()).toLocaleDateString("en-US");
  }

  function cleanTime(time) {
    if (time.length == 8) return time;

    let clean = time;
    if (clean.length > 8)
      clean = clean.substring(0, 8);
    
    let parsed = Date.parse(`1/1 ${clean}`);
    if (!Number.isNaN(parsed))
      return new Date(parsed).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' });

    return time;
  }

  function findOnCalendar(game, gameEvents) {
    if (!gameEvents) return null;

    let gameEvent = gameEvents.find(gameEvent => matchesCalendarEvent(game, gameEvent));

    let found = gameEvent != null;
    let complete, errors, warnings, infos, eventID, hasNotes;
    if (found) {
      eventID = gameEvent.eventID;
      [ complete, errors, warnings, infos ] = isCalendarEventComplete(game, gameEvent);
      hasNotes = (errors.length || warnings.length || infos.length);
    }

    function notesToString() {
      if (!hasNotes) return null;
      const notes = [];
      notes.push(...errors.map(error => `error: ${error}`));
      notes.push(...warnings.map(warning => `warning: ${warning}`));
      notes.push(...infos.map(info => `info: ${info}`));
      return notes.join('\n\n');
    }
    if (hasNotes) Logger.log(notesToString());

    return {
      isOnCalendar: found ? (complete ? "Yes" : "Incomplete") : "No",
      found: found,
      eventID: eventID,
      complete: complete,
      errors: errors,
      warnings: warnings,
      infos: infos,
      hasNotes: hasNotes,
      notesToString: notesToString
    }
  }

  function matchesCalendarEvent(game, gameEvent) {
    if (gameEvent.date != game['Date']) return false;
    if (gameEvent.time != game['Time']) return false;
    if (!valueIsMatch(gameEvent.team, game['Team'])) return false;
    return true;
  }

  function isCalendarEventComplete(game, gameEvent) {
    let complete = true, errors = [], warnings = [], infos = [];

    if ((game['Home or Away'] == "Home") != gameEvent.isHome) {
      complete = false;
      errors.push(`Home or away appears incorrect: schedule says ${game['Home or Away']}, event title is "${gameEvent.title}"`);
    };

    if (!valueIsMatch(game['Opponent'], gameEvent.opponent)) {
      complete = false;
      errors.push(`Opponent appears incorrect: schedule says "${game['Opponent']}", calendar has "${gameEvent.opponent}"`);
    };
    
    if (!locationIsMatch(game['Venue'], gameEvent.location, gameEvent.description)) {
      warnings.push(`Location doesn't appear in calendar location or event description: schedule says "${game['Venue']}", calendar has "${gameEvent.location}" for location`);
    };

    if (!eventDescriptionContains(gameEvent.description, game['Field'])) {
        warnings.push(`Field # doesn't appear in event description: schedule says "${game['Field']}"`);
    };
    
    return [ complete, errors, warnings, infos ];
  }

  function eventDescriptionContains(eventDesc, str) {
    eventDesc = (eventDesc || '').toLowerCase().trim(),
      str = (str || '').toLowerCase().trim();
    return eventDesc.includes(str);
  }

  function locationIsMatch(venue, eventLocation, eventDescription) {
    if (valueIsMatch(venue, eventLocation)) return true;
    if (eventDescriptionContains(eventDescription, venue)) return true;

    let aliases = locationAliases[venue.toLowerCase().trim()];
    if (aliases) {
      for (var i = 0; i < aliases.length; i++) {
        if (valueIsMatch(aliases[i], eventLocation)) return true;
        if (eventDescriptionContains(eventDescription, aliases[i])) return true;
      }
    }

    return false;
  }

  function valueIsMatch(a, b) {
    a = (a || '').toLowerCase().trim(),
      b = (b || '').toLowerCase().trim();
    if (a == b) return true;
    if (valueIsFuzzyMatch(a, b)) return true;
    return false;
  }

  function valueIsFuzzyMatch(a, b) {
    a = (a || '').trim(), b = (b || '').trim();
    if (a.length && b.length) {
      let match;
      match = fuseMatch(a, b);
      if (match && match.score >= fuzzyMatchThreshold) return true;
      match = fuseMatch(b, a);
      if (match && match.score >= fuzzyMatchThreshold) return true;
    }
    return false;
  }

  function fuseMatch(first, second) {
    let results = new Fuse([ first ], { includeScore: true }).search(second);
    if (results.length) {
      Logger.log(results[0]);
      return results[0];
    }
    return null;
  }

  function getPage(uri) {
    return Cheerio.load(UrlFetchApp.fetch(uri).getContentText());
  }

  function toHashTable(names, values) {
    let index = {};
    values.forEach((value, i) => {
      if (i < names.length) {
        let name = names[i];
        if (name in index) { // already in index, two columns with same name, make values an array and add multiple vals
          let current = index[name];
          if (!Array.isArray(current)) index[name] = current = [ current ];
          current.push(value);
        }
        else index[name] = value;
      }
    });
    return index;
  }

  return { getSchedule }
}();
