import express from 'express';
import city_kit from './core/main';
import {variable_to_alias, alias_to_variable} from './core/utils/data-utils';

let router = express.Router();

// get methods

router.get('/variable-to-alias', (req, res) => {
  function sendError(message) {
    res.sendStatus(400).send(message);
  }

  if (req.query && req.query.variables) {
    var variables = req.query.variables.split(',');

    try {
      var response = variable_to_alias(variables);
      res.json(response);
    } catch (e) {
      sendError(e);
    }
    
  } else {
    sendError('Missing query parameter: variables');
  }
});

router.get('/alias-to-variable', (req, res) => {
  function sendError(message) {
    res.sendStatus(400).send(message);
  }
  
  if (req.query && req.query.aliases) {
    var aliases = req.query.aliases.split(',');
    
    try {
      var response = alias_to_variable(aliases);
      res.json(response);
    } catch (e) {
      sendError(e);
    }
  } else {
    sendError('Missing query parameter: aliases');
  }
});

// post methods
router.post('/', (req, res) => {
  city_kit(req.body).then((response) => {
    res.json(response)
  });
});

export default router;