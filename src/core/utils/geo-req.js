import main from '../main';
import {get_data, post_data} from './http-reqs';
import {geo_to_esri, esri_to_geo} from './data-utils';

import {parse_to_valid_variable, is_normalizable} from '../utils/req-utils';
import defaults from '../utils/defaults';

const servers = require('../../../resources/servers.json');
const usBoundingBox = require( '../../../resources/us-bounds.json');
const requiredVariables = require('../../../resources/required-variables.json');

  export const supplemental_request = (req, res, featureIndex) => {
    let i = featureIndex;
    let features = res.features;
    let variables = req.variables;

    // Sometimes cities span multiple counties. In this case,
    // we sometimes miss data due to the limited nature of
    // the Census API's geography hierarchy. This will issue
    // supplemental requests to ensure we have data for all of
    // our geojson entities

    let suppRequest = {
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

    let promiseHandler = (resolve, reject) => {
      let censusSummaryRequest = summary_req(suppRequest);

      censusSummaryRequest.then((response) => {
        for (let property in response.data[0]) {
          if (response.data[0].hasOwnProperty(property)) {
            features[response.featuresIndex].properties[property] = response.data[0][property];

            if (variables && variables.indexOf(property) !== -1) {
              res.totals[property] = Number(res.totals[property]) >= 0 ? Number(response.data[0][property]) : 0;
            }
          }
        }

        resolve(response);
      });

      censusSummaryRequest.catch((reason) => {
        reject(reason);
      });
    };

    return new Promise(promiseHandler);
  }

  // tiger web utils

  const get_container_geometry = (request) => {
    let mapServer = request.tigerwebApiInfo.mapServers[request.container];
    let tigerwebUrl = request.tigerwebApiInfo.url.replace('{mapserver}', mapServer);
    let tigerwebRequest = request.tigerwebRequest;

    tigerwebRequest.geometry = request.lng + "," + request.lat;
    tigerwebRequest.geometryType = "esriGeometryPoint";
    tigerwebRequest.spatialRel = "esriSpatialRelIntersects";

    let promiseHandler = (resolve, reject) => {
      post_data(tigerwebUrl, tigerwebRequest).then((response) => {
        let features = response.features;

        // Grab our container ESRI geography, attach it to our request,
        // and call this function again.
        if (request.container.toLowerCase() === "us") {
          request.containerGeometry = geo_to_esri(usBoundingBox)[0].geometry;
        } else {
          request.containerGeometry = features[0].geometry;
        }

        resolve(request);
      }).catch((reason) => reject(reason));
    };

    return new Promise(promiseHandler);
  }

  const get_geo_data = (request) => {
    // We have a sublevel request with a container,
    // AND we've already grabbed the container's ESRI json
    let mapServer = request.tigerwebApiInfo.mapServers[request.level];
    let tigerwebUrl = request.tigerwebApiInfo.url.replace('{mapserver}', mapServer);
    let tigerwebRequest = request.tigerwebRequest;
    
    tigerwebRequest.geometry = JSON.stringify(request.containerGeometry);
    tigerwebRequest.geometryType = "esriGeometryPolygon";

    tigerwebRequest.spatialRel = request.container === "place" || request.container === "geometry"
        ? "esriSpatialRelIntersects"
        : "esriSpatialRelContains";

    let promiseHandler = (resolve, reject) => {
      post_data(tigerwebUrl, tigerwebRequest).then((response) => {
        resolve(response);
      }).catch((reason) => {
        reject(reason)
      });
    };
    return new Promise(promiseHandler);
  }

  export const tiger_req = (request) => {
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

    const sublevelRequested = request.hasOwnProperty('sublevel') && request.sublevel;

    let promiseHandler = (resolve, reject) => {
      if (request.container && sublevelRequested && !request.containerGeometry) {
        get_container_geometry(request)
          .then(get_geo_data)
          .then((response) => {
            resolve({response: esri_to_geo(response), request: request})
          })
          .catch((reason) => {
            reject(reason)
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

        get_container_geometry(request)
          .then(get_geo_data)
          .then((response) => {
            resolve({response: esri_to_geo(response), request: request})
          })
          .catch((reason) => {
            reject(reason)
          });
        
      } else {

        let mapServer = request.tigerwebApiInfo.mapServers[request.level];
        let tigerwebUrl = request.tigerwebApiInfo.url.replace('{mapserver}', mapServer);
        let tigerwebRequest = request.tigerwebRequest;

        tigerwebRequest.geometry = request.lng + "," + request.lat;
        tigerwebRequest.geometryType = "esriGeometryPoint";
        tigerwebRequest.spatialRel = "esriSpatialRelIntersects";

        post_data(tigerwebUrl, tigerwebRequest)
          .then((response) => {
            resolve({response: esri_to_geo(response), request: request})
          })
          .catch((err) => {
            reject(err);
          });
      }
    };
    return new Promise(promiseHandler);
  }

  export const handle_tigerweb_response = (tigerwebResponse) => {
    let request = tigerwebResponse.request;
    let response = tigerwebResponse.response;
    let supplementalRequests = [];

    // Reference dictionary of levels -> geocoder response variables
    let comparisonVariables = {
      'tract': 'TRACT',
      'place': 'PLACE',
      'county': 'COUNTY',
      'blockGroup': 'BLKGRP'
    };

    if (!response.totals) {
      response.totals = {};
    }

    if (request.data) {
      let data = request.data;
      let variables = request.variables;
      let totals = response.totals;
      let features = response.features;

      let matchedFeature;

      features.forEach((f, i) => {
        matchedFeature = data.filter((d) => {
          // Ensure we have a direct match for low level items by comparing the higher level items
          if (request.level === 'blockGroup' || request.level === 'tract') {
            let levelMatch = d[request.level] === f.properties[comparisonVariables[request.level]];
            let tractMatch = d['tract'] === f.properties.TRACT;
            let countyMatch = d['county'] === f.properties.COUNTY;

            return levelMatch && tractMatch && countyMatch;

          } else {
            return d[request.level] === f.properties[comparisonVariables[request.level]];
          }
        });

        if (matchedFeature.length === 0) {
          supplementalRequests.push(supplemental_request(request, response, i))

        } else if (matchedFeature.length === 1) {
          // We have matched the feature's tract to a data tract, move the data over
          matchedFeature = matchedFeature[0];

          for (let property in matchedFeature) {
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

    let promiseHandler = (resolve, reject) => {
      // If supplemental requests were needed, wait for all
      // to finish.
      if (supplementalRequests.length) {
        Promise.all(supplementalRequests)
            .then(() => resolve(response))
            .catch((reason) => reject(reason))

      } else {
        setTimeout(() => resolve(response), 0);
      }
    };

    return new Promise(promiseHandler);
  }

 // summary req funcs
 const parse_summary_response = (request, response) => {
    request.data = [];

    if (request.sublevel) {
      // If sublevel is set to true, our 'data' property
      // will be an array of objects for each sublevel item.
      let currentVariable;
      let currentResponseItem;
      let currentDataObject;

      for (let i = 1; i < response.length; i++) {
        currentDataObject = {};
        currentResponseItem = response[i];

        if (['sf1', 'sf3'].indexOf(request.api) && request.year.toString() == '1990') {
          // Hardcoded rule for decennial survey of 1990
          currentDataObject['name'] = currentResponseItem[response[0].indexOf('ANPSADPI')];
        } else {
          // ACS survey & SF survey not 1990
          currentDataObject['name'] = currentResponseItem[response[0].indexOf('NAME')];
        }

        let stateIndex = response[0].indexOf('state');
        let countyIndex = response[0].indexOf('county');
        let tractIndex = response[0].indexOf('tract');
        let blockGroupIndex = response[0].indexOf('block group');
        let placeIndex = response[0].indexOf('place');

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

        for (let j = 0; j < request.variables.length; j++) {
          currentVariable = request.variables[j];

          let validVariable = parse_to_valid_variable(currentVariable, request.api, request.year);
          let index = response[0].indexOf(validVariable);
          let intermediateVar = currentResponseItem[index];

          if (intermediateVar) {
            currentDataObject[currentVariable] = intermediateVar;
          }

          // Variable is Normalizeable
          if (intermediateVar && is_normalizable(currentVariable)
              && parse_to_valid_variable('population', request.api, request.year)) {

            let validVariable = parse_to_valid_variable('population', request.api, request.year);
            let index = response[0].indexOf(validVariable);
            let property = currentVariable + '_normalized';

            currentDataObject[property] = currentDataObject[currentVariable] / currentResponseItem[index];
          }
        }

        request.data.push(currentDataObject);
      }
    } else {
      // We don't have sublevel, so we just grab the single response
      let currentVariable;
      let currentDataObject = {};

      for (let i = 0; i < request.variables.length; i++) {
        currentVariable = request.variables[i];

        if (parse_to_valid_variable(currentVariable, request.api, request.year)) {
          let validVariable = parse_to_valid_variable(currentVariable, request.api, request.year);
          let index = response[0].indexOf(validVariable);

          currentDataObject[currentVariable] = response[1][index];
        }

        if (currentDataObject[currentVariable] && is_normalizable(currentVariable)
            && parse_to_valid_variable('population', request.api, request.year)) {

          let validVariable = parse_to_valid_variable('population', request.api, request.year);
          let index = response[1].indexOf(validVariable);
          let property = currentVariable + '_normalized';

          currentDataObject[property] = currentDataObject[currentVariable] / response[1][index];
        }

        request.data.push(currentDataObject);
      }
    }

    delete request.geocoded;
    
    return request;
  }

  // summary req funcs

  export const summary_req = (request) => {
    let cascade = false;
    let qualifiers = 'for=';

    if (request.sublevel) {
      let level = (request.level === 'blockGroup') ? 'block+group' : request.level;

      switch (request.container) {
        case 'us':
          qualifiers += level + ':*';
          break;
        case 'place':
        case 'state':
          qualifiers += level + `:*&in=state:${request.state}`;
          if (request.level == 'blockGroup') {
            qualifiers += `+county:${request.county}`;
          }
          break;
        case 'county':
          qualifiers += level + `:*&in=county:${request.county}+state:${request.state}`;
          break;
        case 'tract':
          qualifiers += level + `:*&in=tract:${request.tract}+county:${request.county}+state:${request.state}`;
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

          qualifiers += `block+Group:${request.blockGroup}`;

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

          qualifiers += `tract:${request.tract}`;

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

          qualifiers += `county:${request.county}`;
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
            qualifiers += `place:${request.place}&in=`;
            cascade = true;
          }

        case 'state':
          // If sublevel, add the appropriate for and attach the in
          // We also check the cascade tag so we don't do this twice.
          if (request.sublevel && !cascade) {
            qualifiers += 'county:*&in=';
            cascade = true;
          }

          qualifiers += `state:${request.state}`;
          break;
      }
    }
    if (request.variables) {
    for (let variable of request.variables) {
      if (is_normalizable(variable)) {
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
   }
    let variables = request.variables;
    let hasPopulation = false;
    
    for (let i = 0; i < variables.length; i++) {
      if (is_normalizable(variables[i]) && !hasPopulation) {
        // add acs population variable
        if (request.variables.indexOf('population') < 0) {
          //We have a variable that is normalizable, but no population in the request.
          //Grab the population
          request.variables.push('population');
        }

        hasPopulation = true;
      }

      // Convert the aliased variables
      let variableIntermediate = parse_to_valid_variable(request.variables[i], request.api, request.year);
      
      if (variableIntermediate) {
        request.variables[i] = variableIntermediate;
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
    let variableString = request.variables.join(',');

    // URL for ACS5 request (summary file)
    var url = defaults.censusUrl;
    url += `${request.year}/${request.api}?get=${variableString}&${qualifiers}&key=${request.apikey}`;

    let promiseHandler = (resolve, reject) => {
      get_data(url).then((response) => {
        request = parse_summary_response(request, response);
        resolve(request);
        
      }).catch((reason) => reject(reason));
    };

    return new Promise(promiseHandler);
  }

  // main func

  export const geo_request = (req) => {
    let promiseHandler = (resolve, reject) => {
      main(req)
        .then(tiger_req)
        .then(handle_tigerweb_response)
        .then((res) => {
          resolve(res)
        })
        .catch((err) => {
          reject(err)
        })
    };
    return new Promise(promiseHandler);
  }

  