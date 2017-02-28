'use strict';
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var util = require('gulp-util');
var through = require('through2');
var Promise = require('bluebird');
var chalk = require('chalk');

module.exports = function(opts) {
	opts = opts || {};

	if(!opts.dest) {
		throw new util.PluginError('gulp-newer-sass', '`dest` required');
	}
	opts.extension = opts.extension || ".css";
	opts.cwd = opts.cwd || process.cwd();
	opts.importer = opts.importer || [];
	opts.cache = {};

	return through.obj(function (file, enc, cb) {
		var destination = typeof opts.dest === 'function' ? opts.dest(file) : opts.dest;
		var newPath = path.resolve(opts.cwd, destination, file.relative);
		if (opts.extension) {
			newPath = util.replaceExtension(newPath, opts.extension);
		}
		var self = this;
	    try { var targetStat = fs.statSync(newPath); }
	    catch (err) {
	        if (err.code !== 'ENOENT')
	            self.emit('error', new util.PluginError('gulp-newer-sass', err, { fileName: file.path }));
	        self.push(file);
	        cb();
	        return;
	    }

		try {
			isNewer({ file: file.path, stat: file.stat }, { file: newPath, stat: targetStat }, opts.cwd, opts, newPath)
			.then(function (r) {
			    self.push(file);
			})
            .catch(Promise.AggregateError, function (err) {

            })
			.error(function(err) {
				console.log(err);
				self.push(file);
			})
			.finally(function() { 
				cb();
			});
		}
		catch (e) {
			console.log(e);
			self.emit('error', new util.PluginError('gulp-newer-sass', e, { fileName: file.path }));
		}

	});
};

var checkNewer = function (source, target, cwd, opts, outfile) {
    if (source.stat && (source.stat.mtime > target.stat.mtime)) {
        var success_message = chalk.gray('           changes detected');
        try { success_message += ' in ' + chalk.magenta(source.file.replace(process.cwd(), '')); }
        catch (e) { }
        console.log(success_message);
        return Promise.resolve(success_message);
    }
    var contents = source.contents || fs.readFileSync(source.file);
	var imports = parseImports(contents);
	if (!imports || imports.length == 0)
		return Promise.resolve('no changes detected in ' + source.file);

	return Promise.any(imports.map(function(i) {
	    var import_path = source.file || cwd;
		return bridgedSassImport(i, import_path, opts.importer)
		.then(function(result) {
			if(!result) {
			    console.error('Could not load file: ' + result.file);
			    return Promise.reject('Could not load file: ' + i);
            }
			var source = result;
			if(result && result.file) {
			    var file_path = resolveSassPath(result.file, import_path);
				if (!file_path) {
					console.error('Could not load file: ' + result.file);
					return Promise.reject('Could not load file: ' +result.file);
				}
				source = { file: file_path, stat: fs.statSync(file_path) };
			}
			return isNewer(source, target, path.dirname(source.file), opts, outfile);
		})

	}));
};

var resolveSassPath = function (sassPath, import_path) {
    var cwd = import_path;
    if (fs.existsSync(import_path) && fs.statSync(import_path).isFile())
        cwd = path.dirname(import_path);

    var pathIsAbsolute = require('path-is-absolute');
    var current_path = (cwd == "stdin") ? process.cwd() : cwd;
	var scssPath = (pathIsAbsolute(sassPath) ? sassPath : path.join(current_path, sassPath));
    
	if (fs.existsSync(scssPath + '.scss'))
	    return scssPath + '.scss';

	var scssPartialPath = path.join(path.dirname(scssPath), '_' + path.basename(scssPath) + '.scss');
	if (fs.existsSync(scssPartialPath))
	    return scssPartialPath;

    if (fs.existsSync(scssPath) && !fs.statSync(scssPath).isDirectory())
        return scssPath;

	return null;
};

var isNewer = function (source, target, cwd, opts, outfile) {
	if(source.contents)
	    return checkNewer(source, target, cwd, opts, outfile);

	if (source.file && !opts.cache[source.file]) {
	    opts.cache[source.file] = checkNewer(source, target, cwd, opts, outfile);
	}
	return opts.cache[source.file];
};

var bridgedSassImport = function (url, cwd, importers) {
    if (!importers || importers.length === 0) {
        return Promise.resolve({ file: url });
    }

	return new Promise(function(resolve) {
	    importers[0](url, cwd, function (result) {
	        if (result && (result.file || result.contents))
	            resolve(result);

	        var remaining_importers = importers.slice(1, importers.length);
			
			resolve(bridgedSassImport(url, cwd, remaining_importers));
		});
	});
};

var bridgedSassImporter = function (importers) {
    return function (url, prev, done) {
	    bridgedSassImport(url, prev, importers)
		.then(function(result) {
			done(result);
		});
	};
};

var parseImports = function (source) {
  var importRe = /@import\s*(?:'([^']+)'|"([^"]+)")\s*;?/g;
  var imports = {};
  var results = [];
  while((imports = importRe.exec(source)) !== null) {
      results.push(imports[1] || imports[2]);
  }
  return results;
};