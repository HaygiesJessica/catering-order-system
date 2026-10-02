'use strict';

const app = require('../../server/server');

module.exports.handler = async (event, context) => {
  return new Promise((resolve, reject) => {
    const req = {
      method: event.httpMethod,
      url: event.path + (event.rawQuery ? `?${event.rawQuery}` : ''),
      headers: event.headers,
      body: event.body,
    };

    const res = {
      statusCode: 200,
      headers: {},
      body: '',
      setHeader(name, value) {
        this.headers[name] = value;
      },
      getHeader(name) {
        return this.headers[name];
      },
      end(body) {
        this.body = body || '';
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: this.body,
        });
      },
    };

    app(req, res, (err) => {
      if (err) reject(err);
    });
  });
};