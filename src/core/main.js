import {get_fips_from_Lat_Lng, get_Lat_Lng} from './utils/req-utils';
import {validate, validate_geo_variables} from './utils/validate';
import {summary_req, tiger_req, handle_tigerweb_response} from './utils/geo-req';

export default (req) => {
  let validated_req = validate(req);
  return get_Lat_Lng(validated_req)
    .then((data) => {
      return req_cascade(data);
    }).then((res) => {
      return res;
    }).catch((err) => {
      return err;
    });
}

const req_cascade = (data) => {
  return new Promise ((resolve, reject) => {
    get_fips_from_Lat_Lng(data)
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
  })
}