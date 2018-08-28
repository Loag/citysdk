var fs = require('fs');
var aliases = require('../resources/aliases.json');

const alias_map = () => {
  return aliases.reduce((acc, cur) => {
    let variable = aliases[cur].variable;
    
    acc[variable] = {
      alias: cur,
      api: aliases[cur].api,
      description: aliases[cur].description
    };

   return acc;
  })
}

fs.writeFileSync('../resources/var-alias-map.json', JSON.stringify(alias_map()), 'utf-8');

