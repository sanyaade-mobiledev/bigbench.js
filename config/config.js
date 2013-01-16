// Configuration for test environment loaded using NODE_ENV=test
var test = {
  name: "test",
  redis: {
    host: "localhost",
    port: 6379
  }
};

// Configuration for development environment loaded using NODE_ENV=development
var development = {
  name: "development",
  redis: {
    host: "localhost",
    port: 6379
  }
};

// Configuration for production environment loaded using NODE_ENV=production or nothing
var production = {
  name: "production",
  redis: {
    host: "ADD_AN_IP_HERE",
    port: 6379,
    password: "ADD_A_PASSWORD_HERE"
  }
};

var environments = {
  "test":         test,
  "development":  development,
  "production":   production
};

// returns the config depending on the NODE_ENV
module.exports = environments[process.env.NODE_ENV || "production"];