'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.decodeAuthHeader = exports.validateApiKey = undefined;

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _basicAuth = require('basic-auth');

var _basicAuth2 = _interopRequireDefault(_basicAuth);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var validateApiKey = exports.validateApiKey = function validateApiKey(req, res, next) {
  var apikey = (0, _basicAuth2.default)(req);

  if (!apikey || !apikey.name) return unauthorized(res);

  _request2.default.get('http://api.census.gov/data/?key=' + apikey.name, function (err, res) {
    if (!err) {
      JSON.parse(res.body);
      return next();
    } else {
      return unauthorized(res);
    }
  });
};

var decodeAuthHeader = exports.decodeAuthHeader = function decodeAuthHeader(req) {
  var authHeader = req.header('Authorization').split(' ');
  var stringBuffer = new Buffer(authHeader[1], 'base64');
  return stringBuffer.toString().split(':')[0];
};

var unauthorized = function unauthorized(res) {
  res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
  return res.sendStatus(401);
};