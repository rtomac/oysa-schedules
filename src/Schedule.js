const Schedule = function() {
  const dateCellPrefix = "Brackets -";
  const locationNormalizations = [
    ["Middle School", "ms"],
    ["High School", "hs"],
  ];
  const fieldNormalizations = [
    ["Stadium", "stad"],
    [/Turf #?([\da-z]+)/gi, "fld$1"],
    [/Trf([\da-z]+)/gi, "fld$1"],
    [/Field #?([\da-z]+)/gi, "fld$1"],
    [/^Tu?rf$/gi, ""],
  ];

  function getSchedule(scheduleUrl, teamName) {
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
            const [teamScoreString, teamScoreValue] = parseScore(isHomeTeam ? homeScore : awayScore);
            const [opponentScoreString, opponentScoreValue] = parseScore(isHomeTeam ? awayScore : homeScore);

            game['TeamScore'] = teamScoreString;
            game['OpponentScore'] = opponentScoreString;

            const hasScoreValues = !isNaN(teamScoreValue) && !isNaN(opponentScoreValue);
            if (hasScoreValues) {
              game['Result'] = teamScoreValue > opponentScoreValue ? "W" : (teamScoreValue < opponentScoreValue ? "L" : "D");
              game['ResultSummary'] = `${game['Result']} ${teamScoreString}-${opponentScoreString}`;
            }
            else {
              game['Result'] = "?";
              game['ResultSummary'] = `[${teamScoreString}] - [${opponentScoreString}]`;
            }
          }
        }

        game.findOnCalendar = function(gameEvents) { return findOnCalendar(game, gameEvents); }

        games.push(game);
      });
    });
    
    //Logger.log(games);
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

  function parseScore(score) {
    score = score.trim();
    if (score.includes("-") && score.toLowerCase().endsWith("pk")) {
      const regulation = score.split('-')[0].trim();
      const pks = score.split('-')[1].trim().slice(0, -2).trim();
      return [`${regulation}(${pks}PK)`, Number(regulation) + (Number(pks)*.01)];
    }
    return [score, Number(score)];
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
    //if (hasNotes) Logger.log(notesToString());

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
    //if (!isMatch(gameEvent.team, game['Team'])) return false;
    return true;
  }

  function isCalendarEventComplete(game, gameEvent) {
    let complete = true, errors = [], warnings = [], infos = [];

    if ((game['Home or Away'] == "Home") != gameEvent.isHome) {
      complete = false;
      errors.push(`Home or away appears incorrect: schedule says ${game['Home or Away']}, event summary is "${gameEvent.summary}"`);
    };

    if (!isMatch(game['Opponent'], gameEvent.opponent)) {
      complete = false;
      errors.push(`Opponent appears incorrect: schedule says "${game['Opponent']}", calendar has "${gameEvent.opponent}"`);
    };
    
    if (!locationIsMatch(game['Venue'], gameEvent.location, gameEvent.description)) {
      warnings.push(`Location doesn't appear in calendar location or event description: schedule says "${game['Venue']}", calendar has "${gameEvent.location}" for location`);
    };

    if (!fieldIsMatch(game['Field'], gameEvent.description)) {
        warnings.push(`Field # doesn't appear in event description: schedule says "${game['Field']}"`);
    };
    
    return [ complete, errors, warnings, infos ];
  }

  function eventDescriptionContains(eventDesc, strToFind, normalizations) {
    if (!eventDesc || !strToFind) return false;

    const clean = str => str.toLowerCase().trim();
    const normalize = str => {
      let normalized = str;
      (normalizations || []).forEach(repl => {
        normalized = normalized.replaceAll(repl[0], repl[1]);
      });
      Logger.log(str);
      Logger.log(clean(normalized));
      return clean(normalized);
    };
    
    if (clean(eventDesc).includes(clean(strToFind))) return true;
    if (normalizations && normalize(eventDesc).includes(normalize(strToFind))) return true;
    return false;
  }

  function locationIsMatch(venue, eventLocation, eventDescription) {
    if (isMatch(venue, eventLocation)) return true;
    if (eventDescriptionContains(eventDescription, venue, locationNormalizations)) return true;
    return false;
  }

  function fieldIsMatch(field, eventDescription) {
    if (eventDescriptionContains(eventDescription, field, fieldNormalizations)) return true;
    return false;
  }

  function isMatch(a, b) {
    return FuzzyMatcher.isMatch(a, b);
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
