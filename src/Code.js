const teamsRangeA1 = "A3:C12";
const scheduleRangeA1 = "A17:I";
const timeStampA1 = "I14";
const schedulesHeadersA1 = "A15:G16";
const combinedSchedulesSubhdr = "Combined";

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createAddonMenu()
    .addItem('Refresh Schedules', 'main')
    .addToUi();
}

function main() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  writeSchedules(sheet);
}

function test() {
  writeSchedules("Test");
}

function nightly() {
  writeSchedules("Fall 2024");
}

function writeSchedules(sheet) {
  if (typeof sheet === "string") {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheet);
  }

  let teamRows = sheet.getRange(teamsRangeA1).getValues();

  // Clear existing schedules
  let scheduleRange = sheet.getRange(scheduleRangeA1);
  scheduleRange.clearContent()
    .clearNote()
    .setBackground(null)
    .setFontWeight(null)
    .setHorizontalAlignment('left');

  // Write schedules for each team
  let values;
  let cell = scheduleRange;
  teamRows.filter(teamRow => teamRow[0].length > 0 && teamRow[1].length > 0)
    .forEach(teamRow => {
      values = writeSchedule(teamRow[0], teamRow[1], teamRow[2], cell);
      if (values.length > 0)
        cell = increment(cell, values.length + 1);
    });
  
  let rowsToCombine = cell.getRow() - scheduleRange.getRow() - 1;
  if (rowsToCombine > 0) {
    // Calculate range with schedule data
    const scheduleHeadersRange = sheet.getRange(schedulesHeadersA1);
    const schedulesDataRange = sheet.getRange(
      scheduleRange.getRow(),
      scheduleRange.getColumn(),
      cell.getRow() - scheduleRange.getRow() - 1,
      scheduleHeadersRange.getWidth());

    // Write header for combined schedule
    scheduleHeadersRange.copyTo(cell);
    cell.setValue(combinedSchedulesSubhdr);
    cell = increment(cell, scheduleHeadersRange.getHeight());

    // Write combined schedule formula
    cell.setFormula(`=sort(arrayformula(${schedulesDataRange.getA1Notation()}), 2, true, 3, true)`);
  }

  // Write last refreshed timestamp
  const timestamp = new Date();
  sheet.getRange(timeStampA1)
    .setValue(`Last refreshed ${timestamp.toLocaleDateString("en-US")} ${timestamp.toLocaleTimeString("en-US", { hour: 'numeric', minute: 'numeric' })}`);
}

function writeSchedule(teamName, scheduleUrl, calendarUrl, cell) {
  let games = Schedule.getSchedule(teamName, scheduleUrl);

  let gameEvents;
  if (calendarUrl) {
    gameEvents = Calendar.getGamesFromCalendarForTeam(calendarUrl, teamName);
  }

  let notes = [];
  let values = games.map((game, index) => {
    let isOnCalendar;
    if (gameEvents) {
      const onCalendar = game.findOnCalendar(gameEvents);
      isOnCalendar = onCalendar.isOnCalendar;
      if (onCalendar.found && onCalendar.hasNotes) {
        notes.push([index, 7, onCalendar.notesToString()]);
      }
    }

    return [ game['Team'], game['Date'], game['Time'], game['Opponent'], game['Venue'], game['Field'], game['Home or Away'], isOnCalendar, game['ResultSummary'] ];
  });
  writeToCells(cell, values, notes);

  return values;
}

function writeToCells(cell, values, notes) {
  const sheet = cell.getSheet();
  let range = cell;

  if (values.length > 0) {
    range = sheet.getRange(range.getRow(), range.getColumn(), values.length, values[0].length);
    range.setValues(values);
  }

  if (notes) {
    notes.forEach(note => {
      let [ row, col, text ] = note;
      cell.offset(row, col, 1, 1).setNote(text);
    });
  }
}

function increment(cell, rows) {
  rows = (rows || 1);
  return cell.getSheet().getRange(cell.getRow() + rows, cell.getColumn());
}
