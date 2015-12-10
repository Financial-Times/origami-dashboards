var request = require('request-promise');

var endpoint = process.env.ENDPOINT_PINGDOM || "https://api.pingdom.com/api/2.0";

var apiReq = function(path) {
	console.log(path);
	return request({
		url: endpoint+path,
		headers: { 'app-key': process.env.PINGDOM_APIKEY, 'Account-Email': process.env.PINGDOM_ACCOUNT },
		auth: { user: process.env.PINGDOM_USERNAME, pass: process.env.PINGDOM_PASSWORD }
	})
	.then(function(response) {
		return JSON.parse(response);
	});
}

module.exports = {
	getHistory: function(check, from) {
		return apiReq('/summary.average/' + check + '?from=' + from + '&includeuptime=true')
			.then(function(data) {
				return {
					respTime: data.summary.responsetime.avgresponse,
					totalDowntime: data.summary.status.totaldown
				};
			})
		;
	},
	getCurrentStatus: function(check) {
		return apiReq('/checks/' + check)
			.then(function(data) {
				return {
					up: (data.check.status === 'up'),
					lastErrorTime: data.check.lasterrortime
				};
			})
		;
	}
};
