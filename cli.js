#!/usr/bin/env node

var rw = require('rw');
var S = require('string');
var _ = require('underscore');
var transformer = require('./');
var argv = require('minimist')(process.argv.slice(2));

var log = console.log;

function usage() {
  var n = process.argv[1];
  log('Usage: ' + n + ' <in-type-id> <out-type-id> < <in-file> > <out-file>');
};

function print_src(id) {
  var m = transformer.load(argv.src);
  log(JSON.stringify(m.src, undefined, 1));
}

function convert(ids) {
  if (!(ids.length > 1)) {
    usage();
    process.exit(-1);
  }

  // wrap with string (because cli)
  ids.unshift('string');
  ids.push('string');

  var convs = transformer.Conversion.pathIds(ids);
  ensureModulesAreInstalled(ids.concat(convs));

  // for now use rw module with Sync. TODO: streams.
  var read = function() {
    return rw.readSync('/dev/stdin', 'utf8').trim();
  }

  var write = function(output) {
    rw.writeSync('/dev/stdout', '' + output + '\n', 'utf8');
  }

  // transformer chain
  if (argv["sync"]) {
    console.log("using sync");
    var in2out = transformer.sync.compose(ids);
    write(in2out(read()));

  } else {
    var in2out = transformer.async.compose(ids);
    in2out(read(), function(err, output) {
      if (err) throw err;
      write(output);
    });
  }

}

function handleRequiresModulesError(modules) {
  tmpl = _.template("Error: transformer needs the following npm modules to perform this conversion:\n\
<% _.each(modules, function(m) { %>\n\
  - <%= m %>\
<% }); %>\n\
\n\
To install them, run:\n\
\n\
  # in this directory\n\
  npm install <%= modules.join(' ') %>\n\
\n\
  # globally (you may need to sudo)\n\
  npm install -g <%= modules.join(' ') %>\n\
\n\
");

  log(tmpl({ modules: modules }));
  process.exit(-1);
}

function ensureModulesAreInstalled(ids) {
  missing = _.filter(ids, function(id) {
    try {
      // load. if no exception, it succeeded.
      transformer(id);
      return false;
    } catch (e) {
      if (transformer.load.errIsModuleNotFound(e))
        return true;
      throw e;
    }
  });

  if (missing)
    handleRequiresModulesError(missing);
}

function main() {

  // set options.
  transformer.load.autoInstall = argv.install;

  if (argv.src) { // is it print src?
    print_src(argv.src);
  }
  else { // seems to be a conversion
    convert(argv._);
  }
}


// run main.
try {
  main();
} catch (e) {
  if (transformer.load.errIsModuleNotFound(e)) {
    var s = e.toString();
    var s = s.substr(s.search("'")).replace(/'/g, '');
    handleRequiresModulesError([s]);
  } else {
    throw e;
  }
}
