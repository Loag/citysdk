'use strict';

var fs = require('fs');
var aliases = require('../resources/aliases.json');

var alias_map = function alias_map() {
  return aliases.reduce(function (acc, cur) {
    var variable = aliases[cur].variable;

    acc[variable] = {
      alias: cur,
      api: aliases[cur].api,
      description: aliases[cur].description
    };

    return acc;
  });
};

fs.writeFileSync('../resources/var-alias-map.json', JSON.stringify(alias_map()), 'utf-8');