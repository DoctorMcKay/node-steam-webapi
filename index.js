var Https = require('https');
var QueryString = require('querystring');
var Zlib = require('zlib');

var EResult = require('./resources/EResult.json');

module.exports = SteamWebAPI;

function SteamWebAPI(key, localAddress) {
	if (key) {
		this.key = key;
	}

	if (localAddress) {
		this.localAddress = localAddress;
	}
}

SteamWebAPI.prototype.domain = "api.steampowered.com";
SteamWebAPI.prototype.localAddress = null;

SteamWebAPI.prototype.get = function(iface, method, version, input, callback) {
	this._req("GET", iface, method, version, input, callback);
};

SteamWebAPI.prototype.post = function(iface, method, version, input, callback) {
	this._req("POST", iface, method, version, input, callback);
};

SteamWebAPI.prototype._req = function(httpMethod, iface, method, version, input, callback) {
	// Preprocess arrays
	if (typeof input === 'function') {
		callback = input;
		input = null;
	}

	input = input || {};

	for (var i in input) {
		if (input.hasOwnProperty(i) && input[i] instanceof Array) {
			input[i].forEach(function(value, index) {
				input[i + '[' + index + ']'] = value;
			});

			delete input[i];
		}
	}

	if (this.key) {
		input.key = this.key;
	}

	input.format = "json";
	input = QueryString.stringify(input);

	if (!iface.match(/^I[A-Z]/)) {
		iface = "I" + iface;
	}

	var path = "/" + iface + "/" + method + "/v" + version + "/";

	if (httpMethod == "GET") {
		path += "?" + input;
	}

	var req = Https.request({
		"host": this.domain,
		"localAddress": this.localAddress,
		"method": httpMethod,
		"path": path,
		"headers": {
			"Accept-Encoding": "gzip",
			"User-Agent": "https://www.npmjs.com/package/@doctormckay/steam-webapi v" + require('./package.json').version
		}
	}, function(res) {
		var err = new Error();
		err.statusCode = res.statusCode;

		if (res.headers['x-eresult']) {
			err.eresult = parseInt(res.headers['x-eresult'], 10);

			if (res.headers['x-eresult'] != 1) {
				err.message = res.headers['x-error_message'] || EResult[res.headers['x-eresult']];
			}
		}

		if (res.statusCode != 200 && !err.message) {
			err.message = res.statusMessage || "HTTP error " + res.statusCode;
		}

		if (err.message) {
			callback(err);
			return;
		}

		var response = '';
		var stream = res;

		// Looks like it worked so far
		if (res.headers['content-encoding'] && res.headers['content-encoding'].toLowerCase() == 'gzip') {
			stream = Zlib.createGunzip();
			res.pipe(stream);
		}

		stream.on('data', function(chunk) {
			response += chunk;
		});

		stream.on('end', function() {
			try {
				response = JSON.parse(response);
			} catch (e) {
				err.message = "Malformed response";
				callback(err);
				return;
			}

			if (Object.keys(response).length == 1 && response.response) {
				response = response.response;
			}

			callback(null, response);
		});
	});

	req.end(httpMethod == "POST" ? input : null);
};
