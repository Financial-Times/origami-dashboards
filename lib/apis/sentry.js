const request = require('request-promise');

const endpoint = process.env.ENDPOINT_SENTRY || "https://app.getsentry.com/api/0";

const apiReq = function(path) {
	return request({
		url: endpoint+path,
		auth: { user: process.env.SENTRY_APIKEY, pass: '' }
	})
	.then(function(response) {
		return JSON.parse(response);
	});
}

module.exports = {
	getUnresolvedErrorCount: function(org, project) {

		// include=stats is an undocumented API extension added by Sentry at our request!  Documented in email from David Cramer to Andrew Betts on 16 November 2015
		return apiReq('/projects/'+org+'/' + project + '/?include=stats')
			.then(function(data) {
				return data.stats.unresolved;
			})
		;
	}
};
