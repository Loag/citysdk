'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.geo_request = exports.summary_req = exports.handle_tigerweb_response = exports.tiger_req = exports.supplemental_request = undefined;

var _main = require('../main');

var _main2 = _interopRequireDefault(_main);

var _httpReqs = require('./http-reqs');

var _dataUtils = require('./data-utils');

var _reqUtils = require('../utils/req-utils');

var _defaults = require('../utils/defaults');

var _defaults2 = _interopRequireDefault(_defaults);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var servers = require('../../../resources/servers.json');
var usBoundingBox = require('../../../resources/us-bounds.json');
var requiredVariables = require('../../../resources/required-variables.json');

var supplemental_request = exports.supplemental_request = function supplemental_request(req, res, featureIndex) {
  var i = featureIndex;
  var features = res.features;
  var variables = req.variables;

  // Sometimes cities span multiple counties. In this case,
  // we sometimes miss data due to the limited nature of
  // the Census API's geography hierarchy. This will issue
  // supplemental requests to ensure we have data for all of
  // our geojson entities

  var suppRequest = {
    state: features[i].properties['STATE'],
    tract: features[i].properties['TRACT'],
    county: features[i].properties['COUNTY'],
    blockGroup: features[i].properties['BLKGRP'],
    place: features[i].properties['PLACE'],
    lat: parseFloat(features[i].properties.CENTLAT),
    lng: parseFloat(features[i].properties.CENTLON),
    level: req.level,
    year: req.year,
    api: req.api,
    variables: variables,
    featuresIndex: i,
    apikey: req.apikey
  };

  var promiseHandler = function promiseHandler(resolve, reject) {
    var censusSummaryRequest = summary_req(suppRequest);

    censusSummaryRequest.then(function (response) {
      for (var property in response.data[0]) {
        if (response.data[0].hasOwnProperty(property)) {
          features[response.featuresIndex].properties[property] = response.data[0][property];

          if (variables && variables.indexOf(property) !== -1) {
            res.totals[property] = Number(res.totals[property]) >= 0 ? Number(response.data[0][property]) : 0;
          }
        }
      }

      resolve(response);
    });

    censusSummaryRequest.catch(function (reason) {
      reject(reason);
    });
  };

  return new Promise(promiseHandler);
};

// tiger web utils

var get_container_geometry = function get_container_geometry(request) {
  var mapServer = request.tigerwebApiInfo.mapServers[request.container];
  var tigerwebUrl = request.tigerwebApiInfo.url.replace('{mapserver}', mapServer);
  var tigerwebRequest = request.tigerwebRequest;

  tigerwebRequest.geometry = request.lng + "," + request.lat;
  tigerwebRequest.geometryType = "esriGeometryPoint";
  tigerwebRequest.spatialRel = "esriSpatialRelIntersects";

  var promiseHandler = function promiseHandler(resolve, reject) {
    (0, _httpReqs.post_data)(tigerwebUrl, tigerwebRequest).then(function (response) {
      var features = response.features;

      // Grab our container ESRI geography, attach it to our request,
      // and call this function again.
      if (request.container.toLowerCase() === "us") {
        request.containerGeometry = (0, _dataUtils.geo_to_esri)(usBoundingBox)[0].geometry;
      } else {
        request.containerGeometry = features[0].geometry;
      }

      resolve(request);
    }).catch(function (reason) {
      return reject(reason);
    });
  };

  return new Promise(promiseHandler);
};

var get_geo_data = function get_geo_data(request) {
  // We have a sublevel request with a container,
  // AND we've already grabbed the container's ESRI json
  var mapServer = request.tigerwebApiInfo.mapServers[request.level];
  var tigerwebUrl = request.tigerwebApiInfo.url.replace('{mapserver}', mapServer);
  var tigerwebRequest = request.tigerwebRequest;

  tigerwebRequest.geometry = JSON.stringify(request.containerGeometry);
  tigerwebRequest.geometryType = "esriGeometryPolygon";

  tigerwebRequest.spatialRel = request.container === "place" || request.container === "geometry" ? "esriSpatialRelIntersects" : "esriSpatialRelContains";

  var promiseHandler = function promiseHandler(resolve, reject) {
    (0, _httpReqs.post_data)(tigerwebUrl, tigerwebRequest).then(function (response) {
      resolve(response);
    }).catch(function (reason) {
      reject(reason);
    });
  };
  return new Promise(promiseHandler);
};

