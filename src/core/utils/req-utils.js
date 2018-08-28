import {get_data} from './http-reqs';
const aliases = require('../../../resources/aliases.json'); 
const stateCapitalsLatLng = require('../../../resources/us-states-latlng.json');

  export const parse_to_variable = (aliasOrVariable, aliases) => {
    // If the requested string is an alias, return the appropriate variable from the dictionary
    if (aliasOrVariable in aliases) {
      return aliases[aliasOrVariable].variable;
    }

    // Otherwise, this is either already a variable name or is unsupported
    return aliasOrVariable;
  }

  export const parse_to_valid_variable = (aliasOrVariable, api, year) => {
    // If the requested string is an alias, return the appropriate variable from the dictionary
    if (aliasOrVariable in aliases) {
      if (api in aliases[aliasOrVariable]['api']
          && aliases[aliasOrVariable]['api'][api].indexOf(parseInt(year)) !== -1) {

        // Alias found and is valid for selected API & year combination
        return aliases[aliasOrVariable].variable;

      } else {
        // Alias found but is NOT valid for selected API and year combination
        throw new Error('Invalid alias for selected API and year combination.');
      }
    }

    // Otherwise, this is either already a variable name or is unsupported
    return aliasOrVariable;
  }

  export const is_normalizable = (alias) => {
    return alias in aliases && 'normalizable' in aliases[alias] && aliases[alias].normalizable;
  }

  export const get_Lat_Lng_from_state_code = (stateCode) => {
    return stateCapitalsLatLng[stateCode.toUpperCase()];
  }

  export const get_Lat_Lng_From_zip_code = (zip) => {
    return new Promise((resolve, reject) => {
      get_data('https://s3.amazonaws.com/citysdk/zipcode-to-coordinates.json').then((coordinates) => {
        resolve(coordinates[zip]);
      }).catch((reason) => {
        reject(reason);
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
  const get_Lat_Lng_from_address = (address, url) => {

    // Address is required. If address is not present,
    // then the request will fail.
    if (!address.street) {
      throw new Error('Invalid address! The required field "street" is missing.')
    }

    if (!address.city && !address.state && !address.zip) {
      throw new Error('Invalid address! "city" and "state" or "zip" must be provided.');
    }

    url += `&street=${address.street}`;

    if (address.zip) {
      url += `&zip=${address.zip}`;
    }
    else if (address.city && address.state) {
      url += `&city=${address.city}&state=${address.state}`;
    }

    else {
      throw new Error('Invalid address! "city" and "state" or "zip" must be provided.');
    }

    return get_data(url);
  }

  export const get_Lat_Lng = (request) => {
    console.log(request);
    let promiseHandler = (resolve, reject) => {

      if (request.address) {

        get_Lat_Lng_from_address(request.address, '')
        .then((response) => {
          let coordinates = response.result.addressMatches[0].coordinates;
          request.lat = coordinates.y;
          request.lng = coordinates.x;
          resolve(request);
        }).catch((reason) => {
          reject(reason);
        })

      } else if (request.zip) {

        get_Lat_Lng_From_zip_code(request.zip, '')
        .then((coordinates) => {
          request.lat = coordinates[1];
          request.lng = coordinates[0];
          resolve(request);
        }).catch((reason) => {
          reject(reason);
        });

      } else if (request.state) {
        // Since this function returns a promise we want this to be an asynchronous
        // call. Therefore, we wrap in a setTimout() since it allows the function to
        // return before the code inside the setTimeout is excecuted.
        
        // this needs to be changed
        setTimeout(() => {
          let coordinates = get_Lat_Lng_from_state_code(request.state);
          request.lat = coordinates[0];
          request.lng = coordinates[1];

          resolve(request);
        }, 0);

      } else {
        reject("One of 'address', 'state' or 'zip' must be provided.");
      }
    };
    return new Promise(promiseHandler);
  }

  export const get_fips_from_Lat_Lng = (request) => {
    // Benchmark id: 4 = Public_AR_Current
    // Vintage id: 4 = Current_Current
    let req_url = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates?x=${request.lng}&y=${request.lat}&benchmark=4&vintage=4&layers=8,12,28,84,86&format=jsonp`;

    let promiseHandler = (resolve, reject) => {
      get_data(req_url)
      .then((res) => {
        let geographies = res.result.geographies;

        // The 2010 Census Blocks object seems to have
        // the FIPS codes for all the level we need.
        let fips = geographies['2010 Census Blocks'][0];

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

      }).catch((err) => {
       reject(err);
      })
    };
    return new Promise(promiseHandler);
  }

  export const get_geography_variables = (request) => {
    if (!request.api || !request.year) throw new Error('Invalid request! "year" and "api" fields must be provided.');
    return get_data(`https://api.census.gov/data/${request.year}/${request.api}/geography.json`);
  }