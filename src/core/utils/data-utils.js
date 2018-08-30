import Terraformer from 'terraformer';
import ArcGIS from 'terraformer-arcgis-parser';
Terraformer.ArcGIS = ArcGIS;

import aliases from '../../../large_resources/aliases.json';
import variableToAliasMap from '../../../large_resources/var-alias-map';

import stateCapitalCoordinates from '../resources/us-states-latlng';
import stateNames from '../resources/us-state-names';

  /**
   * @description Converts a Census variable, or a list of variables, to
   * its corresponding alias.
   * For example: for the variable B0009_00130 this function
   * would return "population" as the alias.
   * @param items - 
   */

  export const variable_to_alias = (items) => {
    if (!items) throw new Error('Invalid list of variables. Make sure multiple variables are comma separated.');
    if(!Array.isArray(items)) items = [items];
    return items.reduce((acc, cur) => {
     acc[cur] = variableToAliasMap[cur];
     return acc;
    }, {});
  }

  /**
   * @description Converts an alias, or a list of aliases, to its corresponding
   * variable.
   * For example: the alias population would be converted to the
   * variable B0009_00130
   *
   * @param items
   * @returns {{}}
   */

  export const alias_to_variable = (items) => {
    if (!items) throw new Error('Invalid list of aliases. Make sure multiple aliases are comma separated.');
    if(!Array.isArray(items)) items = [items];
    
    return items.reduce((acc, cur)=> {
      acc[cur] = items[cur];
      return acc;
    }, {})
  }

  /**
   * @description Converts ESRI JSON to GeoJSON
   *
   * @param {any} esriJson
   *
   * @returns {{type: string, features: Array}}
   */

  export const  esri_to_geo = (esriJson) => {
    if (Object.keys(esriJson).includes('features')) return null;
    
    let geo = esriJson.features.map((item, index) => {
      let mapObj = Object.assign({}, item, {spatialReference: esriJson.spatialReference})
      return Terraformer.ArcGIS.parse(mapObj)
    })

    return {
     'type': 'FeatureCollection',
     'features': geo
   };
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
    if (!state) return null;

    let cleaned_state = state.toUpperCase().trim();
    if (Object.keys(stateCapitalCoordinates).includes(cleaned_state)) {
      return stateCapitalCoordinates[state];
    } else {
      let full_state = state.toLowerCase();
      if (Object.keys(stateNames).includes(full_state)) {
        return stateCapitalCoordinates[(stateNames[full_state])];
      }
    }
    return null;
  }