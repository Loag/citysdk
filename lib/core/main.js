'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _reqUtils = require('./utils/req-utils');

var _validate = require('./utils/validate');

var _geoReq = require('./utils/geo-req');

/**
 * @description Runs the given request through the Census
 * API pipeline and returns a response consisting of GeoJson
 * and Census data.
 *
 * @param request
 * @returns {*}
 */

exports.default = function (req) {
  var request = (0, _validate.validate)(req);

  var promiseHandler = function promiseHandler(resolve, reject) {

    var onRequestHasLatLng = function onRequestHasLatLng(request) {
      (0, _reqUtils.get_fips_from_Lat_Lng)(request).then(_validate.validate_geo_variables).then(_geoReq.summary_req).then(_geoReq.tiger_req).then(_geoReq.handle_tigerweb_response).then(function (response) {
        resolve(response);
      }).catch(function (reason) {
        reject(reason);
      });
    };

    if (!request.lat && !request.lng) {
      // Get the coordinates, then using the coordinates, get
      // the FIPS codes for state, tract, county and blockGroup.
      (0, _reqUtils.get_Lat_Lng)(request).then(onRequestHasLatLng).catch(function (reason) {
        return reject(reason);
      });
    } else {
      onRequestHasLatLng(request);
    }
  };

  return new Promise(promiseHandler);
};