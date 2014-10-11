/**
 * User: Constantine Melnikov
 * Email: ka.melnikov@gmail.com
 * Date: 12.12.13
 * Time: 0:31
 */
'use strict';
module.exports = function (grunt) {
  require('time-grunt')(grunt);

  grunt.initConfig({
    //pkg: grunt.file.readJSON('package.json'),
    watch: {
      files: ['lib/**/*.js'],
      tasks: ['browserify:dev']
    },

    browserify: {
      //browserify lib/ --standalone storage > storage.js -d
      dev: {
        options: {
          browserifyOptions: {
            debug: true,
            standalone: 'storage'
          }
        },
        src: 'lib/index.js',
        dest: 'storage.debug.js'
      },
      // browserify lib/ --standalone storage > storage.js
      dist: {
        options: {
          browserifyOptions: {
            standalone: 'storage'
          }
        },
        src: 'lib/index.js',
        dest: 'storage.js'
      }
    },

    uglify: {
      main: {
        files: {
          'storage.min.js': ['storage.js']
        }
      }
    },

    karma: {
      options: {
        configFile: 'karma.conf.js'
      },
      local: {},
      phantom: {
        browsers: [
          'PhantomJS'
        ],
        preprocessors: {
          // source files, that you wanna generate coverage for
          // do not include tests or libraries
          // (these files will be instrumented by Istanbul)
          './storage.js': ['coverage']
        },
        // coverage reporter generates the coverage
        reporters: [
          'dots',
          'coverage'
        ],
        // optionally, configure the reporter
        coverageReporter: {
          type: 'lcovonly',
          dir: 'test/coverage'
        }
      },
      coverage: {
        preprocessors: {
          './storage.js': ['coverage']
        },
        reporters: [
          'dots',
          'coverage'
        ],
        coverageReporter: {
          type: 'html',
          dir: 'test/coverage'
        }
      },
      sauce: {
        reporters: [
          'dots',
          'saucelabs'
        ],
        browsers: [
          'sauce_chrome',
          //'sauce_chrome_linux',
          //'sauce_firefox',
          //'sauce_firefox_linux',
          //'sauce_safari',
          //'sauce_ie_8',
          'sauce_ie_9',
          //'sauce_ie_10',
          //'sauce_ie_11'
        ]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.loadNpmTasks('grunt-karma');

  grunt.registerTask('default', [
    //'lint',
    //'complexity',
    'browserify',
    'uglify',
    'test'
  ]);
  grunt.registerTask('dev', [
    'browserify:dev',
    'watch'
  ]);
  grunt.registerTask('test', [
    'karma:local'
  ]);
  grunt.registerTask('build', [
    //'lint',
    //'complexity',
    'browserify',
    'uglify',
    //'karma:phantom',
    'karma:sauce'
  ]);
};