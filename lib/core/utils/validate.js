'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.validate_geo_variables = exports.validate = exports.validate_api = undefined;

var _reqUtils = require('../utils/req-utils');

var availableDatasets = require('../../../resources/available-datasets.json');

// Defaults
var defaultApi = 'acs5';
var defaultLevel = 'blockGroup';
var defaultSublevel = false;

// Valid levels
var levels = new Set(['blockGroup', 'tract', 'county', 'state', 'us', 'place']);

var validate_api = exports.validate_api = function validate_api(request) {
  if (!request.api) {
    request.api = defaultApi;
  }

  return request;
};

var validate_api_year = function validate_api_year(request) {
  // Check if api is valid.
  if (availableDatasets[request.api]) {
    // Get available years for this api and sort the them in
    // ascending order.
    var availableApiYears = availableDatasets[request.api].sort();

    // If the request year was not provided or if it is invalid, set it to
    // the most recent year that is available for the requested api.
    if (!request.year || isNaN(+request.year) || availableApiYears.indexOf(request.year) === -1) {
      request.year = availableApiYears[availableApiYears.length - 1];
    }
  }

  return request;
};

var validate_level = function validate_level(request) {
  if (!request.level || !levels.has(request.level)) {
    request.level = defaultLevel;
  }

  return request;
};

var validate_sublevel = function validate_sublevel(request) {
  if (request.hasOwnProperty('sublevel')) {
    if (typeof request.sublevel !== 'boolean') {
      request.sublevel = request.sublevel === 'true';
    }
  } else {
    request.sublevel = defaultSublevel;
  }

  return request;
};

var validate = exports.validate = function validate(request) {
  return validate_sublevel(validate_level(validate_api_year(validate_api(request))));
};

var validate_geo_variables = exports.validate_geo_variables = function validate_geo_variables(request) {
  var promiseHandler = function promiseHandler(resolve, reject) {
    (0, _reqUtils.get_geography_variables)(request).then(function (response) {
      var fips = response.fips;
      var level = request.level;
      var valid = false;
      var requiredFields = void 0;

      if (level === 'blockGroup') {
        level = 'block group';
      }

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = fips[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var value = _step.value;

          if (value.name === level) {
            valid = true;
            var requires = value.requires;

            if (requires && requires.length) {
              var _iteratorNormalCompletion2 = true;
              var _didIteratorError2 = false;
              var _iteratorError2 = undefined;

              try {
                for (var _iterator2 = requires[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                  var required = _step2.value;

                  if (!request.hasOwnProperty(required)) {
                    valid = false;
                    break;
                  }
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
            }

            // Required fields are missing in the request.
            // Save them so that we can inform the user by
            // adding them to the error.
            if (!valid) {
              requiredFields = requires.join(', ');
            }

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

      request.geographyValidForAPI = valid;

      if (valid) {
        resolve(request);
      } else {
        if (requiredFields) {
          reject(new Error('Request is missing required fields: ' + requiredFields + '.'));
        } else {
          reject(new Error('Invalid level "' + level + '" for this request.'));
        }
      }
    }).catch(function (reason) {
      return reject(reason);
    });
  };

  return new Promise(promiseHandler);
};