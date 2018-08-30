import {get_geography_variables} from '../utils/req-utils';
import availableDatasets from '../resources/available-datasets';

export const validate_api = (input) => {
  const defaultApi = 'acs5';
  if (!input.api) return Object.assign({}, input, {api: defaultApi});
  return input;
}

const validate_api_year = (request) => {
  if (availableDatasets[request.api]) { 
    let availableApiYears = availableDatasets[request.api].sort();
    if (!request.year || !availableApiYears.includes(request.year)) return Object.assign({}, request, {year: availableApiYears.pop()})
  } 
  return request;
}

const validate_level = (input) => {
  const defaultLevel = 'blockGroup';
  const levels = ['blockGroup', 'tract', 'county', 'state', 'us', 'place'];
  if (!input.level || !levels.includes(input.level)) return Object.assign({}, input, {level: defaultLevel});
  return input;
}

// have to figure out whats going on here.. strange 
const validate_sublevel = (input) => {
  const defaultSublevel = false;
  if (input.sublevel) {
    if ((typeof input.sublevel) !== 'boolean') {
     return Object.assign({}, input, {sublevel: 'true'});
    }
  }
  return Object.assign({}, input, {sublevel: defaultSublevel});
}

export const validate = (request) => {      
  return validate_sublevel(validate_level(validate_api_year(validate_api(request))));
}
  
export const validate_geo_variables = (input) => {
  return new Promise ((resolve, reject) => {

    get_geography_variables(input).then((response) => {
      let level = input.level;
      if (input.level === 'blockGroup') level = 'block group';

      let requiredFields = response.fips.reduce((acc, cur) => {
        if (cur.name === level) {
          if (cur.requires && cur.requires.length) {
            let missingFields = cur.requires.reduce((acc, cur) => {
              if (!input[cur]){
                acc.push(cur)
              }
              return acc;
            }, [])
            acc.concat(missingFields);
          }
          return acc;
        }
        acc = false;
        return acc;
      }, []);

      if (requiredFields === '') {
        let res = Object.assign({}, input, {geographyValidForAPI: true, level: level})
        resolve(res);
      } else {
        if (requiredFields !== false) {
          reject(`Request is missing required fields: ${requiredFields.toString()}.`);
        } else {
          reject(`Invalid level "${level}" for this request.`);
        }
      }
    }).catch((err) => {
      reject(err);
    })
  })
}