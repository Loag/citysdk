'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _auth = require('./auth');

var _main = require('../../core/main');

var _main2 = _interopRequireDefault(_main);

var _dataUtils = require('../../core/utils/data-utils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var router = _express2.default.Router();

// get methods

router.get('/variable-to-alias', function (req, res) {
  function sendError(message) {
    res.sendStatus(400).send(message);
  }

  if (req.query && req.query.variables) {
    var variables = req.query.variables.split(',');

    try {
      var response = (0, _dataUtils.variable_to_alias)(variables);
      res.json(response);
    } catch (e) {
      sendError(e);
    }
  } else {
    sendError('Missing query parameter: variables');
  }
});

router.get('/alias-to-variable', function (req, res) {
  function sendError(message) {
    res.sendStatus(400).send(message);
  }

  if (req.query && req.query.aliases) {
    var aliases = req.query.aliases.split(',');

    try {
      var response = (0, _dataUtils.alias_to_variable)(aliases);
      res.json(response);
    } catch (e) {
      sendError(e);
    }
  } else {
    sendError('Missing query parameter: aliases');
  }
});

// post methods
router.post('/', function (req, res) {
  // req.body.apikey = decodeAuthHeader(req);
  (0, _main2.default)(req.body).then(function (response) {
    res.json(response);
  });
});

exports.default = router;