var tiger_req = exports.tiger_req = function tiger_req(request) {
  if (!request.tigerwebApi) {
    request.tigerwebApi = 'current';
  }

  // request.tigerwebApiInfo = servers[request.tigerwebApi];
  request.tigerwebRequest = {
    f: "json",
    where: "",
    outFields: "*",
    outSR: 4326,
    inSR: 4326
  };

  var sublevelRequested = request.hasOwnProperty('sublevel') && request.sublevel;

  var promiseHandler = function promiseHandler(resolve, reject) {
    if (request.container && sublevelRequested && !request.containerGeometry) {
      get_container_geometry(request).then(get_geo_data).then(function (response) {
        resolve({ response: (0, _dataUtils.esri_to_geo)(response), request: request });
      }).catch(function (reason) {
        reject(reason);
      });
    } else if (sublevelRequested) {
      request.container = request.level;

      switch (request.level) {
        case 'us':
          request.level = 'state';
          break;
        case 'state':
          request.level = 'county';
          break;
        case 'county':
        case 'place':
          request.level = 'tract';
          break;
        default:
          request.level = 'blockGroup';
      }

      get_container_geometry(request).then(get_geo_data).then(function (response) {
        resolve({ response: (0, _dataUtils.esri_to_geo)(response), request: request });
      }).catch(function (reason) {
        reject(reason);
      });
    } else {

      var mapServer = request.tigerwebApiInfo.mapServers[request.level];
      var tigerwebUrl = request.tigerwebApiInfo.url.replace('{mapserver}', mapServer);
      var tigerwebRequest = request.tigerwebRequest;

      tigerwebRequest.geometry = request.lng + "," + request.lat;
      tigerwebRequest.geometryType = "esriGeometryPoint";
      tigerwebRequest.spatialRel = "esriSpatialRelIntersects";

      (0, _httpReqs.post_data)(tigerwebUrl, tigerwebRequest).then(function (response) {
        resolve({ response: (0, _dataUtils.esri_to_geo)(response), request: request });
      }).catch(function (err) {
        reject(err);
      });
    }
  };
  return new Promise(promiseHandler);
};

var handle_tigerweb_response = exports.handle_tigerweb_response = function handle_tigerweb_response(tigerwebResponse) {
  var request = tigerwebResponse.request;
  var response = tigerwebResponse.response;
  var supplementalRequests = [];

  // Reference dictionary of levels -> geocoder response variables
  var comparisonVariables = {
    'tract': 'TRACT',
    'place': 'PLACE',
    'county': 'COUNTY',
    'blockGroup': 'BLKGRP'
  };

  if (!response.totals) {
    response.totals = {};
  }

  if (request.data) {
    var data = request.data;
    var variables = request.variables;
    var totals = response.totals;
    var features = response.features;

    var matchedFeature = void 0;

    features.forEach(function (f, i) {
      matchedFeature = data.filter(function (d) {
        // Ensure we have a direct match for low level items by comparing the higher level items
        if (request.level === 'blockGroup' || request.level === 'tract') {
          var levelMatch = d[request.level] === f.properties[comparisonVariables[request.level]];
          var tractMatch = d['tract'] === f.properties.TRACT;
          var countyMatch = d['county'] === f.properties.COUNTY;

          return levelMatch && tractMatch && countyMatch;
        } else {
          return d[request.level] === f.properties[comparisonVariables[request.level]];
        }
      });

      if (matchedFeature.length === 0) {
        supplementalRequests.push(supplemental_request(request, response, i));
      } else if (matchedFeature.length === 1) {
        // We have matched the feature's tract to a data tract, move the data over
        matchedFeature = matchedFeature[0];

        for (var property in matchedFeature) {
          if (matchedFeature.hasOwnProperty(property)) {
            f.properties[property] = matchedFeature[property];

            if (variables && variables.indexOf(property) !== -1) {
              totals[property] = Number(totals[property]) >= 0 ? Number(matchedFeature[property]) : 0;
            }
          }
        }
      } else {
        // This usually occurs when a low-level geography entity isn't uniquely identified
        // by the grep. We'll need to add more comparisons to the grep to clear this issue up.
        console.log('Multiple matched features: ');
        console.log(f);
        console.log(matchedFeature);
      }
    });
  }

  var promiseHandler = function promiseHandler(resolve, reject) {
    // If supplemental requests were needed, wait for all
    // to finish.
    if (supplementalRequests.length) {
      Promise.all(supplementalRequests).then(function () {
        return resolve(response);
      }).catch(function (reason) {
        return reject(reason);
      });
    } else {
      setTimeout(function () {
        return resolve(response);
      }, 0);
    }
  };

  return new Promise(promiseHandler);
};

