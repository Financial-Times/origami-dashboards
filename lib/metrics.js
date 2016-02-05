var Graphite = require('graphite');

var graphiteHost = process.env.GRAPHITE_HOST || null;
var graphitePort = process.env.GRAPHITE_PORT || 2003;
var envName = process.env.NODE_ENV || "unknown";
var metricsNS = (process.env.GRAPHITE_NS || 'origami.dashboard') + '.'+envName;

var graphite = null;

if (graphiteHost) {
	graphite = Graphite.createClient('plaintext://'+graphiteHost+':'+graphitePort);
	console.log('Initialised graphite metrics reporting to '+graphiteHost+', prefixed with '+metricsNS);
} else {
	console.warn('Graphite reporting is disabled.  To enable, set GRAPHITE_HOST');
}

module.exports = {
	send: function(data) {
		if (!graphite) return;
		var wrappedData = {}
		wrappedData[metricsNS] = data;
		console.log(wrappedData);
		graphite.write(wrappedData, function(err) {
			if (err) {

				// Ignore timeouts
				if (err.code === 'ETIMEDOUT' || err.code === 'EPIPE') {
					failures.inc();
					return;
				}

				console.error(err, err.stack);
				console.warn('Disabling graphite reporting due to error');
				clearInterval(timer);
			}
		});
	}
};
