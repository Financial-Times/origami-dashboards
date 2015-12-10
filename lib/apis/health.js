var request = require('request-promise');

module.exports = {
	getOverallSeverity: function(healthUrl) {
		console.log(healthUrl);

		return request(healthUrl)
		.then(function(response) { return JSON.parse(response); })
		.then(function(data) {
			if (data.checks) {

				// Least severe severity is 3, most severe is 1
				var overallSev = data.checks.reduce(function(out, check) {
					return check.ok ? out : Math.min(out, check.severity);
				}, 4);
				if (overallSev === 4) overallSev = -1;
				return overallSev;
			} else {
				return 'blank';
			}
		})
	}
};
