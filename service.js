const axios = require("axios");

const service = axios.create({
  timeout: 30000
});
service.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (err) => {
    console.log(err.message);
    return Promise.resolve({ result: { offers: [] } });
  }
);

module.exports = service;