var request = require('request-promise');

var endpoint = process.env.ENDPOINT_REGISTRY || "http://registry.origami.ft.com";

var apiReq = function(path) {
	console.log(path);
	return request(endpoint+path)
	.then(function(response) {
		return JSON.parse(response);
	});
}

module.exports = {
	listModules: function() {
		return apiReq('/packages')
			.then(function(list) {
				return list.map(function(module) {
					var urlparts = module.url.match(/github.com\/([^\/]+)\/([^\/\.]+)/);
					return {
						name: module.name,
						org: urlparts[1],
						repo: urlparts[2]
					};
				});
			})
		;
	},
	getModuleDetails: function(moduleName) {
		return apiReq('/components/'+moduleName+'.json')
			.then(function(resp) {
				return {
					name: moduleName,
					recentCommitCount: parseInt(resp.recent_commit_count, 10),
					dateReleased: resp.latest_datetime_created.date,
					supportStatus: resp.support_status,
					isValid: !!resp.is_valid,
					outOfDateDepCount: resp.dependencies.reduce(function(count, dep) {
						if (!dep.uptodate) count++;
						return count;
					}, 0)
				}
			})
			.catch(function(err) { console.log(err.stack || err); })
		;
	}
};
