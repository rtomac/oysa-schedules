const FuzzyMatcher = function() {
  // Import fuse.js
  eval(UrlFetchApp.fetch('https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js').getContentText());
  
  const defaultScoreThreshold = .34;
  
  function isMatch(a, b, scoreThreshold = defaultScoreThreshold) {
    let [outcome] = isMatchScored(a, b, true, scoreThreshold);
    return outcome;
  }

  function bestMatch(options, term, scoreThreshold = defaultScoreThreshold) {
    if (!Array.isArray(options)) options = [options];

    let results = [];
    for (let i = 0; i < options.length; i++) {
      [outcome, score] = isMatchScored(options[i], term, false, scoreThreshold);
      if (outcome) results.push([i, score]);
    }

    if (!results.length) return null;
    if (results.length > 1)
      results.sort(function(a, b){return a[1] - b[1]});
    i = results[0][0];
    return options[i];
  }
  
  function isMatchScored(a, b, stopAtThreshold, scoreThreshold) {
    if (a == b) return [true, 0];

    a = (a || '').toLowerCase().trim(),
      b = (b || '').toLowerCase().trim();
    if (a == b) return [true, 0.01];

    if (a.length && b.length) {
      let match1 = fuseMatch(a, b);
      if (stopAtThreshold && match1 && match1.score <= scoreThreshold)
        return [true, match1.score];
      match2 = fuseMatch(b, a);
      if (match1 || match2) {
        if (match1 && !match2) return [true, match1.score];
        if (match2 && !match1) return [true, match2.score];
        if (match1.score <= match2.score) return [true, match1.score];
        return [true, match2.score];
      }
    }
    
    return [false, 1];
  }

  function fuseMatch(one, two) {
    let results = new Fuse([ one ], { includeScore: true }).search(two);
    if (results.length) {
      //Logger.log(results[0]);
      return results[0];
    }
    return null;
  }

  return { isMatch, bestMatch }
}();
