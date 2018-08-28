import request from 'request';

  export const get_data = (url) => {

    return new Promise((resolve, reject) => {
      request.get({url: url, rejectUnauthorized: false}, (err, res) => {
        if (!err) {
          resolve(JSON.parse(res.body));
        } else {
          reject(err);
        }
      });
    });
  }

  export const post_data = (url, data) => {

    return new Promise((resolve, reject) => {
      request.post({url: url, form: data, rejectUnauthorized: false}, (err, res) => {
        if (!err) {
            resolve(JSON.parse(res.body));
        } else {
          reject(err);
        }
      });
    });
  }