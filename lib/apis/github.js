const request = require('request-promise');
const moment = require('moment');

const endpoint = process.env.ENDPOINT_GITHUB || "https://api.github.com";
const eventHistory = {};
const checkpoints = {};

let startTime = moment();

const apiReq = function(path, checkpoint) {
	if (!checkpoint) {
		checkpoint = checkpoints[path] = checkpoints[path] || {};
	}
	const reqData = {
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
		const respdata = response.body;
		if (Array.isArray(respdata) && respdata.length) {
			const currentID = checkpoint.id;

			// Update checkpoint to the latest ID returned
			if (response.headers.etag && (!currentID || respdata[0].id > currentID)) {
				checkpoint.id = respdata[0].id;
				checkpoint.etag = response.headers.etag;
			}

			// Results overlap with previously fetched event list - slice just the new ones
			if (currentID) {
				const idx = respdata.findIndex(item => (item.id === currentID));
				if (idx !== -1) {
					return respdata.slice(0, idx);
				}
			}

			// Fetch and marge in additional pages if needed
			if (response.headers.link) {
				const nextlinkmatch = response.headers.link.match(/github\.com([^\>]+)>; rel="next"/);
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
		let events = eventHistory[org+'/'+repo] = eventHistory[org+'/'+repo] || [];
		return apiReq('/repos/'+org+'/'+repo+'/events')
			.then(function(newEvents) {
				const contribs = new Set();
				let stats = {issuesOpenedCount:0, issuesClosedCount:0, pushCount:0, repoEventsCount:0};
				newEvents.forEach(function(ev) {
					const extra = {};

					// Don't count watches and forks, which aren't really 'contributing' to the project
					if (ev.type === 'WatchEvent' || ev.type == 'ForkEvent') return;

					// Increase granularity of issue events, so we can tell the difference between issues being opened and closed
					if (ev.type === 'IssuesEvent' && (ev.payload.action === 'opened' || ev.payload.action === 'reopened')) {
						extra.type = "IssueOpen";
					} else if (ev.type === 'IssuesEvent' && ev.payload.action === 'closed') {
						extra.type = "IssueClose";
					}
					events.push(Object.assign({
						type: ev.type,
						id: ev.id,
						date: ev.created_at,
						user: ev.actor.login
					}, extra));
				});
				events = events.filter(function(ev) {
					return moment(ev.date) > startTime;
				});
				stats = events.reduce(function(out, ev) {
					if (ev.type === 'IssueOpen') out.issuesOpenedCount++;
					if (ev.type === 'IssueClose') out.issuesClosedCount++;
					if (ev.type === 'PushEvent') out.pushCount++;
					contribs.add(ev.user);
					out.repoEventsCount++;
					return out;
				}, stats);
				stats.contributors = contribs;
				stats.contributorsCount = contribs.size;
				return stats;
			})
		;
	},
	setPeriod: function(seconds) {
		startTime = moment().subtract(seconds, 'seconds');
	}
};