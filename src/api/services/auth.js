import request from 'request';
import basicAuth from 'basic-auth';

export const validateApiKey = (req, res, next) => {
  let apikey = basicAuth(req);

  if (!apikey || !apikey.name) return unauthorized(res);

  request.get('http://api.census.gov/data/?key=' + apikey.name, (err, res) => {
    if (!err) {
      JSON.parse(res.body);
      return next();
    } else {
      return unauthorized(res);
    }
  });
}

export const decodeAuthHeader = (req) => {
  let authHeader = req.header('Authorization').split(' ');
  let stringBuffer = new Buffer(authHeader[1], 'base64');
  return stringBuffer.toString().split(':')[0];
}

const unauthorized = (res) => {
  res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
  return res.sendStatus(401);
}