// summary req funcs
var parse_summary_response = function parse_summary_response(request, response) {
  request.data = [];

  if (request.sublevel) {
    // If sublevel is set to true, our 'data' property
    // will be an array of objects for each sublevel item.
    var currentVariable = void 0;
    var currentResponseItem = void 0;
    var currentDataObject = void 0;

    for (var i = 1; i < response.length; i++) {
      currentDataObject = {};
      currentResponseItem = response[i];

      if (['sf1', 'sf3'].indexOf(request.api) && request.year.toString() == '1990') {
        // Hardcoded rule for decennial survey of 1990
        currentDataObject['name'] = currentResponseItem[response[0].indexOf('ANPSADPI')];
      } else {
        // ACS survey & SF survey not 1990
        currentDataObject['name'] = currentResponseItem[response[0].indexOf('NAME')];
      }

      var stateIndex = response[0].indexOf('state');
      var countyIndex = response[0].indexOf('county');
      var tractIndex = response[0].indexOf('tract');
      var blockGroupIndex = response[0].indexOf('block group');
      var placeIndex = response[0].indexOf('place');

      if (stateIndex >= 0) {
        currentDataObject['state'] = currentResponseItem[stateIndex];
      }

      if (countyIndex >= 0) {
        currentDataObject['county'] = currentResponseItem[countyIndex];
      }

      if (tractIndex >= 0) {
        currentDataObject['tract'] = currentResponseItem[tractIndex];
      }

      if (blockGroupIndex >= 0) {
        currentDataObject['blockGroup'] = currentResponseItem[blockGroupIndex];
      }

      if (placeIndex >= 0) {
        currentDataObject['place'] = currentResponseItem[placeIndex];
      }

      for (var j = 0; j < request.variables.length; j++) {
        currentVariable = request.variables[j];

        var validVariable = (0, _reqUtils.parse_to_valid_variable)(currentVariable, request.api, request.year);
        var index = response[0].indexOf(validVariable);
        var intermediateVar = currentResponseItem[index];

        if (intermediateVar) {
          currentDataObject[currentVariable] = intermediateVar;
        }

        // Variable is Normalizeable
        if (intermediateVar && (0, _reqUtils.is_normalizable)(currentVariable) && (0, _reqUtils.parse_to_valid_variable)('population', request.api, request.year)) {

          var _validVariable = (0, _reqUtils.parse_to_valid_variable)('population', request.api, request.year);
          var _index = response[0].indexOf(_validVariable);
          var property = currentVariable + '_normalized';

          currentDataObject[property] = currentDataObject[currentVariable] / currentResponseItem[_index];
        }
      }

      request.data.push(currentDataObject);
    }
  } else {
    // We don't have sublevel, so we just grab the single response
    var _currentVariable = void 0;
    var _currentDataObject = {};

    for (var _i = 0; _i < request.variables.length; _i++) {
      _currentVariable = request.variables[_i];

      if ((0, _reqUtils.parse_to_valid_variable)(_currentVariable, request.api, request.year)) {
        var _validVariable2 = (0, _reqUtils.parse_to_valid_variable)(_currentVariable, request.api, request.year);
        var _index2 = response[0].indexOf(_validVariable2);

        _currentDataObject[_currentVariable] = response[1][_index2];
      }

      if (_currentDataObject[_currentVariable] && (0, _reqUtils.is_normalizable)(_currentVariable) && (0, _reqUtils.parse_to_valid_variable)('population', request.api, request.year)) {

        var _validVariable3 = (0, _reqUtils.parse_to_valid_variable)('population', request.api, request.year);
        var _index3 = response[1].indexOf(_validVariable3);
        var _property = _currentVariable + '_normalized';

        _currentDataObject[_property] = _currentDataObject[_currentVariable] / response[1][_index3];
      }

      request.data.push(_currentDataObject);
    }
  }

  delete request.geocoded;

  return request;
};

// summary req funcs

