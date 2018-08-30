import {get_data} from './http-reqs';
const aliases = require('../../../large_resources/aliases.json'); 
import stateCapitalsLatLng from '../resources/us-states-latlng';

  /**
   * @description 
   * If the requested string is an alias, return the appropriate variable from the dictionary
   * Otherwise, this is either already a variable name or is unsupported
   */

  export const parse_to_variable = (aliasOrVariable) => {
    if (Object.keys(aliases).includes(aliasOrVariable)) return aliases[aliasOrVariable]['variable'];
    return aliasOrVariable;
  }

  export const parse_to_valid_variable = (aliasOrVariable, api, year) => {
    if (Object.keys(aliases).includes(aliasOrVariable)) {
      if (api in aliases[aliasOrVariable]['api'] && aliases[aliasOrVariable]['api'][api].indexOf(parseInt(year)) !== -1) {
        return aliases[aliasOrVariable]['variable'];
      } else {
        throw 'Invalid alias for selected API and year combination.';
      }
    }
    return aliasOrVariable;
  }

  export const is_normalizable = (alias) => {
    return Object.keys(aliases).includes(alias) && Object.keys(aliases[alias]).includes('normalizable') && aliases[alias]['normalizable'];
  }

  export const get_Lat_Lng_from_state_code = (stateCode) => {
    return stateCapitalsLatLng[stateCode.toUpperCase()];
  }

  export const get_Lat_Lng_From_zip_code = (zip) => {
    return new Promise((resolve, reject) => {
      get_data('https://s3.amazonaws.com/citysdk/zipcode-to-coordinates.json').then((res) => {
        resolve(res[zip]);
      }).catch((err) => {
        reject(err);
      })
    });
  }

  /**
   * Takes an address object with the fields "street", "city", "state", and "zip".
   * Either city and state or zip must be provided with the street.
   *
   * @param address
   *
   * @returns {promise}
   */

  // addressGeocoderUrl need this
  const get_Lat_Lng_from_address = (address) => {
    if (!address.street) throw 'Invalid address! The required field "street" is missing.';
    if (!address.city && !address.state && !address.zip) throw 'Invalid address! "city" and "state" or "zip" must be provided.';

    let url = `https://geocoding.geo.census.gov/geocoder/locations/address?benchmark=4&format=jsonp&street=${address.street}`;
    
    if (address.zip) url += `&zip=${address.zip}`;
    else if (address.city && address.state) url += `&city=${address.city}&state=${address.state}`;
    else throw 'Invalid address! "city" and "state" or "zip" must be provided.';

    return get_data(url);
  }

  export const get_Lat_Lng = (request) => {
    return new Promise((resolve, reject) => {

      if (request.address) {

        get_Lat_Lng_from_address(request.address)
        .then((res) => {
          let coordinates = res.result.addressMatches[0].coordinates;
          resolve(Object.assign({}, request, {lat: coordinates.y, lng: coordinates.x}));
        }).catch((err) => {
          reject(err);
        })
      } else if (request.zip) {

        get_Lat_Lng_From_zip_code(request.zip)
        .then((coordinates) => {
          resolve(Object.assign({}, request, {lat: coordinates[1], lng: coordinates[0]}));
        }).catch((err) => {
          reject(err);
        });
      } else if (request.state) {
        let coordinates = get_Lat_Lng_from_state_code(request.state);
        request.lat = coordinates[0];
        request.lng = coordinates[1];

        resolve(request);
      } else {
        reject("One of 'address', 'state' or 'zip' must be provided.");
      }
    });
  }

  export const get_fips_from_Lat_Lng = (request) => {
    let req_url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${request.lng}&y=${request.lat}&benchmark=4&vintage=4&layers=8,12,28,84,86&format=jsonp`;

    return new Promise((resolve, reject) => {
      return get_data(req_url).then((res) => {

        let geographies = res.result.geographies;
        let fips = geographies['2010 Census Blocks'][0];
        let res_data = Object.assign({}, request, {state: fips.STATE, tract: fips.TRACT, county: fips.COUNTY, blockGroup: fips.BLKGRP, geocoded: true});

        if (geographies['Incorporated Places'] && geographies['Incorporated Places'].length) resolve(Object.assign({}, res_data, {place: geographies['Incorporated Places'][0].PLACE, place_name: geographies['Incorporated Places'][0].NAME}));

        resolve(res_data);
      }).catch((err) => {
       reject(err);
      })
    });
  }

  export const get_geography_variables = (request) => {
    if (!request.api || !request.year) throw ('Invalid request! "year" and "api" fields must be provided.');
    return get_data(`https://api.census.gov/data/${request.year}/${request.api}/geography.json`);
  }