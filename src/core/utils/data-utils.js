import Terraformer from 'terraformer';
import ArcGIS from 'terraformer-arcgis-parser';
Terraformer.ArcGIS = ArcGIS;

import aliases from '../../../resources/aliases.json';
import stateNames from '../../../resources/us-state-names.json';
import variableToAliasMap from '../../../resources/var-alias-map.json';
import stateCapitalCoordinates from '../../../resources/us-states-latlng.json';

  /**
   * Returns a map of the most popular aliases.
   */

  export const get_sdk_aliases = () => {
    return aliases;
  }

  /**
   * @description Converts a Census variable, or a list of variables, to
   * its corresponding alias.
   * For example: for the variable B0009_00130 this function
   * would return "population" as the alias.
   *
   * @param variables
   * @returns {{}}
   */

  export const variable_to_alias = (variables) => {
    if(Object.prototype.toString.call(variables) !== '[object Array]') {
      variables = [variables];
    }
    
    let result = {};

    if (variables && variables.length) {
      for (let variable of variables) {
        result[variable] = variableToAliasMap[variable];
      }

      return result;

    } else {
      throw new Error('Invalid list of variables. Make sure multiple variables are comma separated.');
    }
  }

  /**
   * @description Converts an alias, or a list of aliases, to its corresponding
   * variable.
   * For example: the alias population would be converted to the
   * variable B0009_00130
   *
   * @param _aliases
   * @returns {{}}
   */

  export const alias_to_variable = (_aliases) => {
    if(Object.prototype.toString.call(_aliases) !== '[object Array]') {
      _aliases = [_aliases];
    }
    
    let result = {};

    if (_aliases && _aliases.length) {
      for (let alias of _aliases) {
        result[alias] = aliases[alias];
      }
    } else {
      throw new Error('Invalid list of aliases. Make sure multiple aliases are comma separated.');
    }

    return result;
   }

  /**
   * @description Converts ESRI JSON to GeoJSON
   *
   * @param {string} esriJson
   *
   * @returns {{type: string, features: Array}}
   */

  export const  esri_to_geo = (esriJson) => {
    if (!('features' in esriJson)) {
      // data is missing
      return null;
    }

    let features = esriJson.features;

    let geojson = {
      'type': 'FeatureCollection',
      'features': []
    };

    for (var i = 0; i < features.length; i++) {
      features[i].spatialReference = esriJson.spatialReference;
      geojson.features.push(Terraformer.ArcGIS.parse(features[i]));
    }

    return geojson;
  }


  /**
   * @description Converts geoJSON to ESRI JSON.
   * This is functionally an alias of Terraformer.ArcGIS.convert
   * (see https://github.com/Esri/Terraformer for details)
   *
   * @param {string} geoJson
   *
   * @returns {object}
   */
  export const geo_to_esri = (geoJson) => {
    return Terraformer.ArcGIS.convert(geoJson);
  }

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

  export const get_state_capital_coordinates = (state) => {
    // No string supplied
    if (!state) {
      return null;
    }

    state = state.toUpperCase().trim();

    if (state in stateCapitalCoordinates) {
      // state is a 2-letter state code and is valid
      return stateCapitalCoordinates[state];
    }

    // Look in US_STATE_NAMES
    state = state.toLowerCase();

    for (var statecode in stateNames) {
      if (state === stateNames[statecode]) {
        return stateCapitalCoordinates[statecode];
      }
    }

    // Nothing was found
    return null;
  }