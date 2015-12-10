var request = require('request-promise');
var moment = require('moment');

var endpoint = process.env.ENDPOINT_GITHUB || "https://api.github.com";
var eventHistory = {};
var checkpoints = {};
var startTime = moment();

var apiReq = function(path, checkpoint) {
	if (!checkpoint) {
		checkpoint = checkpoints[path] = checkpoints[path] || {};
	}
	var reqData = {
		url: endpoint+path,
		auth: { user: process.env.GITHUB_USERNAME, pass: process.env.GITHUB_APIKEY },
		headers: { 'User-Agent': "Financial Times (origami-support@ft.com)"},
		resolveWithFullResponse: true,
		json: true
	};
	if (checkpoint.id) {
		reqData.headers['ETag'] = checkpoint.etag;
	}
	return request(reqData)
	.then(function(response) {
		var respdata = response.body;
		if (Array.isArray(respdata)) {
			if (response.headers.etag && respdata[0].id > checkpoint.id) {
				checkpoint.id = respdata[0].id;
				checkpoint.etag = response.headers.etag;
			}
			if (checkpoint.id) {
				var idx = respdata.find(function(item) { item.id === checkpoint.id; });
				if (idx !== -1) {
					return respdata.slice(0, idx+1);
				}
			}
			if (response.headers.link) {
				var nextlinkmatch = response.headers.link.match(/github\.com([^\>]+)>; rel="next"/);
				if (nextlinkmatch) {
					return apiReq(nextlinkmatch[1], checkpoint).then(function(nextpageresults) {
						return respdata.concat(nextpageresults);
					});
				}
			}
		}
		return respdata;
	});
}

module.exports = {
	getEventStats: function(org, repo) {
		console.log('Github event stats for ', org, repo);
		var events = eventHistory[org+'/'+repo] = eventHistory[org+'/'+repo] || [];
		return apiReq('/repos/'+org+'/'+repo+'/events')
			.then(function(newEvents) {
				var stats = {issuesOpenedCount:0, issuesClosedCount:0};
				console.log('Event list complete', org, repo, newEvents.length);
				newEvents.forEach(function(ev) {
					var extra = {};
					if (ev.type == 'IssuesEvent' && (ev.payload.action == 'opened' || ev.payload.action == 'reopened')) {
						extra.type = "IssueOpen";
					} else if (ev.type == 'IssuesEvent' && ev.payload.action == 'closed') {
						extra.type = "IssueClose";
					}
					events.push(Object.assign({
						type: ev.type,
						id: ev.id,
						date: ev.created_at
					}, extra));
				});
				events = events.filter(function(ev) {
					return moment(ev.date) > startTime;
				})
				stats = events.reduce(function(out, ev) {
					if (ev.type === 'IssueOpen') out.issuesOpenedCount++;
					if (ev.type === 'IssueClose') out.issuesClosedCount++;
					return out;
				}, stats);
				console.log("Stats", repo, stats);
				return stats;
			})
			.catch(function(err) { console.log(err.stack || err); })
		;
	},
	setPeriod: function(seconds) {
		startTime = moment().subtract(seconds, 'seconds');
	}
};
