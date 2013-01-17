var storage       = require("../modules/storage"),
    bot           = require("../modules/bot"),
    tracker       = require("../modules/tracker"),
    config        = require("../config/config"),
    crypto        = require('crypto'),
    http          = require('http'),
    agent         = new http.Agent({ maxSockets: 1 }),
    fs            = require('fs'),
    querystring   = require("querystring"),
    status        = "STOPPED",
    stopCallback  = null,
    blue          = '\u001b[32m',
    reset         = '\u001b[0m';


// Global running state
exports.start   = function(){
  status = "RUNNING";
  bot.status(status);
  stopCallback = null;
}
exports.stop    = function(){
  status = "STOPPED";
  bot.status(status);
  if(stopCallback){ stopCallback(); }
}
exports.status  = function(){ return status; }

// Flushes the redis and globally saves a benchark string as a closure
exports.save = function(benchmarkString, callback){
  var benchmarkClosure = "(function(){ return " + benchmarkString + "});";
  storage.redis.flushall(function(){
    storage.redis.set("bigbench_benchmark", benchmarkClosure, function(){
      storage.redis.publish("bigbench_benchmark_saved", benchmarkClosure);
      console.log(blue + "Saved" + reset);
      callback();
    });
  });
}

// Loads and evaluates a benchmark string as closure from the global store
exports.load = function(callback){
  storage.redis.get("bigbench_benchmark", function(error, benchmarkString){
    if(benchmarkString){ callback(eval(benchmarkString)());
    } else{              callback(false); }
  });
}

// Runs the latest benchmark
exports.run = function(done){
  if(status !== "STOPPED"){ return; }
  
  // load
  exports.load(function(benchmark){
    
    // delay
    benchmark.delay = benchmark.delay || 0;
    
    // stop
    setTimeout(exports.stop, benchmark.duration * 1000);
    
    // start
    exports.start();
    exports.request(benchmark, 0);
    stopCallback = done;
  });
}

// Cycle through all actions and request it
exports.request = function(benchmark, index){
  if(status !== "RUNNING"){ return; }
  
  var action  = benchmark.actions[index],
      options = exports.validateAction(action),
      request = http.request(options, function(response) {
        response.setEncoding('utf8');
        response.on('end', function () {
          
          // track
          tracker.track(index, response.statusCode);
          
          // next action / request
          index += 1;
          if(index > benchmark.actions.length - 1){ index = 0 };
          
          // call with or without delay
          if(benchmark.delay <= 0){ exports.request(benchmark, index); }
          else{ setTimeout(function(){exports.request(benchmark, index); }, benchmark.delay); }
        });
      });
  
  
  // send post params in body
  if(action.method === "POST"){ request.write(exports.validateParams(action.params)); }
  
  request.end();
}

// Ensures the action maps the parameters, etc.
exports.validateAction = function(action){
  var options = { agent: agent };
  if(action.host){      options.host      = action.host; };
  if(action.hostname){  options.hostname  = action.hostname; };
  if(action.path){      options.path      = action.path; };
  if(action.port){      options.port      = action.port; };
  if(action.method){    options.method    = action.method; };
  if(action.auth){      options.auth      = action.auth; };
  
  // add query string to path
  if(action.method !== "POST"){ options.path += "?" + exports.validateParams(action.params); }
  
  // set post header
  if(action.method === "POST"){ options.headers = { "Content-type": "application/x-www-form-urlencoded" }; }
  
  return options;
}

// Checks weather params is an object or function and converts it to an object
exports.validateParams = function(params){
  if(!params || params === ""){ return ""; }
  return querystring.stringify(exports.toObject(params));
}

// Checks if the supplied object is a function
exports.isFunction = function(obj){
  return !!(obj && obj.constructor && obj.call && obj.apply);
}

// Checks if the supplied object is a function
exports.toObject = function(objectOrFunction){
  return exports.isFunction(objectOrFunction) ? objectOrFunction() : objectOrFunction;
}

// Checks whether a string ends with a suffix like ".js"
exports.endsWith = function(str, suffix) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// Copies the benchmark template to the current directory for the new command
exports.createBenchmarkFromTemplate = function(callback){
  var template = fs.createReadStream('./templates/benchmark.js'),
      copy     = fs.createWriteStream('benchmark.js');
  
  // Callback if finished writing
  template.on("end", function() {
    console.log(blue + "Created benchmark.js" + reset);
    callback();
  });
  template.pipe(copy);
}

// Checks if the supplied argument is a file or a string. If it is a file it
// is read and then saved to the benchmark
exports.saveBenchmarkFromArgument = function(callback){
  if(!process.argv[3]){ throw "Please supply a benchmark file "};
  var benchmarkString = fs.readFileSync(process.argv[3]);
  
  // throws an error if benchmark is invalid
  eval(benchmarkString);
  
  // save
  exports.save(benchmarkString, callback);
}




