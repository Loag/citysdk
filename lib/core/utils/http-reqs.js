'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.post_data = exports.get_data = undefined;

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var get_data = exports.get_data = function get_data(url) {

  return new Promise(function (resolve, reject) {
    _request2.default.get({ url: url, rejectUnauthorized: false }, function (err, res) {
      if (!err) {
        resolve(JSON.parse(res.body));
      } else {
        reject(err);
      }
    });
  });
};

var post_data = exports.post_data = function post_data(url, data) {

  return new Promise(function (resolve, reject) {
    _request2.default.post({ url: url, form: data, rejectUnauthorized: false }, function (err, res) {
      if (!err) {
        resolve(JSON.parse(res.body));
      } else {
        reject(err);
      }
    });
  });
};