'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.get_state_capital_coordinates = exports.geo_to_esri = exports.esri_to_geo = exports.alias_to_variable = exports.variable_to_alias = exports.get_sdk_aliases = undefined;

var _terraformer = require('terraformer');

var _terraformer2 = _interopRequireDefault(_terraformer);

var _terraformerArcgisParser = require('terraformer-arcgis-parser');

var _terraformerArcgisParser2 = _interopRequireDefault(_terraformerArcgisParser);

var _aliases2 = require('../../../resources/aliases.json');

var _aliases3 = _interopRequireDefault(_aliases2);

var _usStateNames = require('../../../resources/us-state-names.json');

var _usStateNames2 = _interopRequireDefault(_usStateNames);

var _varAliasMap = require('../../../resources/var-alias-map.json');

var _varAliasMap2 = _interopRequireDefault(_varAliasMap);

var _usStatesLatlng = require('../../../resources/us-states-latlng.json');

var _usStatesLatlng2 = _interopRequireDefault(_usStatesLatlng);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_terraformer2.default.ArcGIS = _terraformerArcgisParser2.default;

/**
 * Returns a map of the most popular aliases.
 */

var get_sdk_aliases = exports.get_sdk_aliases = function get_sdk_aliases() {
  return _aliases3.default;
};

/**
 * @description Converts a Census variable, or a list of variables, to
 * its corresponding alias.
 * For example: for the variable B0009_00130 this function
 * would return "population" as the alias.
 *
 * @param variables
 * @returns {{}}
 */

var variable_to_alias = exports.variable_to_alias = function variable_to_alias(variables) {
  if (Object.prototype.toString.call(variables) !== '[object Array]') {
    variables = [variables];
  }

  var result = {};

  if (variables && variables.length) {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = variables[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var variable = _step.value;

        result[variable] = _varAliasMap2.default[variable];
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

    return result;
  } else {
    throw new Error('Invalid list of variables. Make sure multiple variables are comma separated.');
  }
};

/**
 * @description Converts an alias, or a list of aliases, to its corresponding
 * variable.
 * For example: the alias population would be converted to the
 * variable B0009_00130
 *
 * @param _aliases
 * @returns {{}}
 */

var alias_to_variable = exports.alias_to_variable = function alias_to_variable(_aliases) {
  if (Object.prototype.toString.call(_aliases) !== '[object Array]') {
    _aliases = [_aliases];
  }

  var result = {};

  if (_aliases && _aliases.length) {
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = _aliases[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var alias = _step2.value;

        result[alias] = _aliases3.default[alias];
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }
  } else {
    throw new Error('Invalid list of aliases. Make sure multiple aliases are comma separated.');
  }

  return result;
};

/**
 * @description Converts ESRI JSON to GeoJSON
 *
 * @param {string} esriJson
 *
 * @returns {{type: string, features: Array}}
 */

var esri_to_geo = exports.esri_to_geo = function esri_to_geo(esriJson) {
  if (!('features' in esriJson)) {
    // data is missing
    return null;
  }

  var features = esriJson.features;

  var geojson = {
    'type': 'FeatureCollection',
    'features': []
  };

  for (var i = 0; i < features.length; i++) {
    features[i].spatialReference = esriJson.spatialReference;
    geojson.features.push(_terraformer2.default.ArcGIS.parse(features[i]));
  }

  return geojson;
};

/**
 * @description Converts geoJSON to ESRI JSON.
 * This is functionally an alias of Terraformer.ArcGIS.convert
 * (see https://github.com/Esri/Terraformer for details)
 *
 * @param {string} geoJson
 *
 * @returns {object}
 */
var geo_to_esri = exports.geo_to_esri = function geo_to_esri(geoJson) {
  return _terraformer2.default.ArcGIS.convert(geoJson);
};

/**
* @function getStateCapitalCoords
* @static
*
* @description Gets the coordinates of a state's capital
* from it's name or 2-letter code.
*
* @param {string} state Name or 2-letter code of the state
* (case insensitive)
*
* @return {Array} Returns 2-position array of Lat & Long
* for the capital of the state. Returns false if no state is found.
*/

var get_state_capital_coordinates = exports.get_state_capital_coordinates = function get_state_capital_coordinates(state) {
  // No string supplied
  if (!state) {
    return null;
  }

  state = state.toUpperCase().trim();

  if (state in _usStatesLatlng2.default) {
    // state is a 2-letter state code and is valid
    return _usStatesLatlng2.default[state];
  }

  // Look in US_STATE_NAMES
  state = state.toLowerCase();

  for (var statecode in _usStateNames2.default) {
    if (state === _usStateNames2.default[statecode]) {
      return _usStatesLatlng2.default[statecode];
    }
  }

  // Nothing was found
  return null;
};