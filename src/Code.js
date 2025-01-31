const teamsSectionStartA1 = "A1";
const teamsRangeColsA1 = "A:D";
const schedulesSectionText = "Schedules";
const schedulesRangeColsA1 = "A:I";
const combinedSchedulesSubheadText = "Combined";
const combinedSchedulesRangeColsA1 = "A:G";

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
  writeSchedules("Winter/Spring 2025");
}

function writeSchedules(sheet) {
  if (typeof sheet === "string") {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheet);
  }

  const { teamsRange, schedulesRange, combinedSchedulesHeaderRange, timeStampCell } = discoverRanges(sheet);
  let teamRows = teamsRange.getValues();

  // Clear existing schedules
  // Note: can't clearFormat() directly bc that will clear conditional formats
  schedulesRange.clearContent()
    .clearNote()
    .setBackground(null)
    .setFontWeight(null)
    .setFontStyle('normal')
    .setHorizontalAlignment('left');

  // Write schedules for each team
  let values;
  let cell = schedulesRange;
  teamRows.filter(teamRow => teamRow[0].length > 0 && teamRow[1].length > 0)
    .forEach(teamRow => {
      values = writeSchedule(teamRow[0], teamRow[1], teamRow[2], cell);
      if (values.length > 0)
        cell = increment(cell, values.length + 1);
    });
  
  let rowsToCombine = cell.getRow() - schedulesRange.getRow() - 1;
  if (rowsToCombine > 0) {
    // Calculate range with schedule data
    const schedulesDataRange = sheet.getRange(
      schedulesRange.getRow(),
      schedulesRange.getColumn(),
      cell.getRow() - schedulesRange.getRow(),
      combinedSchedulesHeaderRange.getWidth());

    // Write header for combined schedule
    combinedSchedulesHeaderRange.copyTo(cell);
    cell.setValue(combinedSchedulesSubheadText);
    cell = increment(cell, combinedSchedulesHeaderRange.getHeight());

    // Write combined schedule formula
    cell.setFormula(`=sort(arrayformula(${schedulesDataRange.getA1Notation()}), 2, true, 3, true)`);
  }

  // Write last refreshed timestamp
  const timestamp = new Date();
  timeStampCell
    .setValue(`Last refreshed ${timestamp.toLocaleDateString("en-US")} ${timestamp.toLocaleTimeString("en-US", { hour: 'numeric', minute: 'numeric' })}`);
}

function discoverRanges(sheet) {
  const teamsSectionStart = sheet.getRange(teamsSectionStartA1);
  const schedulesSectionStart = sheet.getRange("A1:A").createTextFinder(schedulesSectionText).findNext();
  if (!schedulesSectionStart)
    throw new Error(`Could not find schedule section start cell containing text ${schedulesSectionText}`)

  const teamsRange = sheet.getRange(
    makeRangeA1(teamsRangeColsA1, teamsSectionStart.getRow()+2, schedulesSectionStart.getRow()-1));
  const schedulesHeaderRange = sheet.getRange(
    makeRangeOfSizeA1(schedulesRangeColsA1, schedulesSectionStart.getRow()+1, 2));
  const combinedSchedulesHeaderRange = sheet.getRange(
    makeRangeOfSizeA1(combinedSchedulesRangeColsA1, schedulesHeaderRange.getRow(), schedulesHeaderRange.getNumRows()));
  const schedulesRange = sheet.getRange(
    makeRangeA1(schedulesRangeColsA1, schedulesSectionStart.getRow()+3));
  const timeStampCell = sheet.getRange(`I${schedulesSectionStart.getRow()}`);

  const ranges = { teamsRange, schedulesHeaderRange, combinedSchedulesHeaderRange, schedulesRange, timeStampCell, };
  console.log("Using", Object.keys(ranges).map(k => `${k} = ${ranges[k].getA1Notation()}`).join(', '));
  return ranges;
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

function makeRangeA1(colsA1, fromRow, toRow) {
  const [fromCol, toCol] = colsA1.split(':');
  return `${fromCol}${fromRow}:${toCol || ''}${toRow || ''}`;
}

function makeRangeOfSizeA1(colsA1, fromRow, numRows) {
  const toRow = fromRow + numRows - 1;
  return makeRangeA1(colsA1, fromRow, toRow);
}

function increment(cell, rows) {
  rows = (rows || 1);
  return cell.getSheet().getRange(cell.getRow() + rows, cell.getColumn());
}