var summary_req = exports.summary_req = function summary_req(request) {
  var cascade = false;
  var qualifiers = 'for=';

  if (request.sublevel) {
    var level = request.level === 'blockGroup' ? 'block+group' : request.level;

    switch (request.container) {
      case 'us':
        qualifiers += level + ':*';
        break;
      case 'place':
      case 'state':
        qualifiers += level + (':*&in=state:' + request.state);
        if (request.level == 'blockGroup') {
          qualifiers += '+county:' + request.county;
        }
        break;
      case 'county':
        qualifiers += level + (':*&in=county:' + request.county + '+state:' + request.state);
        break;
      case 'tract':
        qualifiers += level + (':*&in=tract:' + request.tract + '+county:' + request.county + '+state:' + request.state);
        break;
    }
  }

  // Only do this if the previous switch had no effect
  // (i.e. no contianer)
  if (qualifiers == 'for=') {
    switch (request.level) {
      case 'us':
        // If sublevel, add the appropriate for and attach the in
        if (request.sublevel) {
          qualifiers += 'state:*';
          cascade = true;
        } else {
          qualifiers += 'us:1';
        }

        break;
      case 'blockGroup':
        if (request.sublevel) {
          // Can't do this. No levels beneath. We'll set the sublevel to false here
          request.sublevel = false;
        }

        qualifiers += 'block+Group:' + request.blockGroup;

        if (!cascade) {
          qualifiers += '&in=';
          cascade = true;
        }

      case 'tract':
        // If sublevel, add the appropriate for and attach the in
        // We also check the cascade tag so we don't do this twice.
        if (request.sublevel && !cascade) {
          qualifiers += 'block+Group:*&in=';
          cascade = true;
        }

        qualifiers += 'tract:' + request.tract;

        if (!cascade) {
          qualifiers += '&in=';
          cascade = true;
        } else {
          qualifiers += '+';
        }

      case 'county':
        // If sublevel, add the appropriate for and attach the in
        // We also check the cascade tag so we don't do this twice.
        if (request.sublevel && !cascade) {
          qualifiers += 'tract:*&in=';
          cascade = true;
        }

        qualifiers += 'county:' + request.county;
        if (!cascade) {
          qualifiers += '&in=';
          cascade = true;
        } else {
          qualifiers += '+';
        }

      case 'place':
        // If sublevel, add the appropriate for and attach the in
        // Check for cascade so we don't do this twice
        if (request.sublevel && !cascade) {
          qualifiers += 'place:*&in=';
          cascade = true;
        } else if (!cascade) {
          //We only use place in the for, for the moment
          qualifiers += 'place:' + request.place + '&in=';
          cascade = true;
        }

      case 'state':
        // If sublevel, add the appropriate for and attach the in
        // We also check the cascade tag so we don't do this twice.
        if (request.sublevel && !cascade) {
          qualifiers += 'county:*&in=';
          cascade = true;
        }

        qualifiers += 'state:' + request.state;
        break;
    }
  }
  if (request.variables) {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = request.variables[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var variable = _step.value;

        if ((0, _reqUtils.is_normalizable)(variable)) {
          // add acs population variable
          if (request.variables.indexOf('population') < 0) {
            //We have a variable that is normalizable, but no population in the request.
            //Grab the population
            request.variables.push('population');
          }

          //We have normalizable variables AND a request for population, we can break the for loop now
          break;
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }
  }
  var variables = request.variables;
  var hasPopulation = false;

  for (var _i2 = 0; _i2 < variables.length; _i2++) {
    if ((0, _reqUtils.is_normalizable)(variables[_i2]) && !hasPopulation) {
      // add acs population variable
      if (request.variables.indexOf('population') < 0) {
        //We have a variable that is normalizable, but no population in the request.
        //Grab the population
        request.variables.push('population');
      }

      hasPopulation = true;
    }

    // Convert the aliased variables
    var variableIntermediate = (0, _reqUtils.parse_to_valid_variable)(request.variables[_i2], request.api, request.year);

    if (variableIntermediate) {
      request.variables[_i2] = variableIntermediate;
    }
  }

  // Add the Required Variables
  if (requiredVariables[request.api] && requiredVariables[request.api][request.year]) {
    for (var i = 0; i < requiredVariables[request.api][request.year].length; i++) {
      if (request.variables.indexOf(requiredVariables[request.api][request.year][i]) === -1) {
        request.variables.unshift(requiredVariables[request.api][request.year][i]);
      }
    }
  }

  // Add the variables to request string
  var variableString = request.variables.join(',');

  // URL for ACS5 request (summary file)
  var url = _defaults2.default.censusUrl;
  url += request.year + '/' + request.api + '?get=' + variableString + '&' + qualifiers + '&key=' + request.apikey;

  var promiseHandler = function promiseHandler(resolve, reject) {
    (0, _httpReqs.get_data)(url).then(function (response) {
      request = parse_summary_response(request, response);
      resolve(request);
    }).catch(function (reason) {
      return reject(reason);
    });
  };

  return new Promise(promiseHandler);
};

// main func

var geo_request = exports.geo_request = function geo_request(req) {
  var promiseHandler = function promiseHandler(resolve, reject) {
    (0, _main2.default)(req).then(tiger_req).then(handle_tigerweb_response).then(function (res) {
      resolve(res);
    }).catch(function (err) {
      reject(err);
    });
  };
  return new Promise(promiseHandler);
};