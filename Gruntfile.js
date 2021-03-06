'use strict';

module.exports = function (grunt) {
  var webpack = require('webpack');
  require('time-grunt')(grunt);

  var webpack_karma = {
    output: {
      library: 'storage',
      libraryTarget: 'umd',
      pathinfo: true
    },
    devtool: 'eval',
    module: {
      postLoaders: [{
        test: /\.js$/,
        exclude: /(node_modules)\//,
        loader: 'istanbul-instrumenter'
      }]
    },
    plugins: [
      new webpack.optimize.UglifyJsPlugin({
        mangle: false
      }),
      new webpack.DefinePlugin({
        NODE_ENV: JSON.stringify('production')
      })
    ]
  };

  grunt.initConfig({
    webpack: {
      options: {
        entry: './lib/index.js',
        plugins: [
          new webpack.optimize.UglifyJsPlugin({
            mangle: false
          }),
          new webpack.DefinePlugin({
            NODE_ENV: JSON.stringify('production')
          })
        ]
      },

      min: {
        output: {
          filename: './dist/storage.min.js',
          library: 'storage',
          libraryTarget: 'umd'
        }
      },

      dev: {
        output: {
          filename: './dist/storage.min.debug.js',
          library: 'storage',
          libraryTarget: 'umd',
          pathinfo: true
        },
        devtool: 'eval',
        stats: {
          // Configure the console output
          colors: true,
          modules: true,
          reasons: true
        }
      },

      watch: {
        output: {
          filename: './dist/storage.min.debug.js',
          library: 'storage',
          libraryTarget: 'umd',
          pathinfo: true
        },
        devtool: 'eval',
        stats: {
          // Configure the console output
          colors: true,
          modules: true,
          reasons: true
        },

        watch: true,  // Use this in combination with the watch option
        // You need to keep the grunt process alive

        keepalive: true // don't finish the grunt task
        // Use this in combination with the watch option
      }
    },

    jshint: {
      options: {
        jshintrc: '.jshintrc'
      },
      lib: {
        src: [
          'lib/**/*.js'
          //'storage.debug.js'
        ]
      },
      tests: {
        src: [
          'test/*.js',
          'Gruntfile.js',
          'karma.conf.js'
        ]
      }
    },

    karma: {
      options: {
        configFile: 'karma.conf.js'
      },

      local: {
        // list of files / patterns to load in the browser
        files: [
          { src: 'node_modules/lodash/dist/lodash.js'},
          { src: 'dist/storage.min.debug.js'},
          { src: 'test/*.js'}
        ],
        browsers: [
          'Chrome'
          //'Firefox'
        ],
        // coverage reporter generates the coverage
        reporters: [
          'dots'
        ],
        // optionally, configure the reporter
        coverageReporter: {
          type: 'html',
          dir: 'test/coverage'
        }
      },

      cov: {
        browsers: [
          'Chrome'
        ],
        preprocessors: {
          'lib/index.js': ['webpack', 'sourcemap']
        },
        webpack: webpack_karma,
        // coverage reporter generates the coverage
        reporters: [
          'dots',
          'coverage'
        ],
        // optionally, configure the reporter
        coverageReporter: {
          type: 'html',
          dir: 'test/coverage'
        }
      },

      phantom: {
        browserNoActivityTimeout : 60000, //default 10000
        browsers: [
          'PhantomJS'
        ],
        preprocessors: {
          'lib/index.js': ['webpack']
        },
        webpack: webpack_karma,
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

      sauce: {
        // list of files / patterns to load in the browser
        files: [
          { src: 'node_modules/lodash/dist/lodash.js'},
          { src: 'dist/storage.min.debug.js'},
          { src: 'test/*.js'}
        ],
        reporters: [
          'dots',
          'saucelabs'
        ],
        browsers: [
          'sauce_chrome',
          //'sauce_chrome_linux',
          'sauce_firefox',
          //'sauce_firefox_linux',
          'sauce_safari',
          //'sauce_ie_8',
          'sauce_ie_9',
          'sauce_ie_10',
          'sauce_ie_11'
        ]
      }
    },

    coveralls: {
      options: {
        coverageDir: 'test/coverage',
        recursive: true
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-karma-coveralls');
  grunt.loadNpmTasks("grunt-webpack");

  grunt.registerTask('default', ['build', 'test']);
  grunt.registerTask('lint', ['jshint']);

  grunt.registerTask('build', [
    //'lint',
    //'complexity',
    'webpack:min',
    'webpack:dev'
  ]);

  grunt.registerTask('watch', ['webpack:watch']);
  grunt.registerTask('test', ['webpack:dev', 'karma:local']);
  grunt.registerTask('cov', ['karma:cov']);
  grunt.registerTask('travis', [
    'build',
    'karma:phantom',
    'karma:sauce'
  ]);
};