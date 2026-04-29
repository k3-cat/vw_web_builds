const fs = require("fs");
const path = require("path");

const { AngularWebpackPlugin } = require("@ngtools/webpack");
const { WebpackManifestPlugin } = require("webpack-manifest-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackInjector = require("html-webpack-injector");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CspHtmlWebpackPlugin = require("csp-html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const FaroSourceMapUploaderPlugin = require("@grafana/faro-webpack-plugin");
const webpack = require("webpack");

const config = require(path.resolve(__dirname, "config.js"));
const pjson = require(path.resolve(__dirname, "package.json"));

module.exports.getEnv = function getEnv(params) {
  const ENV = params.env?.ENV ?? process.env?.ENV ?? "development";
  const NODE_ENV = params.env?.NODE_ENV ?? process.env?.NODE_ENV ?? "development";
  const LOGGING =
    params.env?.LOGGING ??
    (process.env?.LOGGING === undefined ? true : process.env.LOGGING !== "false");

  return { ENV, NODE_ENV, LOGGING };
};

const DEFAULT_PARAMS = {
  outputPath: path.resolve(__dirname, "build"),
};

/**
 *
 * @param {{
 *  configName: string;
 *  app: {
 *      entry: string;
 *      entryModule: string;
 *  };
 *  tsConfig: string;
 *  outputPath?: string;
 *  mode?: string;
 *  env?: {
 *      ENV?: string;
 *      NODE_ENV?: string;
 *      LOGGING?: boolean;
 *    };
 *  importAliases?: import("webpack").ResolveOptions["alias"];
 * }} params
 */
module.exports.buildConfig = function buildConfig(params) {
  params = { ...DEFAULT_PARAMS, ...params };
  const { ENV, NODE_ENV, LOGGING } = module.exports.getEnv(params);

  const envConfig = config.load(ENV);
  if (LOGGING) {
    config.log(`Building web - ${params.configName} version`);
    config.log(envConfig);
  }

  const moduleRules = [
    {
      test: /\.(html)$/,
      loader: "html-loader",
      options: {
        sources: {
          list: [
            "...",
            { tag: "video", attribute: "src", type: "src" },
            { tag: "video", attribute: "appDarkImgSrc", type: "src" },
          ],
        },
      },
    },
    {
      test: /.(ttf|otf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
      exclude: /loading(|-white).svg/,
      generator: { filename: "fonts/[name]-[contenthash][ext]" },
      type: "asset/resource",
    },
    {
      test: /\.(jpe?g|png|gif|svg|webp|avif)$/i,
      exclude: /.*(bwi-font)\.svg/,
      generator: { filename: "images/[name]-[contenthash][ext]" },
      type: "asset/resource",
    },
    {
      test: /\.(mp4)$/,
      generator: { filename: "videos/[name]-[contenthash][ext]" },
      type: "asset/resource",
    },
    {
      test: /\.(json)$/,
      exclude: /.*(messages|package)\.json/,
      generator: { filename: "[name]-[contenthash][ext]" },
      type: "asset/resource",
    },
    {
      test: /\.scss$/,
      use: [
        { loader: MiniCssExtractPlugin.loader },
        "css-loader",
        "resolve-url-loader",
        {
          loader: "sass-loader",
          options: { sourceMap: true },
        },
      ],
    },
    {
      test: /\.css$/,
      use: [
        { loader: MiniCssExtractPlugin.loader },
        "css-loader",
        "resolve-url-loader",
        {
          loader: "postcss-loader",
          options: {
            sourceMap: true,
            postcssOptions: { config: path.resolve(__dirname, "postcss.config.js") },
          },
        },
      ],
    },
    {
      test: /\.[cm]?js$/,
      exclude: /\.wasm\.js$/,
      use: [
        {
          loader: "babel-loader",
          options: {
            configFile: path.resolve(__dirname, "../../babel.config.json"),
            cacheDirectory: NODE_ENV !== "production",
          },
        },
      ],
    },
    {
      test: /\.[jt]sx?$/,
      loader: "@ngtools/webpack",
    },
  ];

  const plugins = [
    new WebpackManifestPlugin({
      fileName: "../res/manifest.json",
      filter: (file) => {
        return (
          !file.isChunk &&
          !file.isInitial &&
          file.isAsset &&
          !file.path.startsWith("..") &&
          !file.name.includes("messages.json") &&
          !file.name.endsWith(".html") &&
          !file.name.endsWith(".map")
        );
      },
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/index.html"),
      filename: "../index.html",
      chunks: ["theme_head", "app/polyfills", "app/vendor", "app/main", "styles"],
      publicPath: "/assets",
    }),
    new HtmlWebpackInjector(),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/connectors/webauthn.html"),
      filename: "../webauthn-connector.html",
      chunks: ["connectors/webauthn", "styles"],
      publicPath: "/assets",
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/connectors/webauthn-mobile.html"),
      filename: "../webauthn-mobile-connector.html",
      chunks: ["connectors/webauthn", "styles"],
      publicPath: "/assets",
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/connectors/webauthn-fallback.html"),
      filename: "../webauthn-fallback-connector.html",
      chunks: ["connectors/webauthn-fallback", "styles"],
      publicPath: "/assets",
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/connectors/sso.html"),
      filename: "../sso-connector.html",
      chunks: ["connectors/sso", "styles"],
      publicPath: "/assets",
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/connectors/redirect.html"),
      filename: "../redirect-connector.html",
      chunks: ["connectors/redirect", "styles"],
      publicPath: "/assets",
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/connectors/duo-redirect.html"),
      filename: "../duo-redirect-connector.html",
      chunks: ["connectors/duo-redirect", "styles"],
      publicPath: "/assets",
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/connectors/platform/proxy-cookie-redirect.html"),
      filename: "../proxy-cookie-redirect-connector.html",
      chunks: ["connectors/platform/proxy-cookie-redirect", "styles"],
      publicPath: "/assets",
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/404.html"),
      filename: "../404.html",
      chunks: ["styles"],
      publicPath: "/assets",
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "public/.nojekyll"),
          to: path.resolve(params.outputPath),
        },
        {
          from: path.resolve(__dirname, "public/favicon.ico"),
          to: path.resolve(params.outputPath),
        },
        {
          from: path.resolve(__dirname, "public/app-id.json"),
          to: path.resolve(params.outputPath),
        },
        {
          from: path.resolve(__dirname, "public/browserconfig.xml"),
          to: path.resolve(params.outputPath),
        },
        {
          from: path.resolve(__dirname, "public/locales/"),
          to: path.resolve(params.outputPath, "res/locales/"),
        },
        {
          from: path.resolve(__dirname, "public/icons"),
          to: path.resolve(params.outputPath, "res/"),
          filter: (path) => {
            const filename = path.split("/").pop();
            return filename.startsWith("android-chrome-") || filename.startsWith("mstile-");
          },
        },
        {
          from: path.resolve(__dirname, "../../node_modules/qrious/dist/qrious.min.js"),
          to: path.resolve(params.outputPath, "assets/scripts/[name]-[contenthash][ext]"),
        },
        {
          from: path.resolve(
            __dirname,
            "../../node_modules/braintree-web-drop-in/dist/browser/dropin.js",
          ),
          to: path.resolve(params.outputPath, "assets/scripts/[name]-[contenthash][ext]"),
        },
        {
          from: path.resolve(__dirname, "src/version.json"),
          to: path.resolve(params.outputPath, "version.json"),
          transform: (content, _path) =>
            content.toString().replace("process.env.APPLICATION_VERSION", pjson.version),
        },
      ],
    }),
    new MiniCssExtractPlugin({
      filename: "[name]-[contenthash].css",
      chunkFilename: "[id]-[contenthash].css",
    }),
    new webpack.ProvidePlugin({
      process: "process/browser.js",
    }),
    new webpack.EnvironmentPlugin({
      ENV: ENV,
      NODE_ENV: NODE_ENV === "production" ? "production" : "development",
      APPLICATION_VERSION: pjson.version,
      CACHE_TAG: Math.random().toString(36).substring(7),
      URLS: envConfig["urls"] ?? {},
      STRIPE_KEY: envConfig["stripeKey"] ?? "",
      BRAINTREE_KEY: envConfig["braintreeKey"] ?? "",
      PAYPAL_CONFIG: envConfig["paypal"] ?? {},
      FLAGS: envConfig["flags"] ?? {},
      DEV_FLAGS: NODE_ENV === "development" ? envConfig["devFlags"] : {},
      ADDITIONAL_REGIONS: envConfig["additionalRegions"] ?? [],
    }),
    new AngularWebpackPlugin({
      tsconfig: params.tsConfig,
      entryModule: params.app.entryModule,
      sourceMap: true,
    }),
    new CspHtmlWebpackPlugin(
      {
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "object-src": ["'self'", "blob:"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": [
          "'self'",
          "data:",
          "c.clarity.ms",
          "c.bing.com",
          "https://haveibeenpwned.com",
          "https://icons.duckduckgo.com/ip3/",
        ],
        "frame-src": [
          "'self'",
          "*.clarity.ms",
          "challenges.cloudflare.com",
          "https://*.duosecurity.com",
          "https://*.duofederal.com",
        ],
        "script-src-elem": [
          "'self'",
          "'wasm-unsafe-eval'",
          "*.clarity.ms",
          "challenges.cloudflare.com",
          "static.cloudflareinsights.com",
        ],
        "connect-src": [
          "'self'",
          "*.grafana.net",
          "*.clarity.ms",
          "cloudflareinsights.com",
          "https://api.pwnedpasswords.com",
          "https://api.2fa.directory",
        ],
      },
      {
        hashingMethod: "sha256",
        hashEnabled: { "script-src": true, "style-src": false },
        nonceEnabled: { "script-src": false, "style-src": false },
      },
    ),
    new FaroSourceMapUploaderPlugin({
      appName: "web-vault",
      endpoint: process.env.FARO_ENDPOINT,
      appId: process.env.FARO_APP_ID,
      stackId: process.env.FARO_STACK_ID,
      apiKey: process.env.FARO_API_KEY,
      recursive: true,
      verbose: true,
      gzipContents: true,
    }),
    new webpack.DefinePlugin({
      "process.env.VITE_FARO_DSN": JSON.stringify(process.env.VITE_FARO_DSN),
      "process.env.VITE_CLARITY_ID": JSON.stringify(process.env.VITE_CLARITY_ID),
      "__webpack_require__.p": JSON.stringify("/assets"),
    }),
  ];

  // ref: https://webpack.js.org/configuration/dev-server/#devserver
  let certSuffix = fs.existsSync(path.resolve(__dirname, "dev-server.local.pem"))
    ? ".local"
    : ".shared";
  const devServer =
    NODE_ENV !== "development"
      ? {}
      : {
          server: {
            type: "https",
            options: {
              key: fs.readFileSync(path.resolve(__dirname, "dev-server" + certSuffix + ".pem")),
              cert: fs.readFileSync(path.resolve(__dirname, "dev-server" + certSuffix + ".pem")),
            },
          },
          // host: '192.168.1.9',
          proxy: [
            {
              context: ["/api"],
              target: envConfig.dev?.proxyApi,
              pathRewrite: { "^/api": "" },
              secure: false,
              changeOrigin: true,
            },
            {
              context: ["/identity"],
              target: envConfig.dev?.proxyIdentity,
              pathRewrite: { "^/identity": "" },
              secure: false,
              changeOrigin: true,
            },
            {
              context: ["/events"],
              target: envConfig.dev?.proxyEvents,
              pathRewrite: { "^/events": "" },
              secure: false,
              changeOrigin: true,
            },
            {
              context: ["/notifications"],
              target: envConfig.dev?.proxyNotifications,
              pathRewrite: { "^/notifications": "" },
              secure: false,
              changeOrigin: true,
              ws: true,
            },
            {
              context: ["/icons"],
              target: envConfig.dev?.proxyIcons,
              pathRewrite: { "^/icons": "" },
              secure: false,
              changeOrigin: true,
            },
            {
              context: ["/key-connector"],
              target: envConfig.dev?.proxyKeyConnector,
              pathRewrite: { "^/key-connector": "" },
              secure: false,
              changeOrigin: true,
            },
          ],
          headers: (req) => {
            if (!req.originalUrl.includes("connector.html")) {
              return {
                "Content-Security-Policy": `
                    default-src 'self'
                    ;script-src
                    'self'
                    'wasm-unsafe-eval'
                    'sha256-ryoU+5+IUZTuUyTElqkrQGBJXr1brEv6r2CA62WUw8w='
                    https://js.stripe.com
                    https://js.braintreegateway.com
                    https://www.paypalobjects.com
                    ;style-src
                    'self'
                    https://assets.braintreegateway.com
                    https://*.paypal.com
                    ${"'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='" /* date input polyfill */}
                    ${"'sha256-JVRXyYPueLWdwGwY9m/7u4QlZ1xeQdqUj2t8OVIzZE4='" /* date input polyfill */}
                    ${"'sha256-EnIJNDxVnh0++RytXJOkU0sqtLDFt1nYUDOfeJ5SKxg='" /* ng-select */}
                    ${"'sha256-dbBsIsz2pJ5loaLjhE6xWlmhYdjl6ghbwnGSCr4YObs='" /* cdk-virtual-scroll */}
                    ${"'sha256-S+uMh1G1SNQDAMG3seBmknQ26Wh+KSEoKdsNiy0joEE='" /* cdk-visually-hidden */}
                    ;img-src
                    'self'
                    data:
                    https://icons.bitwarden.net
                    https://*.paypal.com
                    https://www.paypalobjects.com
                    https://q.stripe.com
                    https://logos.haveibeenpwned.com
                    ;media-src
                    'self'
                    https://assets.bitwarden.com
                    ;child-src
                    'self'
                    https://js.stripe.com
                    https://assets.braintreegateway.com
                    https://*.paypal.com
                    https://*.duosecurity.com
                    ;frame-src
                    'self'
                    https://js.stripe.com
                    https://assets.braintreegateway.com
                    https://*.paypal.com
                    https://*.duosecurity.com
                    ;connect-src
                    'self'
                    ${envConfig.dev.wsConnectSrc ?? ""}
                    wss://notifications.bitwarden.com
                    https://notifications.bitwarden.com
                    https://cdn.bitwarden.net
                    https://api.pwnedpasswords.com
                    https://api.2fa.directory/v3/totp.json
                    https://api.stripe.com
                    https://www.paypal.com
                    https://api.sandbox.braintreegateway.com
                    https://api.braintreegateway.com
                    https://client-analytics.braintreegateway.com
                    https://*.braintree-api.com
                    https://*.blob.core.windows.net
                    http://127.0.0.1:10000
                    https://app.simplelogin.io/api/alias/random/new
                    https://quack.duckduckgo.com/api/email/addresses
                    https://app.addy.io/api/v1/aliases
                    https://api.fastmail.com
                    https://api.forwardemail.net
                    http://localhost:5000
                    ;object-src
                    'self'
                    blob:
                    ;`
                  .replace(/\n/g, " ")
                  .replace(/ +(?= )/g, ""),
              };
            }
          },
          hot: false,
          port: envConfig.dev?.port ?? 8080,
          allowedHosts: envConfig.dev?.allowedHosts ?? "auto",
          static: {
            directory: path.resolve(params.outputPath),
            publicPath: "/assets",
          },
          devMiddleware: {
            // when running `serve` locally this option writes all built files to `dist`
            // files are still served from memory, this is just a helpful debug tool
            writeToDisk: true,
          },
          client: {
            overlay: {
              errors: true,
              warnings: false,
              runtimeErrors: false,
            },
          },
        };

  const webpackConfig = {
    mode: NODE_ENV,
    devtool: "source-map",
    devServer: devServer,
    target: "web",
    bail: true,
    context: path.resolve(__dirname),
    entry: {
      "app/polyfills": "./src/polyfills.ts",
      "app/main": params.app.entry,
      "connectors/webauthn": "./src/connectors/webauthn.ts",
      "connectors/webauthn-fallback": "./src/connectors/webauthn-fallback.ts",
      "connectors/sso": "./src/connectors/sso.ts",
      "connectors/duo-redirect": "./src/connectors/duo-redirect.ts",
      "connectors/redirect": "./src/connectors/redirect.ts",
      "connectors/platform/proxy-cookie-redirect":
        "./src/connectors/platform/proxy-cookie-redirect.ts",
      styles: ["./src/scss/styles.scss", "./src/scss/tailwind.css"],
      theme_head: "./src/theme.ts",
    },
    cache:
      NODE_ENV === "production"
        ? false
        : {
            type: "filesystem",
            allowCollectingMemory: true,
            cacheDirectory: "../../node_modules/.cache/webpack",
            buildDependencies: { config: [__filename] },
          },
    snapshot: {
      unmanagedPaths: [path.resolve(__dirname, "../../node_modules/@bitwarden/")],
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          commons: {
            test: /[\\/]node_modules[\\/]/,
            name: "app/vendor",
            chunks: (chunk) => chunk.name === "app/main",
          },
        },
      },
      minimize: NODE_ENV === "production",
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            safari10: true,
            // Replicate Angular CLI behaviour
            compress: {
              global_defs: { ngDevMode: false, ngI18nClosureMode: false },
            },
          },
        }),
      ],
    },
    resolve: {
      extensions: [".ts", ".js"],
      symlinks: false,
      modules: ["../../node_modules", path.resolve(process.cwd(), "node_modules")],
      fallback: {
        buffer: false,
        util: require.resolve("util"),
        assert: false,
        url: false,
        fs: false,
        process: false,
        path: require.resolve("path-browserify"),
      },
      alias: params.importAliases,
    },
    output: {
      filename: "scripts/[name]-[contenthash].js",
      path: path.resolve(params.outputPath, "assets"),
      clean: true,
    },
    module: {
      rules: moduleRules,
    },
    experiments: {
      asyncWebAssembly: true,
    },
    plugins: plugins,
  };

  return webpackConfig;
};
