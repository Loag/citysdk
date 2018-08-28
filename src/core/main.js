import {get_fips_from_Lat_Lng, get_Lat_Lng} from './utils/req-utils';
import {validate, validate_geo_variables} from './utils/validate';
import {summary_req, tiger_req, handle_tigerweb_response} from './utils/geo-req';

  /**
   * @description Runs the given request through the Census
   * API pipeline and returns a response consisting of GeoJson
   * and Census data.
   *
   * @param request
   * @returns {*}
   */
  
  export default (req) => {
    let request = validate(req);

    let promiseHandler = (resolve, reject) => {
     
      let onRequestHasLatLng = (request) => {
        get_fips_from_Lat_Lng(request)
          .then(validate_geo_variables)
          .then(summary_req)
          .then(tiger_req)
          .then(handle_tigerweb_response)
          .then((response) => {
            resolve(response)
          })
          .catch((reason) => {
            reject(reason)
          });
      };

      if (!request.lat && !request.lng) {
        // Get the coordinates, then using the coordinates, get
        // the FIPS codes for state, tract, county and blockGroup.
        get_Lat_Lng(request)
          .then(onRequestHasLatLng)
          .catch((reason) => reject(reason));

      } else {
        onRequestHasLatLng(request);
      }
    };

    return new Promise(promiseHandler);
  }