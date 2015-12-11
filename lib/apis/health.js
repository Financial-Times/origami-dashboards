const request = require('request-promise');

module.exports = {
	getOverallSeverity: function(healthUrl) {
		return request(healthUrl)
			.then(function(response) { return JSON.parse(response); })
			.then(function(data) {
				if (data.checks) {

					// Least severe severity is 3, most severe is 1
					let overallSev = data.checks.reduce(function(out, check) {
						return check.ok ? out : Math.min(out, check.severity);
					}, 4);
					if (overallSev === 4) overallSev = -1;
					return overallSev;
				} else {
					return 'blank';
				}
			})
		;
	}
};
