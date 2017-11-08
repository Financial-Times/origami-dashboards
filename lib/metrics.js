'use strict';

const Graphite = require('graphite');

const graphiteHost = process.env.GRAPHITE_HOST || null;
const graphitePort = process.env.GRAPHITE_PORT || 2003;
const envName = process.env.NODE_ENV || "unknown";
const metricsNS = (process.env.GRAPHITE_NS || 'origami.dashboard') + '.'+envName;

let graphite = null;

if (graphiteHost) {
	graphite = Graphite.createClient('plaintext://'+graphiteHost+':'+graphitePort);
	console.log('Initialised graphite metrics reporting to '+graphiteHost+', prefixed with '+metricsNS);
} else {
	console.warn('Graphite reporting is disabled.  To enable, set GRAPHITE_HOST');
}

module.exports = {
	send: function(data) {
		if (!graphite) return;
		const wrappedData = {}
		wrappedData[metricsNS] = data;

		graphite.write(wrappedData, function(err) {
			if (err) {

				// Ignore timeouts
				if (err.code === 'ETIMEDOUT' || err.code === 'EPIPE') {
					return;
				}

				console.error(err, err.stack);
			}
		});
	}
};
