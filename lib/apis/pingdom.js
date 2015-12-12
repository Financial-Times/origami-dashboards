const request = require('request-promise');
const moment = require('moment');

const endpoint = process.env.ENDPOINT_PINGDOM || "https://api.pingdom.com/api/2.0";

const apiReq = function(path) {
	return request({
		url: endpoint+path,
		headers: { 'app-key': process.env.PINGDOM_APIKEY, 'Account-Email': process.env.PINGDOM_ACCOUNT },
		auth: { user: process.env.PINGDOM_USERNAME, pass: process.env.PINGDOM_PASSWORD }
	})
	.then(response => JSON.parse(response));
}

module.exports = {
	getHistory(check, from) {
		return apiReq('/summary.average/' + check + '?from=' + from + '&includeuptime=true')
			.then(data => ({
				respTime: data.summary.responsetime.avgresponse,
				totalDowntime: data.summary.status.totaldown
			}))
		;
	},
	getCurrentStatus(check) {
		return apiReq('/checks/' + check)
			.then(data => ({
				up: (data.check.status === 'up'),
				lastDowntime: moment.unix(data.check.lasterrortime)
			}))
		;
	}
};
