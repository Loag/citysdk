'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.get_geography_variables = exports.get_fips_from_Lat_Lng = exports.get_Lat_Lng = exports.get_Lat_Lng_From_zip_code = exports.get_Lat_Lng_from_state_code = exports.is_normalizable = exports.parse_to_valid_variable = exports.parse_to_variable = undefined;

var _httpReqs = require('./http-reqs');

var aliases = require('../../../resources/aliases.json');
var stateCapitalsLatLng = require('../../../resources/us-states-latlng.json');

var parse_to_variable = exports.parse_to_variable = function parse_to_variable(aliasOrVariable, aliases) {
  // If the requested string is an alias, return the appropriate variable from the dictionary
  if (aliasOrVariable in aliases) {
    return aliases[aliasOrVariable].variable;
  }

  // Otherwise, this is either already a variable name or is unsupported
  return aliasOrVariable;
};

var parse_to_valid_variable = exports.parse_to_valid_variable = function parse_to_valid_variable(aliasOrVariable, api, year) {
  // If the requested string is an alias, return the appropriate variable from the dictionary
  if (aliasOrVariable in aliases) {
    if (api in aliases[aliasOrVariable]['api'] && aliases[aliasOrVariable]['api'][api].indexOf(parseInt(year)) !== -1) {

      // Alias found and is valid for selected API & year combination
      return aliases[aliasOrVariable].variable;
    } else {
      // Alias found but is NOT valid for selected API and year combination
      throw new Error('Invalid alias for selected API and year combination.');
    }
  }

  // Otherwise, this is either already a variable name or is unsupported
  return aliasOrVariable;
};

var is_normalizable = exports.is_normalizable = function is_normalizable(alias) {
  return alias in aliases && 'normalizable' in aliases[alias] && aliases[alias].normalizable;
};

var get_Lat_Lng_from_state_code = exports.get_Lat_Lng_from_state_code = function get_Lat_Lng_from_state_code(stateCode) {
  return stateCapitalsLatLng[stateCode.toUpperCase()];
};

var get_Lat_Lng_From_zip_code = exports.get_Lat_Lng_From_zip_code = function get_Lat_Lng_From_zip_code(zip) {
  return new Promise(function (resolve, reject) {
    (0, _httpReqs.get_data)('https://s3.amazonaws.com/citysdk/zipcode-to-coordinates.json').then(function (coordinates) {
      resolve(coordinates[zip]);
    }).catch(function (reason) {
      reject(reason);
    });
  });
};

/**
 * Takes an address object with the fields "street", "city", "state", and "zip".
 * Either city and state or zip must be provided with the street.
 *
 * @param address
 *
 * @returns {promise}
 */
// addressGeocoderUrl need this
var get_Lat_Lng_from_address = function get_Lat_Lng_from_address(address, url) {

  // Address is required. If address is not present,
  // then the request will fail.
  if (!address.street) {
    throw new Error('Invalid address! The required field "street" is missing.');
  }

  if (!address.city && !address.state && !address.zip) {
    throw new Error('Invalid address! "city" and "state" or "zip" must be provided.');
  }

  url += '&street=' + address.street;

  if (address.zip) {
    url += '&zip=' + address.zip;
  } else if (address.city && address.state) {
    url += '&city=' + address.city + '&state=' + address.state;
  } else {
    throw new Error('Invalid address! "city" and "state" or "zip" must be provided.');
  }

  return (0, _httpReqs.get_data)(url);
};

var get_Lat_Lng = exports.get_Lat_Lng = function get_Lat_Lng(request) {
  console.log(request);
  var promiseHandler = function promiseHandler(resolve, reject) {

    if (request.address) {

      get_Lat_Lng_from_address(request.address, '').then(function (response) {
        var coordinates = response.result.addressMatches[0].coordinates;
        request.lat = coordinates.y;
        request.lng = coordinates.x;
        resolve(request);
      }).catch(function (reason) {
        reject(reason);
      });
    } else if (request.zip) {

      get_Lat_Lng_From_zip_code(request.zip, '').then(function (coordinates) {
        request.lat = coordinates[1];
        request.lng = coordinates[0];
        resolve(request);
      }).catch(function (reason) {
        reject(reason);
      });
    } else if (request.state) {
      // Since this function returns a promise we want this to be an asynchronous
      // call. Therefore, we wrap in a setTimout() since it allows the function to
      // return before the code inside the setTimeout is excecuted.

      // this needs to be changed
      setTimeout(function () {
        var coordinates = get_Lat_Lng_from_state_code(request.state);
        request.lat = coordinates[0];
        request.lng = coordinates[1];

        resolve(request);
      }, 0);
    } else {
      reject("One of 'address', 'state' or 'zip' must be provided.");
    }
  };
  return new Promise(promiseHandler);
};

var get_fips_from_Lat_Lng = exports.get_fips_from_Lat_Lng = function get_fips_from_Lat_Lng(request) {
  // Benchmark id: 4 = Public_AR_Current
  // Vintage id: 4 = Current_Current
  var req_url = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=' + request.lng + '&y=' + request.lat + '&benchmark=4&vintage=4&layers=8,12,28,84,86&format=jsonp';

  var promiseHandler = function promiseHandler(resolve, reject) {
    (0, _httpReqs.get_data)(req_url).then(function (res) {
      var geographies = res.result.geographies;

      // The 2010 Census Blocks object seems to have
      // the FIPS codes for all the level we need.
      var fips = geographies['2010 Census Blocks'][0];

      // FIPS codes
      request.state = fips.STATE;
      request.tract = fips.TRACT;
      request.county = fips.COUNTY;
      request.blockGroup = fips.BLKGRP;

      // Check if this location is Incorporated. If so, then get the FIPS code.
      if (geographies['Incorporated Places'] && geographies['Incorporated Places'].length) {
        request.place = geographies['Incorporated Places'][0].PLACE;
        request.place_name = geographies['Incorporated Places'][0].NAME;
      }
      request.geocoded = true;
      resolve(request);
    }).catch(function (err) {
      reject(err);
    });
  };
  return new Promise(promiseHandler);
};

var get_geography_variables = exports.get_geography_variables = function get_geography_variables(request) {
  if (!request.api || !request.year) throw new Error('Invalid request! "year" and "api" fields must be provided.');
  return (0, _httpReqs.get_data)('https://api.census.gov/data/' + request.year + '/' + request.api + '/geography.json');
};