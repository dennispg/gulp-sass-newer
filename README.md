# `gulp-newer-sass`

A [Gulp](http://gulpjs.com/) plugin to only pass through newer sass source files and imports.

## Install

```
npm install gulp-newer-sass --save-dev
```

## Example

### Using `gulp-newer-sass` with custom Sass importers:

```javascript
var gulp = require("gulp");

gulp.task("build-sass", function() {
    var newer_sass = require("gulp-newer-sass");
    var sass = require("gulp-sass");
    var sourcemaps = require('gulp-sourcemaps');

    var sass_jspm = require('sass-jspm-importer');
    var sass_globbing = require('node-sass-globbing');
    var sass_importers = [sass_jspm.importer, sass_globbing];

    return gulp.src("./scss/*.scss")
            .pipe(sourcemaps.init({ loadMaps: true }))
            .pipe(newer_sass({ dest: 'styles', importer: sass_importers }))
            .pipe(sass({
                outputStyle: 'compressed',
                errLogToConsole:true,
                importer: sass_importers
            }))
            .on('error', function (error) {
                console.log(error.toString());
                this.emit('end');
            })
            .pipe(sourcemaps.write('./'))
            .pipe(gulp.dest("styles"));
});
```

## API

### `newer(options)`

 * **options.dest** - `string` Path to destination directory or file.
 * **options.extension** - `string` Source files will be matched to destination files with the provided extension (e.g. '.css'). Defaults to .css
 * **options.cwd** - `string` The base directory for imports. Defaults to process.cwd() (the current directory)
 * **options.importer** - `function` or `array` An extra file, file glob, or list of extra files and/or globs, to check for updated time stamp(s). If any of these files are newer than the destination files, then all source files will be passed into the stream.